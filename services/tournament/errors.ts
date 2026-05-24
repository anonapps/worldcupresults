export class TournamentEngineError extends Error {}

export class TieResolutionRequiredError extends TournamentEngineError {
  constructor(message: string) {
    super(message);
    this.name = "TieResolutionRequiredError";
  }
}

export class ModeViolationError extends TournamentEngineError {
  constructor(message: string) {
    super(message);
    this.name = "ModeViolationError";
  }
}
