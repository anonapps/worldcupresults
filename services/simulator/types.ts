import type { EngineMatch, EngineState, GroupQualificationConfig, KnockoutTemplate, MatchSelection, MatchSelections, TournamentMode } from "../tournament";

export interface SimulationSnapshotRecord {
  id: string;
  publicSnapshotId: string;
  tournamentRuleVersionId: string;
  mode: TournamentMode;
  createdAt: string;
  metadata: Record<string, unknown>;
}
export interface TieResolutionSubmission { groupId: string; orderedTeamIds: string[] }
export interface SimulationBundle { snapshot: SimulationSnapshotRecord; matches: EngineMatch[]; selections: MatchSelections; tieDecisions: TieResolutionSubmission[] }
export interface CreateSimulationInput { tournamentRuleVersionId: string; mode: TournamentMode; metadata?: Record<string, unknown> }
export interface PredictInput { matchId: string; selection: MatchSelection }
export interface SimulationReadRepository {
  getMatchesForRuleVersion(ruleVersionId: string): Promise<EngineMatch[]>;
  getBundleBySnapshotId(snapshotId: string): Promise<SimulationBundle | null>;
  getBundleByPublicSnapshotId(publicSnapshotId: string): Promise<SimulationBundle | null>;
  getGroupQualificationConfig(ruleVersionId: string): Promise<GroupQualificationConfig[]>;
  getKnockoutTemplate(ruleVersionId: string): Promise<KnockoutTemplate>;
}
export interface SimulationWriteRepository {
  createSnapshot(input: CreateSimulationInput): Promise<SimulationSnapshotRecord>;
  createSnapshotSelections(snapshotId: string, selections: MatchSelections): Promise<void>;
  createTieDecisions(snapshotId: string, decisions: TieResolutionSubmission[]): Promise<void>;
}
export type SimulationRepository = SimulationReadRepository & SimulationWriteRepository;
export interface SnapshotReconstruction { snapshot: SimulationSnapshotRecord; state: EngineState }
