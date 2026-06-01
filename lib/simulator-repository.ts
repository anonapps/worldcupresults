import type { EngineMatch, GroupQualificationConfig, KnockoutTemplate, MatchOutcome, MatchSelections, TournamentMode } from "../services/tournament";
import type { CreateSimulationInput, SimulationBundle, SimulationRepository, SimulationSnapshotRecord, TieResolutionSubmission } from "../services/simulator/types";

type DatabasePrimitive = string | number | boolean | null;
type DatabaseRecord = Record<string, DatabasePrimitive | Record<string, unknown>>;

export interface SupabaseDatabaseClient {
  select(table: string, options?: { eq?: Record<string, string>; order?: { column: string; ascending?: boolean } }): Promise<DatabaseRecord[]>;
  insert(table: string, rows: DatabaseRecord[]): Promise<DatabaseRecord[]>;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const validOutcomes = new Set<MatchOutcome>(["HOME_WIN", "AWAY_WIN", "DRAW"]);

const toDatabaseMode = (mode: TournamentMode): string => {
  if (mode === "LIVE_REALITY") return "official";
  if (mode === "MIXED_PREDICTION") return "manual_override";
  return "what_if";
};

const fromDatabaseMode = (mode: unknown): TournamentMode => {
  if (mode === "official") return "LIVE_REALITY";
  if (mode === "manual_override") return "MIXED_PREDICTION";
  return "FULL_SIMULATION";
};

const requireString = (row: DatabaseRecord, key: string): string => {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Expected ${key} to be a string`);
  return value;
};

const nullableString = (row: DatabaseRecord, key: string): string | null => {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`Expected ${key} to be a string or null`);
  return value;
};

const randomPublicSnapshotId = (): string => crypto.randomUUID().replace(/-/g, "");

export class SupabaseRestClient implements SupabaseDatabaseClient {
  constructor(private readonly url: string, private readonly key: string) {}

  async select(table: string, options: { eq?: Record<string, string>; order?: { column: string; ascending?: boolean } } = {}): Promise<DatabaseRecord[]> {
    const url = new URL(`/rest/v1/${table}`, this.url);
    url.searchParams.set("select", "*");
    for (const [column, value] of Object.entries(options.eq ?? {})) url.searchParams.set(column, `eq.${value}`);
    if (options.order) url.searchParams.set("order", `${options.order.column}.${options.order.ascending === false ? "desc" : "asc"}`);

    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) throw new Error(`Supabase select ${table} failed: ${response.status}`);
    return (await response.json()) as DatabaseRecord[];
  }

  async insert(table: string, rows: DatabaseRecord[]): Promise<DatabaseRecord[]> {
    if (rows.length === 0) return [];
    const response = await fetch(new URL(`/rest/v1/${table}`, this.url), {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(rows),
    });
    if (!response.ok) throw new Error(`Supabase insert ${table} failed: ${response.status}`);
    return (await response.json()) as DatabaseRecord[];
  }

  private headers(): Record<string, string> {
    return { apikey: this.key, Authorization: `Bearer ${this.key}` };
  }
}

export class SupabaseSimulationRepository implements SimulationRepository {
  constructor(private readonly db: SupabaseDatabaseClient, private readonly publicIdFactory: () => string = randomPublicSnapshotId) {}

  async getMatchesForRuleVersion(ruleVersionId: string): Promise<EngineMatch[]> {
    const rows = await this.db.select("matches", { eq: { tournament_rule_version_id: ruleVersionId }, order: { column: "scheduled_at" } });
    return rows.map((row) => ({
      id: requireString(row, "id"),
      stage: requireString(row, "stage") as EngineMatch["stage"],
      groupId: nullableString(row, "group_id"),
      homeTeamId: requireString(row, "home_team_id"),
      awayTeamId: requireString(row, "away_team_id"),
      scheduledAt: requireString(row, "scheduled_at"),
      status: requireString(row, "status") as EngineMatch["status"],
      played: row.status === "completed" || row.is_locked === true,
    }));
  }

  async getBundleBySnapshotId(snapshotId: string): Promise<SimulationBundle | null> {
    const snapshot = await this.getSnapshotBy("id", snapshotId);
    if (!snapshot) return null;
    return this.buildBundle(snapshot);
  }

  async getBundleByPublicSnapshotId(publicSnapshotId: string): Promise<SimulationBundle | null> {
    const snapshot = await this.getSnapshotBy("public_snapshot_id", publicSnapshotId);
    if (!snapshot) return null;
    return this.buildBundle(snapshot);
  }

  async getGroupQualificationConfig(ruleVersionId: string): Promise<GroupQualificationConfig[]> {
    const groups = await this.db.select("groups", { eq: { tournament_rule_version_id: ruleVersionId }, order: { column: "group_name" } });
    return groups.map((group) => ({ groupId: requireString(group, "id"), qualifiedCount: 2 }));
  }

  async getKnockoutTemplate(ruleVersionId: string): Promise<KnockoutTemplate> {
    const rows = await this.db.select("tournament_rule_versions", { eq: { id: ruleVersionId } });
    const payload = rows[0]?.rules_payload;
    if (payload && typeof payload === "object" && "knockoutTemplate" in payload) return payload.knockoutTemplate as KnockoutTemplate;
    return { slots: [] };
  }

  async createSnapshot(input: CreateSimulationInput): Promise<SimulationSnapshotRecord> {
    const rows = await this.db.insert("simulation_snapshots", [
      {
        public_snapshot_id: this.publicIdFactory(),
        tournament_rule_version_id: input.tournamentRuleVersionId,
        mode: toDatabaseMode(input.mode),
        metadata: input.metadata ?? {},
      },
    ]);
    return this.toSnapshotRecord(rows[0]);
  }

  async materializeSnapshotMatches(snapshotId: string, matches: EngineMatch[], selections: MatchSelections): Promise<void> {
    await this.db.insert(
      "simulation_snapshot_matches",
      matches.map((match) => {
        const selection = selections[match.id];
        return {
          simulation_snapshot_id: snapshotId,
          match_id: match.id,
          selected_outcome: selection?.outcome ?? "UNPREDICTED",
          selected_winner_team_id: selection?.winnerTeamId ?? null,
        };
      }),
    );
  }

  async createTieDecisions(snapshotId: string, decisions: TieResolutionSubmission[]): Promise<void> {
    const rows = decisions.flatMap((decision) =>
      decision.orderedTeamIds.slice(0, -1).map((teamId, index) => ({
        simulation_snapshot_id: snapshotId,
        group_id: decision.groupId,
        higher_ranked_team_id: teamId,
        lower_ranked_team_id: decision.orderedTeamIds[index + 1],
      })),
    );
    await this.db.insert("tie_resolution_decisions", rows);
  }

  private async getSnapshotBy(column: "id" | "public_snapshot_id", value: string): Promise<SimulationSnapshotRecord | null> {
    const rows = await this.db.select("simulation_snapshots", { eq: { [column]: value } });
    if (!rows[0]) return null;
    return this.toSnapshotRecord(rows[0]);
  }

  private async buildBundle(snapshot: SimulationSnapshotRecord): Promise<SimulationBundle> {
    const [matches, selectionRows, tieRows] = await Promise.all([
      this.getMatchesForRuleVersion(snapshot.tournamentRuleVersionId),
      this.db.select("simulation_snapshot_matches", { eq: { simulation_snapshot_id: snapshot.id } }),
      this.db.select("tie_resolution_decisions", { eq: { simulation_snapshot_id: snapshot.id }, order: { column: "decided_at" } }),
    ]);

    return {
      snapshot,
      matches,
      selections: this.toSelections(selectionRows),
      tieDecisions: this.toTieDecisions(tieRows),
    };
  }

  private toSelections(rows: DatabaseRecord[]): MatchSelections {
    const selections: MatchSelections = {};
    for (const row of rows) {
      const outcome = row.selected_outcome;
      if (!validOutcomes.has(outcome as MatchOutcome)) continue;
      selections[requireString(row, "match_id")] = { outcome: outcome as MatchOutcome, winnerTeamId: nullableString(row, "selected_winner_team_id") };
    }
    return selections;
  }

  private toTieDecisions(rows: DatabaseRecord[]): TieResolutionSubmission[] {
    const byGroup = new Map<string, Array<{ higher: string; lower: string }>>();
    for (const row of rows) {
      const groupId = requireString(row, "group_id");
      const list = byGroup.get(groupId) ?? [];
      list.push({ higher: requireString(row, "higher_ranked_team_id"), lower: requireString(row, "lower_ranked_team_id") });
      byGroup.set(groupId, list);
    }

    return [...byGroup.entries()].map(([groupId, pairs]) => ({ groupId, orderedTeamIds: this.rebuildOrder(pairs) }));
  }

  private rebuildOrder(pairs: Array<{ higher: string; lower: string }>): string[] {
    if (pairs.length === 0) return [];
    const lowerIds = new Set(pairs.map((pair) => pair.lower));
    const nextByHigher = new Map(pairs.map((pair) => [pair.higher, pair.lower]));
    const start = pairs.find((pair) => !lowerIds.has(pair.higher))?.higher ?? pairs[0].higher;
    const ordered = [start];
    while (nextByHigher.has(ordered[ordered.length - 1])) ordered.push(nextByHigher.get(ordered[ordered.length - 1])!);
    return ordered;
  }

  private toSnapshotRecord(row: DatabaseRecord | undefined): SimulationSnapshotRecord {
    if (!row) throw new Error("Supabase did not return the inserted simulation snapshot");
    return {
      id: requireString(row, "id"),
      publicSnapshotId: requireString(row, "public_snapshot_id"),
      tournamentRuleVersionId: requireString(row, "tournament_rule_version_id"),
      mode: fromDatabaseMode(row.mode),
      createdAt: requireString(row, "created_at"),
      metadata: typeof row.metadata === "object" && row.metadata !== null ? row.metadata : {},
    };
  }
}

let singleton: SupabaseSimulationRepository | null = null;

export const getSimulationRepository = (): SimulationRepository => {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase environment variables are required for simulation persistence");
  singleton ??= new SupabaseSimulationRepository(new SupabaseRestClient(SUPABASE_URL, SUPABASE_KEY));
  return singleton;
};
