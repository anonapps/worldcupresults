import { NextResponse } from "next/server";

import { getSimulationRepository } from "../../../lib/simulator-repository";
import { SimulatorService, toHttpError, ValidationError } from "../../../services/simulator/service";
import type { CreateSimulationInput } from "../../../services/simulator/types";
import type { TournamentMode } from "../../../services/tournament";

const isTournamentMode = (value: unknown): value is TournamentMode =>
  value === "LIVE_REALITY" || value === "FULL_SIMULATION" || value === "MIXED_PREDICTION";

const parseCreateSimulationDto = (value: unknown): CreateSimulationInput => {
  if (!value || typeof value !== "object") throw new ValidationError("Request body must be an object");

  const candidate = value as Record<string, unknown>;
  const tournamentRuleVersionId = candidate.tournamentRuleVersionId;
  const mode = candidate.mode;
  const metadata = candidate.metadata;

  if (typeof tournamentRuleVersionId !== "string" || tournamentRuleVersionId.trim().length === 0) {
    throw new ValidationError("tournamentRuleVersionId is required");
  }

  if (!isTournamentMode(mode)) {
    throw new ValidationError("mode must be one of LIVE_REALITY, FULL_SIMULATION, MIXED_PREDICTION");
  }

  if (metadata !== undefined && (typeof metadata !== "object" || metadata === null || Array.isArray(metadata))) {
    throw new ValidationError("metadata must be an object when provided");
  }

  return {
    tournamentRuleVersionId,
    mode,
    metadata: (metadata as Record<string, unknown> | undefined) ?? undefined,
  };
};

export async function POST(request: Request) {
  try {
    const payload = parseCreateSimulationDto(await request.json());
    const snapshot = await new SimulatorService(getSimulationRepository()).createSimulation(payload);
    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    const mapped = toHttpError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
