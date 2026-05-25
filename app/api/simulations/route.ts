import { NextResponse } from "next/server";

import { getSimulationRepository } from "../../../lib/simulator-repository";
import { SimulatorService, toHttpError, ValidationError } from "../../../services/simulator/service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { tournamentRuleVersionId?: string; mode?: "LIVE_REALITY" | "FULL_SIMULATION" | "MIXED_PREDICTION"; metadata?: Record<string, unknown> };
    if (!body.tournamentRuleVersionId || !body.mode) throw new ValidationError("tournamentRuleVersionId and mode are required");
    const snapshot = await new SimulatorService(getSimulationRepository()).createSimulation(body);
    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    const mapped = toHttpError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
