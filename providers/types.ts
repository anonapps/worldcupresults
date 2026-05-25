export type ProviderKind = "FIFA_OFFICIAL" | "FALLBACK" | "MANUAL_IMPORT";

export interface ProviderCapabilities {
  canPullIncremental: boolean;
  supportsManualFileUpload: boolean;
  priority: number;
}

export interface SourceProviderDescriptor {
  key: string;
  kind: ProviderKind;
  displayName: string;
  capabilities: ProviderCapabilities;
}

export interface ProviderContext {
  sourceId: string;
  runId: string;
  nowIso: string;
}

export interface RawTeamRecord {
  sourceTeamId: string;
  name: string;
  fifaCode: string | null;
}

export interface RawMatchRecord {
  sourceMatchId: string;
  homeSourceTeamId: string;
  awaySourceTeamId: string;
  kickoffAt: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  homeScore: number | null;
  awayScore: number | null;
}

export interface RawTournamentRuleVersionRecord {
  sourceRuleVersionId: string;
  label: string;
  effectiveFrom: string;
}

export interface ProviderPullResult {
  teams: RawTeamRecord[];
  matches: RawMatchRecord[];
  tournamentRuleVersions: RawTournamentRuleVersionRecord[];
  checkpoint: string | null;
}

export interface SourceProviderAdapter {
  descriptor: SourceProviderDescriptor;
  pull(ctx: ProviderContext, previousCheckpoint: string | null): Promise<ProviderPullResult>;
}
