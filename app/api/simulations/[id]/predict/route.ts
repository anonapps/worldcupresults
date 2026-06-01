import { NextResponse } from "next/server";
import { getSimulationRepository } from "../../../../../lib/simulator-repository";
import { SimulatorService, toHttpError } from "../../../../../services/simulator/service";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const data = await new SimulatorService(getSimulationRepository()).predict(id, body);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const mapped = toHttpError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
