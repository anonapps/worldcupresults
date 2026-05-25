import { NextResponse } from "next/server";
import { getSimulationRepository } from "../../../../lib/simulator-repository";
import { SimulatorService, toHttpError } from "../../../../services/simulator/service";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const data = await new SimulatorService(getSimulationRepository()).reconstruct(id);
    return NextResponse.json(data);
  } catch (error) {
    const mapped = toHttpError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
