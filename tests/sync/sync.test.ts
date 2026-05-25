import assert from "node:assert/strict";
import test from "node:test";

import { FallbackSourceAdapter, FifaOfficialSourceAdapter, ManualAdminImportSourceAdapter } from "../../providers";
import {
  NormalizationError,
  RepositorySyncPersistenceAdapter,
  SourceAdapterNotConfiguredError,
  SyncOrchestrationService,
  buildPersistenceOperations,
  normalizeSourcePayload,
  type PersistenceSummary,
  type SourcePayload,
  type SyncAuditEvent,
  type SyncRunRecord,
  type SyncSourceRecord,
  type WorldCupSourceAdapter,
} from "../../services/sync";

const source: SyncSourceRecord = {
  id: "source-1",
  source_name: "manual_admin_import",
  trust_rank: 1,
  is_active: true,
};

const payload: SourcePayload = {
  fetchedAt: "2026-01-01T00:00:00Z",
  watermark: "snapshot-1",
  teams: [
    { providerTeamId: "arg", fifaCode: "ARG", name: "Argentina", flagUrl: "https://example.com/arg.svg", confederation: "CONMEBOL" },
    { providerTeamId: "esp", fifaCode: "ESP", name: "Espana", flagUrl: "https://example.com/esp.svg", confederation: "UEFA" },
  ],
  matches: [
    {
      providerMatchId: "match-1",
      stage: "group",
      groupId: "group-a",
      homeTeamProviderId: "arg",
      awayTeamProviderId: "esp",
      scheduledAt: "2026-06-11T20:00:00Z",
      status: "scheduled",
      winnerTeamProviderId: null,
    },
  ],
  tournamentRuleVersions: [
    {
      providerRuleVersionId: "rules-2026",
      versionName: "2026-official",
      effectiveFrom: "2026-01-01T00:00:00Z",
      description: "Official 2026 rules",
      rulesPayload: { qualifiedPerGroup: 2 },
    },
  ],
};

class MemoryRuns {
  records: SyncRunRecord[] = [];

  async start(sourceId: string, details: Record<string, unknown>): Promise<SyncRunRecord> {
    const run = { id: "run-1", source_id: sourceId, started_at: "2026-01-01T00:00:00Z", completed_at: null, status: "running" as const, details };
    this.records.push(run);
    return run;
  }

  async succeed(runId: string, details: Record<string, unknown>): Promise<SyncRunRecord> {
    const run = this.records.find((record) => record.id === runId)!;
    const completed = { ...run, completed_at: "2026-01-01T00:00:01Z", status: "succeeded" as const, details };
    this.records[0] = completed;
    return completed;
  }

  async fail(runId: string, details: Record<string, unknown>): Promise<SyncRunRecord> {
    const run = this.records.find((record) => record.id === runId)!;
    const completed = { ...run, completed_at: "2026-01-01T00:00:01Z", status: "failed" as const, details };
    this.records[0] = completed;
    return completed;
  }
}

const makeSources = (record: SyncSourceRecord | null = source) => ({
  findByName: async () => record,
});

const makeAudit = () => {
  const events: SyncAuditEvent[] = [];
  return { events, record: async (event: SyncAuditEvent) => void events.push(event) };
};

test("normalizes provider payloads into persistence-facing records", () => {
  const dataset = normalizeSourcePayload(source, payload, "rule-version-id");

  assert.equal(dataset.teams[0].fifa_code, "ARG");
  assert.equal(dataset.matches[0].tournament_rule_version_id, "rule-version-id");
  assert.equal(dataset.matches[0].home_team_fifa_code, "ARG");
  assert.equal(dataset.matches[0].source_reference, "manual_admin_import:match-1");
  assert.equal(dataset.tournamentRuleVersions[0].version_name, "2026-official");
});

test("rejects payloads that reference unknown teams", () => {
  assert.throws(
    () =>
      normalizeSourcePayload(
        source,
        {
          ...payload,
          matches: [{ ...payload.matches[0], awayTeamProviderId: "missing" }],
        },
        "rule-version-id",
      ),
    NormalizationError,
  );
});

test("maps normalized matches to persisted team ids", async () => {
  const dataset = normalizeSourcePayload(source, payload, "rule-version-id");
  const operations = await buildPersistenceOperations(dataset, {
    findIdsByFifaCode: async () =>
      new Map([
        ["ARG", "team-arg"],
        ["ESP", "team-esp"],
      ]),
  });

  assert.deepEqual(operations.matches[0], {
    tournament_rule_version_id: "rule-version-id",
    stage: "group",
    group_id: "group-a",
    home_team_id: "team-arg",
    away_team_id: "team-esp",
    scheduled_at: "2026-06-11T20:00:00Z",
    status: "scheduled",
    source_type: "sync",
    source_reference: "manual_admin_import:match-1",
    winner_team_id: null,
  });
});

test("orchestrates sync run lifecycle with audit hooks", async () => {
  const runs = new MemoryRuns();
  const audit = makeAudit();
  const persistence = new RepositorySyncPersistenceAdapter(
    {
      findIdsByFifaCode: async () =>
        new Map([
          ["ARG", "team-arg"],
          ["ESP", "team-esp"],
        ]),
    },
    {
      upsertTeams: async (teams) => teams.length,
      upsertTournamentRuleVersions: async (versions) => versions.length,
      upsertMatches: async (matches) => matches.length,
    },
  );

  const service = new SyncOrchestrationService(
    [new ManualAdminImportSourceAdapter(payload, "manual_admin_import")],
    makeSources(),
    runs,
    persistence,
    audit,
    { maxAttempts: 2, baseDelayMs: 1, shouldRetry: () => false },
    { now: () => "2026-01-01T00:00:00Z" },
  );

  const result = await service.sync({ sourceName: "manual_admin_import", tournamentRuleVersionId: "rule-version-id" });

  assert.equal(result.run.status, "succeeded");
  assert.deepEqual(result.summary, { teams: 2, tournamentRuleVersions: 1, matches: 1 });
  assert.deepEqual(audit.events.map((event) => event.type), ["sync_started", "sync_succeeded"]);
});

test("retries transient adapter failures and fails the sync run", async () => {
  const runs = new MemoryRuns();
  const audit = makeAudit();
  let attempts = 0;
  const failingAdapter: WorldCupSourceAdapter = {
    provider: "fallback",
    sourceName: "manual_admin_import",
    fetch: async () => {
      attempts += 1;
      throw new Error("temporary upstream failure");
    },
  };
  const summary: PersistenceSummary = { teams: 0, tournamentRuleVersions: 0, matches: 0 };
  const service = new SyncOrchestrationService(
    [failingAdapter],
    makeSources(),
    runs,
    { persist: async () => summary },
    audit,
    { maxAttempts: 2, baseDelayMs: 5, shouldRetry: () => true },
    { now: () => "2026-01-01T00:00:00Z" },
  );

  await assert.rejects(() => service.sync({ sourceName: "manual_admin_import", tournamentRuleVersionId: "rule-version-id" }), /temporary upstream failure/);

  assert.equal(attempts, 2);
  assert.equal(runs.records[0].status, "failed");
  assert.deepEqual(audit.events.map((event) => event.type), ["sync_started", "sync_retry", "sync_failed"]);
});

test("provider placeholders do not fetch real data yet", async () => {
  await assert.rejects(
    () => new FifaOfficialSourceAdapter().fetch({ source, requestedAt: "2026-01-01T00:00:00Z" }),
    SourceAdapterNotConfiguredError,
  );
  await assert.rejects(
    () => new FallbackSourceAdapter().fetch({ source, requestedAt: "2026-01-01T00:00:00Z" }),
    SourceAdapterNotConfiguredError,
  );
});
