import assert from "node:assert/strict";
import test from "node:test";

import { DeterministicTournamentEngine, TieResolutionRequiredError, type EngineMatch, type EngineState } from "../../services/tournament";

const engine = new DeterministicTournamentEngine();

const groupMatches: EngineMatch[] = [
  { id: "m1", stage: "group", groupId: "A", homeTeamId: "T1", awayTeamId: "T2", scheduledAt: "2026-01-01T00:00:00Z", status: "completed", played: true },
  { id: "m2", stage: "group", groupId: "A", homeTeamId: "T3", awayTeamId: "T4", scheduledAt: "2026-01-01T00:00:00Z", status: "completed", played: true },
  { id: "m3", stage: "group", groupId: "A", homeTeamId: "T1", awayTeamId: "T3", scheduledAt: "2026-01-01T00:00:00Z", status: "completed", played: true },
  { id: "m4", stage: "group", groupId: "A", homeTeamId: "T2", awayTeamId: "T4", scheduledAt: "2026-01-01T00:00:00Z", status: "completed", played: true },
];

test("calculates standings using points only", () => {
  const standings = engine.calculateStandings(groupMatches, {
    m1: { outcome: "HOME_WIN", winnerTeamId: "T1" },
    m2: { outcome: "HOME_WIN", winnerTeamId: "T3" },
    m3: { outcome: "DRAW", winnerTeamId: null },
    m4: { outcome: "AWAY_WIN", winnerTeamId: "T4" },
  });

  assert.equal(standings.length, 1);
  const table = standings[0];
  const top = table.rows[0];
  assert.equal(top.teamId, "T1");
  assert.equal(top.points, 4);
});

test("requires explicit tie resolution when tie affects qualification", () => {
  const standings = engine.calculateStandings(groupMatches, {
    m1: { outcome: "DRAW", winnerTeamId: null },
    m2: { outcome: "DRAW", winnerTeamId: null },
    m3: { outcome: "DRAW", winnerTeamId: null },
    m4: { outcome: "DRAW", winnerTeamId: null },
  });

  assert.throws(
    () => engine.resolveGroupQualifications(standings, [{ groupId: "A", qualifiedCount: 2 }], []),
    TieResolutionRequiredError,
  );
});

test("builds qualifiers with provided tie decision and generates bracket", () => {
  const standings = engine.calculateStandings(groupMatches, {
    m1: { outcome: "DRAW", winnerTeamId: null },
    m2: { outcome: "DRAW", winnerTeamId: null },
    m3: { outcome: "DRAW", winnerTeamId: null },
    m4: { outcome: "DRAW", winnerTeamId: null },
  });

  const qualifiers = engine.resolveGroupQualifications(
    standings,
    [{ groupId: "A", qualifiedCount: 2 }, { groupId: "B", qualifiedCount: 2 }],
    [{ groupId: "A", orderedTeamIds: ["T1", "T2", "T3", "T4"] }],
  );
  qualifiers.B = ["U1", "U2"];

  const bracket = engine.generateBracket(qualifiers, {
    slots: [{ stage: "round_of_32", matchId: "k1", homeSource: "A:1", awaySource: "B:2" }],
  });

  assert.deepEqual(bracket.k1, { homeTeamId: "T1", awayTeamId: "U2" });
});

test("invalidates downstream picks after earlier mutation", () => {
  const state: EngineState = {
    mode: "FULL_SIMULATION",
    version: 1,
    createdAt: "2026-01-01T00:00:00Z",
    matches: [
      ...groupMatches,
      { id: "k1", stage: "round_of_16", groupId: null, homeTeamId: "T1", awayTeamId: "T2", scheduledAt: "2026-01-02T00:00:00Z", status: "scheduled", played: false },
      { id: "k2", stage: "quarter_final", groupId: null, homeTeamId: "T3", awayTeamId: "T4", scheduledAt: "2026-01-03T00:00:00Z", status: "scheduled", played: false },
    ],
    selections: {
      m1: { outcome: "HOME_WIN", winnerTeamId: "T1" },
      k1: { outcome: "HOME_WIN", winnerTeamId: "T1" },
      k2: { outcome: "AWAY_WIN", winnerTeamId: "T4" },
    },
  };

  const result = engine.applyMutation(state, { matchId: "m1", selection: { outcome: "DRAW", winnerTeamId: null } });
  assert.ok(result.invalidatedMatchIds.includes("k1"));
  assert.ok(result.invalidatedMatchIds.includes("k2"));
  assert.equal(result.state.selections.k1, undefined);
});

test("mode enforcement locks played matches in LIVE_REALITY and MIXED_PREDICTION", () => {
  const played: EngineMatch = { id: "p1", stage: "group", groupId: "A", homeTeamId: "T1", awayTeamId: "T2", scheduledAt: "2026-01-01T00:00:00Z", status: "completed", played: true };
  const future: EngineMatch = { ...played, id: "f1", played: false, status: "scheduled" };

  assert.equal(engine.canEditMatch("LIVE_REALITY", played), false);
  assert.equal(engine.canEditMatch("LIVE_REALITY", future), false);
  assert.equal(engine.canEditMatch("MIXED_PREDICTION", played), false);
  assert.equal(engine.canEditMatch("MIXED_PREDICTION", future), true);
  assert.equal(engine.canEditMatch("FULL_SIMULATION", played), true);
});


test("rejects inconsistent match selection payloads", () => {
  const state: EngineState = {
    mode: "FULL_SIMULATION",
    version: 1,
    createdAt: "2026-01-01T00:00:00Z",
    matches: [...groupMatches],
    selections: {},
  };

  assert.throws(
    () => engine.applyMutation(state, { matchId: "m1", selection: { outcome: "HOME_WIN", winnerTeamId: "T2" } }),
    /home team as winner/,
  );

  assert.throws(
    () => engine.applyMutation(state, { matchId: "m1", selection: { outcome: "AWAY_WIN", winnerTeamId: "T1" } }),
    /away team as winner/,
  );

  assert.throws(
    () => engine.applyMutation(state, { matchId: "m1", selection: { outcome: "DRAW", winnerTeamId: "T1" } }),
    /null winnerTeamId/,
  );
});

test("does not rely on alphabetical ordering when tie does not affect qualification", () => {
  const standings = engine.calculateStandings(groupMatches, {
    m1: { outcome: "HOME_WIN", winnerTeamId: "T1" },
    m2: { outcome: "HOME_WIN", winnerTeamId: "T3" },
    m3: { outcome: "HOME_WIN", winnerTeamId: "T1" },
    m4: { outcome: "HOME_WIN", winnerTeamId: "T2" },
  });

  const qualifiers = engine.resolveGroupQualifications(standings, [{ groupId: "A", qualifiedCount: 1 }], []);
  assert.deepEqual(qualifiers.A, ["T1"]);
});
