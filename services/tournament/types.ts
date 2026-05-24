export type TournamentMode = "LIVE_REALITY" | "FULL_SIMULATION" | "MIXED_PREDICTION";

export type MatchOutcome = "HOME_WIN" | "AWAY_WIN" | "DRAW";

export type MatchLifecycleStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export type KnockoutStage =
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";

export interface EngineMatch {
  id: string;
  stage: "group" | KnockoutStage;
  groupId: string | null;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: string;
  status: MatchLifecycleStatus;
  played: boolean;
}

export interface MatchSelection {
  outcome: MatchOutcome;
  winnerTeamId: string | null;
}

export type MatchSelections = Record<string, MatchSelection>;

export interface GroupStandingRow {
  groupId: string;
  teamId: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface GroupStandingTable {
  groupId: string;
  rows: GroupStandingRow[];
  unresolvedTies: Array<{ teamIds: string[]; points: number }>;
}

export interface TieResolutionDecision {
  groupId: string;
  orderedTeamIds: string[];
}

export interface GroupQualificationConfig {
  groupId: string;
  qualifiedCount: number;
}

export interface BracketSlot {
  stage: KnockoutStage;
  matchId: string;
  homeSource: string;
  awaySource: string;
}

export interface KnockoutTemplate {
  slots: BracketSlot[];
}

export interface EngineState {
  mode: TournamentMode;
  matches: EngineMatch[];
  selections: MatchSelections;
  createdAt: string;
  version: number;
}

export interface MutationInput {
  matchId: string;
  selection: MatchSelection;
}

export interface StateTransitionResult {
  state: EngineState;
  invalidatedMatchIds: string[];
}

export interface TournamentEngineService {
  calculateStandings(matches: EngineMatch[], selections: MatchSelections): GroupStandingTable[];
  resolveGroupQualifications(
    standings: GroupStandingTable[],
    configs: GroupQualificationConfig[],
    tieDecisions: TieResolutionDecision[],
  ): Record<string, string[]>;
  generateBracket(qualifiers: Record<string, string[]>, template: KnockoutTemplate): Record<string, { homeTeamId: string; awayTeamId: string }>;
  applyMutation(state: EngineState, mutation: MutationInput): StateTransitionResult;
  reconstructSnapshot(base: EngineState, mutations: MutationInput[]): EngineState;
  canEditMatch(mode: TournamentMode, match: EngineMatch): boolean;
}
