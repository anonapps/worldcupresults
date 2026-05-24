export type UUID = string;

export type MatchStage =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";

export type MatchStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type MatchSourceType = "manual" | "rule_generated" | "sync";
export type SimulationMode = "official" | "what_if" | "manual_override";
export type SyncRunStatus = "running" | "succeeded" | "failed";

export interface Team {
  id: UUID;
  fifa_code: string;
  name_es: string;
  flag_url: string;
  confederation: string;
  created_at: string;
  updated_at: string;
}

export interface TournamentRuleVersion {
  id: UUID;
  version_name: string;
  effective_from: string;
  description: string;
  rules_payload: Record<string, unknown>;
  created_at: string;
}

export interface Group {
  id: UUID;
  group_name: string;
  tournament_rule_version_id: UUID;
  created_at: string;
}

export interface GroupTeamAssignment {
  id: UUID;
  group_id: UUID;
  team_id: UUID;
  seed_order: number;
}

export interface Match {
  id: UUID;
  tournament_rule_version_id: UUID;
  stage: MatchStage;
  group_id: UUID | null;
  home_team_id: UUID;
  away_team_id: UUID;
  scheduled_at: string;
  status: MatchStatus;
  source_type: MatchSourceType;
  source_reference: string | null;
  winner_team_id: UUID | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface Standing {
  id: UUID;
  tournament_rule_version_id: UUID;
  group_id: UUID;
  team_id: UUID;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  position: number;
  is_provisional: boolean;
  updated_at: string;
}

export interface SimulationSnapshot {
  id: UUID;
  public_snapshot_id: string;
  tournament_rule_version_id: UUID;
  mode: SimulationMode;
  created_at: string;
  expires_at: string | null;
  metadata: Record<string, unknown>;
}

export interface TieResolutionDecision {
  id: UUID;
  simulation_snapshot_id: UUID;
  group_id: UUID;
  higher_ranked_team_id: UUID;
  lower_ranked_team_id: UUID;
  decided_at: string;
}

export interface SimulationSnapshotMatch {
  id: UUID;
  simulation_snapshot_id: UUID;
  match_id: UUID;
  selected_outcome: string;
  selected_winner_team_id: UUID | null;
  created_at: string;
}

export interface SyncSource {
  id: UUID;
  source_name: string;
  trust_rank: number;
  is_active: boolean;
}

export interface SyncRun {
  id: UUID;
  source_id: UUID;
  started_at: string;
  completed_at: string | null;
  status: SyncRunStatus;
  details: Record<string, unknown>;
}


export interface TournamentDomainModel {
  teams: Team[];
  tournament_rule_versions: TournamentRuleVersion[];
  groups: Group[];
  group_team_assignments: GroupTeamAssignment[];
  matches: Match[];
  standings: Standing[];
  simulation_snapshots: SimulationSnapshot[];
  simulation_snapshot_matches: SimulationSnapshotMatch[];
  tie_resolution_decisions: TieResolutionDecision[];
  sync_sources: SyncSource[];
  sync_runs: SyncRun[];
}
