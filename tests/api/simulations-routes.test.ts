import assert from "node:assert/strict";
import test from "node:test";

import { SupabaseSimulationRepository, type SupabaseDatabaseClient } from "../../lib/simulator-repository";
import { SimulatorService } from "../../services/simulator/service";

type Row = Record<string, string | number | boolean | null | Record<string, unknown>>;

class FakeSupabaseClient implements SupabaseDatabaseClient {
  public readonly tables = new Map<string, Row[]>();
  private sequence = 0;

  constructor(seed: Record<string, Row[]>) {
    for (const [table, rows] of Object.entries(seed)) this.tables.set(table, rows.map((row) => ({ ...row })));
  }

  async select(table: string, options: { eq?: Record<string, string>; order?: { column: string; ascending?: boolean } } = {}): Promise<Row[]> {
    let rows = [...(this.tables.get(table) ?? [])];
    for (const [column, value] of Object.entries(options.eq ?? {})) rows = rows.filter((row) => row[column] === value);
    if (options.order) {
      rows.sort((a, b) => String(a[options.order!.column]).localeCompare(String(b[options.order!.column])));
      if (options.order.ascending === false) rows.reverse();
    }
    return rows.map((row) => ({ ...row }));
  }

  async insert(table: string, rows: Row[]): Promise<Row[]> {
    const existing = this.tables.get(table) ?? [];
    const inserted = rows.map((row) => ({ id: row.id ?? `${table}-${++this.sequence}`, created_at: row.created_at ?? "2026-01-01T00:00:00Z", ...row }));
    this.tables.set(table, [...existing, ...inserted]);
    return inserted.map((row) => ({ ...row }));
  }
}

const match = {
  id: "m1",
  tournament_rule_version_id: "rv1",
  stage: "group",
  group_id: "g1",
  home_team_id: "t1",
  away_team_id: "t2",
  scheduled_at: "2026-01-01T00:00:00Z",
  status: "scheduled",
  is_locked: false,
};

const buildRepository = () => {
  const db = new FakeSupabaseClient({
    matches: [match],
    groups: [{ id: "g1", group_name: "A", tournament_rule_version_id: "rv1" }],
    tournament_rule_versions: [{ id: "rv1", rules_payload: {} }],
  });
  return { db, repository: new SupabaseSimulationRepository(db, () => "public-snapshot-id") };
};

test("simulation creation materializes all snapshot matches and supports reconstruction + share", async () => {
  const { db, repository } = buildRepository();
  const service = new SimulatorService(repository, undefined, () => "2026-01-01T00:00:00Z");

  const created = await service.createSimulation({ tournamentRuleVersionId: "rv1", mode: "FULL_SIMULATION" });
  const reconstructed = await service.reconstruct(created.id);
  const shared = await service.getShared(created.publicSnapshotId);

  assert.equal(reconstructed.snapshot.id, created.id);
  assert.equal(shared.snapshot.id, created.id);
  assert.equal(db.tables.get("simulation_snapshot_matches")?.length, 1);
  assert.equal(db.tables.get("simulation_snapshot_matches")?.[0].selected_outcome, "UNPREDICTED");
});

test("prediction mutation creates immutable child snapshot with full materialized rows", async () => {
  const { db, repository } = buildRepository();
  const service = new SimulatorService(repository, undefined, () => "2026-01-01T00:00:00Z");

  const created = await service.createSimulation({ tournamentRuleVersionId: "rv1", mode: "FULL_SIMULATION" });
  const predicted = await service.predict(created.id, { matchId: "m1", selection: { outcome: "HOME_WIN", winnerTeamId: "t1" } });

  assert.notEqual(predicted.snapshot.id, created.id);
  assert.equal(predicted.state.selections.m1.winnerTeamId, "t1");
  assert.equal(db.tables.get("simulation_snapshots")?.length, 2);
  assert.equal(db.tables.get("simulation_snapshot_matches")?.length, 2);
  assert.equal(db.tables.get("simulation_snapshot_matches")?.[1].selected_outcome, "HOME_WIN");
});

test("tie resolution submissions are persisted and reconstructed from Supabase rows", async () => {
  const { db, repository } = buildRepository();
  const service = new SimulatorService(repository, undefined, () => "2026-01-01T00:00:00Z");

  const created = await service.createSimulation({ tournamentRuleVersionId: "rv1", mode: "FULL_SIMULATION" });
  const resolved = await service.submitTieResolution(created.id, [{ groupId: "g1", orderedTeamIds: ["t1", "t2", "t3"] }]);
  const bundle = await repository.getBundleBySnapshotId(resolved.snapshot.id);

  assert.equal(db.tables.get("tie_resolution_decisions")?.length, 2);
  assert.deepEqual(bundle?.tieDecisions, [{ groupId: "g1", orderedTeamIds: ["t1", "t2", "t3"] }]);
});
