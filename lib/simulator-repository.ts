import type { GroupQualificationConfig, KnockoutTemplate, MatchSelections } from "../services/tournament";
import type { CreateSimulationInput, SimulationBundle, SimulationRepository, SimulationSnapshotRecord, TieResolutionSubmission } from "../services/simulator/types";

interface DbRow { id: string; public_snapshot_id: string; tournament_rule_version_id: string; mode: "LIVE_REALITY" | "FULL_SIMULATION" | "MIXED_PREDICTION"; created_at: string; metadata: Record<string, unknown> }

export class InMemorySimulationRepository implements SimulationRepository {
  public snapshots = new Map<string, SimulationBundle>();
  public byPublic = new Map<string, string>();
  public matchesByVersion = new Map<string, any[]>();
  public configsByVersion = new Map<string, GroupQualificationConfig[]>();
  public templatesByVersion = new Map<string, KnockoutTemplate>();

  async getMatchesForRuleVersion(ruleVersionId: string) { return this.matchesByVersion.get(ruleVersionId) ?? []; }
  async getBundleBySnapshotId(snapshotId: string) { return this.snapshots.get(snapshotId) ?? null; }
  async getBundleByPublicSnapshotId(publicSnapshotId: string) { const id = this.byPublic.get(publicSnapshotId); return id ? (this.snapshots.get(id) ?? null) : null; }
  async getGroupQualificationConfig(ruleVersionId: string) { return this.configsByVersion.get(ruleVersionId) ?? []; }
  async getKnockoutTemplate(ruleVersionId: string) { return this.templatesByVersion.get(ruleVersionId) ?? { slots: [] }; }

  async createSnapshot(input: CreateSimulationInput): Promise<SimulationSnapshotRecord> {
    const id = crypto.randomUUID();
    const pub = crypto.randomUUID().replace(/-/g, "");
    const snapshot: SimulationSnapshotRecord = { id, publicSnapshotId: pub, tournamentRuleVersionId: input.tournamentRuleVersionId, mode: input.mode, createdAt: new Date().toISOString(), metadata: input.metadata ?? {} };
    this.snapshots.set(id, { snapshot, matches: await this.getMatchesForRuleVersion(input.tournamentRuleVersionId), selections: {}, tieDecisions: [] });
    this.byPublic.set(pub, id);
    return snapshot;
  }
  async createSnapshotSelections(snapshotId: string, selections: MatchSelections): Promise<void> { const b = this.snapshots.get(snapshotId); if (b) b.selections = selections; }
  async createTieDecisions(snapshotId: string, decisions: TieResolutionSubmission[]): Promise<void> { const b = this.snapshots.get(snapshotId); if (b) b.tieDecisions = decisions; }
}

let singleton: InMemorySimulationRepository | null = null;
export const getSimulationRepository = (): SimulationRepository => {
  if (!singleton) singleton = new InMemorySimulationRepository();
  return singleton;
};
