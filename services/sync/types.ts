export type UUID = string;

export type ProviderKind = "fifa_official" | "fallback" | "manual_admin_import";
export type SyncEntityType = "teams" | "matches" | "tournament_rule_versions";
export type SyncRunStatus = "running" | "succeeded" | "failed";
export type MatchStage =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";
export type MatchStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface SyncSourceRecord {
  id: UUID;
  source_name: string;
  trust_rank: number;
  is_active: boolean;
}

export interface SyncRunRecord {
  id: UUID;
  source_id: UUID;
  started_at: string;
  completed_at: string | null;
  status: SyncRunStatus;
  details: Record<string, unknown>;
}

export interface SourceFetchContext {
  source: SyncSourceRecord;
  tournamentRuleVersionId?: UUID;
  requestedAt: string;
}

export interface RawTeamRecord {
  providerTeamId: string;
  fifaCode: string;
  name: string;
  flagUrl: string;
  confederation: string;
}

export interface RawMatchRecord {
  providerMatchId: string;
  tournamentRuleVersionId?: UUID;
  stage: MatchStage;
  groupId: UUID | null;
  homeTeamProviderId: string;
  awayTeamProviderId: string;
  scheduledAt: string;
  status: MatchStatus;
  winnerTeamProviderId: string | null;
}

export interface RawTournamentRuleVersionRecord {
  providerRuleVersionId: string;
  versionName: string;
  effectiveFrom: string;
  description: string;
  rulesPayload: Record<string, unknown>;
}

export interface SourcePayload {
  teams: RawTeamRecord[];
  matches: RawMatchRecord[];
  tournamentRuleVersions: RawTournamentRuleVersionRecord[];
  fetchedAt: string;
  watermark: string | null;
}

export interface WorldCupSourceAdapter {
  readonly provider: ProviderKind;
  readonly sourceName: string;
  fetch(context: SourceFetchContext): Promise<SourcePayload>;
}

export interface NormalizedTeam {
  fifa_code: string;
  name_es: string;
  flag_url: string;
  confederation: string;
}

export interface NormalizedMatch {
  tournament_rule_version_id: UUID;
  stage: MatchStage;
  group_id: UUID | null;
  home_team_fifa_code: string;
  away_team_fifa_code: string;
  scheduled_at: string;
  status: MatchStatus;
  source_type: "sync";
  source_reference: string;
  winner_team_fifa_code: string | null;
}

export interface NormalizedTournamentRuleVersion {
  version_name: string;
  effective_from: string;
  description: string;
  rules_payload: Record<string, unknown>;
}

export interface NormalizedDataset {
  source: SyncSourceRecord;
  fetchedAt: string;
  watermark: string | null;
  teams: NormalizedTeam[];
  matches: NormalizedMatch[];
  tournamentRuleVersions: NormalizedTournamentRuleVersion[];
}

export interface SyncAuditEvent {
  type: "sync_started" | "sync_retry" | "sync_succeeded" | "sync_failed";
  sourceName: string;
  runId?: UUID;
  attempt: number;
  at: string;
  details: Record<string, unknown>;
}

export interface SyncAuditLogger {
  record(event: SyncAuditEvent): Promise<void>;
}

export interface SyncSourceRepository {
  findByName(sourceName: string): Promise<SyncSourceRecord | null>;
}

export interface SyncRunRepository {
  start(sourceId: UUID, details: Record<string, unknown>): Promise<SyncRunRecord>;
  succeed(runId: UUID, details: Record<string, unknown>): Promise<SyncRunRecord>;
  fail(runId: UUID, details: Record<string, unknown>): Promise<SyncRunRecord>;
}

export interface PersistenceSummary {
  teams: number;
  matches: number;
  tournamentRuleVersions: number;
}

export interface SyncPersistenceAdapter {
  persist(dataset: NormalizedDataset): Promise<PersistenceSummary>;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  shouldRetry(error: unknown, attempt: number): boolean;
}

export interface Clock {
  now(): string;
}

export interface Sleep {
  (delayMs: number): Promise<void>;
}

export interface SyncRequest {
  sourceName: string;
  tournamentRuleVersionId?: UUID;
}

export interface SyncResult {
  run: SyncRunRecord;
  summary: PersistenceSummary;
  attempts: number;
}
