import { DeterministicTournamentEngine, TieResolutionRequiredError, type EngineState, type MatchSelections } from "../tournament";
import type { CreateSimulationInput, PredictInput, SimulationRepository, SnapshotReconstruction, TieResolutionSubmission } from "./types";

export class NotFoundError extends Error {}
export class ValidationError extends Error {}

export class SimulatorService {
  constructor(private readonly repo: SimulationRepository, private readonly engine = new DeterministicTournamentEngine(), private readonly now: () => string = () => new Date().toISOString()) {}

  async createSimulation(input: CreateSimulationInput) {
    const matches = await this.repo.getMatchesForRuleVersion(input.tournamentRuleVersionId);
    if (matches.length === 0) throw new ValidationError("No matches found for tournament rule version");
    const snapshot = await this.repo.createSnapshot(input);
    await this.repo.createSnapshotSelections(snapshot.id, {});
    return snapshot;
  }

  async reconstruct(snapshotId: string): Promise<SnapshotReconstruction> {
    const bundle = await this.repo.getBundleBySnapshotId(snapshotId);
    if (!bundle) throw new NotFoundError("Simulation snapshot not found");
    return { snapshot: bundle.snapshot, state: this.buildState(bundle.matches, bundle.snapshot.mode, bundle.selections) };
  }

  async predict(snapshotId: string, input: PredictInput): Promise<SnapshotReconstruction> {
    const reconstructed = await this.reconstruct(snapshotId);
    const result = this.engine.applyMutation(reconstructed.state, { matchId: input.matchId, selection: input.selection });
    const next = await this.repo.createSnapshot({ tournamentRuleVersionId: reconstructed.snapshot.tournamentRuleVersionId, mode: reconstructed.snapshot.mode, metadata: { parentSnapshotId: snapshotId, createdBy: "predict", at: this.now() } });
    await this.repo.createSnapshotSelections(next.id, result.state.selections);
    return { snapshot: next, state: result.state };
  }

  async submitTieResolution(snapshotId: string, submissions: TieResolutionSubmission[]): Promise<SnapshotReconstruction> {
    const reconstructed = await this.reconstruct(snapshotId);
    const next = await this.repo.createSnapshot({ tournamentRuleVersionId: reconstructed.snapshot.tournamentRuleVersionId, mode: reconstructed.snapshot.mode, metadata: { parentSnapshotId: snapshotId, createdBy: "tie-resolution", at: this.now() } });
    await this.repo.createSnapshotSelections(next.id, reconstructed.state.selections);
    await this.repo.createTieDecisions(next.id, submissions);
    return this.reconstruct(next.id);
  }

  async getStandings(snapshotId: string) {
    const bundle = await this.repo.getBundleBySnapshotId(snapshotId);
    if (!bundle) throw new NotFoundError("Simulation snapshot not found");
    return this.engine.calculateStandings(bundle.matches, bundle.selections);
  }

  async getBracket(snapshotId: string) {
    const bundle = await this.repo.getBundleBySnapshotId(snapshotId);
    if (!bundle) throw new NotFoundError("Simulation snapshot not found");
    const standings = this.engine.calculateStandings(bundle.matches, bundle.selections);
    const qualifiers = this.engine.resolveGroupQualifications(
      standings,
      await this.repo.getGroupQualificationConfig(bundle.snapshot.tournamentRuleVersionId),
      bundle.tieDecisions,
    );
    return this.engine.generateBracket(qualifiers, await this.repo.getKnockoutTemplate(bundle.snapshot.tournamentRuleVersionId));
  }

  async getShared(publicSnapshotId: string): Promise<SnapshotReconstruction> {
    const bundle = await this.repo.getBundleByPublicSnapshotId(publicSnapshotId);
    if (!bundle) throw new NotFoundError("Public simulation snapshot not found");
    return { snapshot: bundle.snapshot, state: this.buildState(bundle.matches, bundle.snapshot.mode, bundle.selections) };
  }

  private buildState(matches: EngineState["matches"], mode: EngineState["mode"], selections: MatchSelections): EngineState {
    return { matches, mode, selections, createdAt: this.now(), version: 1 };
  }
}

export const toHttpError = (error: unknown): { status: number; body: Record<string, unknown> } => {
  if (error instanceof NotFoundError) return { status: 404, body: { error: error.message } };
  if (error instanceof ValidationError || error instanceof TieResolutionRequiredError) return { status: 400, body: { error: error.message } };
  if (error instanceof Error) return { status: 500, body: { error: error.message } };
  return { status: 500, body: { error: "Unknown error" } };
};
