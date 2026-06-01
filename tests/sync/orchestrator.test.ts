import assert from "node:assert/strict";
import test from "node:test";

import { FallbackSourceAdapter, ManualAdminImportAdapter, SourceProviderRegistry } from "../../providers";
import { SyncNormalizer, SyncOrchestrator, type SyncAuditEvent, type SyncAuditLogger, type SyncRepository, type SyncRunRow, type SyncSourceRow, DefaultRetryPolicy } from "../../services/sync";

class InMemorySyncRepository implements SyncRepository {
  public readonly runs = new Map<string, SyncRunRow>();
  public source: SyncSourceRow = { id: "src1", providerKey: "fallback_source", providerKind: "FALLBACK", enabled: true, lastCheckpoint: null };
  public teams = 0;
  public matches = 0;
  public versions = 0;

  async getSourceOrThrow(sourceId: string): Promise<SyncSourceRow> {
    if (this.source.id !== sourceId) throw new Error("not_found");
    return this.source;
  }
  async updateSourceCheckpoint(_sourceId: string, checkpoint: string | null): Promise<void> { this.source.lastCheckpoint = checkpoint; }
  async createRun(sourceId: string): Promise<SyncRunRow> {
    const run: SyncRunRow = { id: `run-${this.runs.size + 1}`, sourceId, status: "pending", startedAt: "now", endedAt: null, errorCode: null, errorMessage: null, retries: 0 };
    this.runs.set(run.id, run);
    return run;
  }
  async markRunRunning(runId: string): Promise<void> { this.runs.get(runId)!.status = "running"; }
  async markRunCompleted(runId: string): Promise<void> { this.runs.get(runId)!.status = "completed"; }
  async markRunFailed(runId: string, errorCode: string, errorMessage: string, retries: number): Promise<void> {
    const run = this.runs.get(runId)!;
    run.status = "failed";
    run.errorCode = errorCode;
    run.errorMessage = errorMessage;
    run.retries = retries;
  }
  async upsertTeams(teams: { externalSourceId: string }[]): Promise<void> { this.teams += teams.length; }
  async upsertMatches(matches: { externalSourceId: string }[]): Promise<void> { this.matches += matches.length; }
  async upsertTournamentRuleVersions(versions: { externalSourceId: string }[]): Promise<void> { this.versions += versions.length; }
}

class CollectingAuditLogger implements SyncAuditLogger {
  public readonly events: SyncAuditEvent[] = [];
  async onEvent(event: SyncAuditEvent): Promise<void> { this.events.push(event); }
}

test("sync orchestrator runs deterministic lifecycle and persists normalized payload", async () => {
  const provider = new FallbackSourceAdapter();
  provider.pull = async () => ({
    teams: [{ sourceTeamId: "T1", name: " Team 1 ", fifaCode: "T1" }],
    matches: [{ sourceMatchId: "M1", homeSourceTeamId: "T1", awaySourceTeamId: "T2", kickoffAt: "2026-06-01T00:00:00Z", status: "scheduled", homeScore: null, awayScore: null }],
    tournamentRuleVersions: [{ sourceRuleVersionId: "R1", label: "Rules v1", effectiveFrom: "2026-01-01T00:00:00Z" }],
    checkpoint: "ckpt-1",
  });

  const repository = new InMemorySyncRepository();
  const audit = new CollectingAuditLogger();
  const orchestrator = new SyncOrchestrator(new SourceProviderRegistry([provider]), new SyncNormalizer(), repository, audit, new DefaultRetryPolicy(1, 0), () => "2026-01-01T00:00:00Z");

  const result = await orchestrator.run("src1");

  assert.equal(result.attempts, 1);
  assert.equal(repository.source.lastCheckpoint, "ckpt-1");
  assert.equal(repository.teams, 1);
  assert.equal(repository.matches, 1);
  assert.equal(repository.versions, 1);
  assert.deepEqual(audit.events.map((e) => e.event), ["run_started", "run_completed"]);
});

test("sync orchestrator retries and marks run failed after policy exhaustion", async () => {
  const provider = new FallbackSourceAdapter();
  let calls = 0;
  provider.pull = async () => {
    calls += 1;
    throw new Error("transient outage");
  };

  const repository = new InMemorySyncRepository();
  const audit = new CollectingAuditLogger();
  const orchestrator = new SyncOrchestrator(new SourceProviderRegistry([provider]), new SyncNormalizer(), repository, audit, new DefaultRetryPolicy(2, 0), () => "2026-01-01T00:00:00Z");

  await assert.rejects(() => orchestrator.run("src1"), /transient outage/);
  assert.equal(calls, 2);

  const failedRun = [...repository.runs.values()][0];
  assert.equal(failedRun.status, "failed");
  assert.equal(failedRun.retries, 1);
  assert.deepEqual(audit.events.map((e) => e.event), ["run_started", "run_retry_scheduled", "run_failed"]);
});

test("manual adapter and registry provider abstraction remain resolvable", async () => {
  const manual = new ManualAdminImportAdapter();
  const registry = new SourceProviderRegistry([manual]);

  const pulled = await registry.getOrThrow("manual_admin_import").pull({ sourceId: "src", runId: "run", nowIso: "2026-01-01T00:00:00Z" }, null);
  assert.deepEqual(pulled, { teams: [], matches: [], tournamentRuleVersions: [], checkpoint: null });
});
