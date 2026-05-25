import assert from "node:assert/strict";
import test from "node:test";

import { InMemorySimulationRepository } from "../../lib/simulator-repository";
import { SimulatorService } from "../../services/simulator/service";

const match = { id: "m1", stage: "group" as const, groupId: "g1", homeTeamId: "t1", awayTeamId: "t2", scheduledAt: "2026-01-01T00:00:00Z", status: "scheduled" as const, played: false };

test("simulation creation + reconstruction + share", async () => {
  const repo = new InMemorySimulationRepository();
  repo.matchesByVersion.set("rv1", [match]);
  repo.configsByVersion.set("rv1", [{ groupId: "g1", qualifiedCount: 1 }]);
  repo.templatesByVersion.set("rv1", { slots: [] });

  const service = new SimulatorService(repo, undefined, () => "2026-01-01T00:00:00Z");
  const created = await service.createSimulation({ tournamentRuleVersionId: "rv1", mode: "FULL_SIMULATION" });
  const reconstructed = await service.reconstruct(created.id);
  const shared = await service.getShared(created.publicSnapshotId);

  assert.equal(reconstructed.snapshot.id, created.id);
  assert.equal(shared.snapshot.id, created.id);
});

test("prediction mutation creates immutable child snapshot", async () => {
  const repo = new InMemorySimulationRepository();
  repo.matchesByVersion.set("rv1", [match]);
  repo.configsByVersion.set("rv1", [{ groupId: "g1", qualifiedCount: 1 }]);
  repo.templatesByVersion.set("rv1", { slots: [] });

  const service = new SimulatorService(repo, undefined, () => "2026-01-01T00:00:00Z");
  const created = await service.createSimulation({ tournamentRuleVersionId: "rv1", mode: "FULL_SIMULATION" });
  const predicted = await service.predict(created.id, { matchId: "m1", selection: { outcome: "HOME_WIN", winnerTeamId: "t1" } });

  assert.notEqual(predicted.snapshot.id, created.id);
  assert.equal(predicted.state.selections.m1.winnerTeamId, "t1");
});
