import type { ProviderKind } from "../../providers/types";

export type SyncRunStatus = "pending" | "running" | "completed" | "failed";

export interface SyncSourceRow {
  id: string;
  providerKey: string;
  providerKind: ProviderKind;
  enabled: boolean;
  lastCheckpoint: string | null;
}

export interface SyncRunRow {
  id: string;
  sourceId: string;
  status: SyncRunStatus;
  startedAt: string;
  endedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  retries: number;
}

export interface TeamUpsert {
  externalSourceId: string;
  name: string;
  fifaCode: string | null;
}

export interface MatchUpsert {
  externalSourceId: string;
  homeExternalTeamId: string;
  awayExternalTeamId: string;
  scheduledAt: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  homeScore: number | null;
  awayScore: number | null;
}

export interface TournamentRuleVersionUpsert {
  externalSourceId: string;
  label: string;
  effectiveFrom: string;
}

export interface NormalizedPayload {
  teams: TeamUpsert[];
  matches: MatchUpsert[];
  tournamentRuleVersions: TournamentRuleVersionUpsert[];
  checkpoint: string | null;
}

export interface SyncAuditEvent {
  runId: string;
  sourceId: string;
  event: string;
  details: Record<string, unknown>;
  at: string;
}

export interface SyncAuditLogger {
  onEvent(event: SyncAuditEvent): Promise<void>;
}

export interface SyncRepository {
  // sync_sources
  getSourceOrThrow(sourceId: string): Promise<SyncSourceRow>;
  updateSourceCheckpoint(sourceId: string, checkpoint: string | null): Promise<void>;

  // sync_runs
  createRun(sourceId: string): Promise<SyncRunRow>;
  markRunRunning(runId: string): Promise<void>;
  markRunCompleted(runId: string): Promise<void>;
  markRunFailed(runId: string, errorCode: string, errorMessage: string, retries: number): Promise<void>;

  // teams / matches / tournament_rule_versions
  upsertTeams(teams: TeamUpsert[]): Promise<void>;
  upsertMatches(matches: MatchUpsert[]): Promise<void>;
  upsertTournamentRuleVersions(versions: TournamentRuleVersionUpsert[]): Promise<void>;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  shouldRetry(error: unknown, attempt: number): boolean;
}
