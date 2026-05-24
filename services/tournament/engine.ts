import { ModeViolationError, TieResolutionRequiredError } from "./errors";
import type {
  EngineMatch,
  EngineState,
  GroupQualificationConfig,
  GroupStandingRow,
  GroupStandingTable,
  KnockoutTemplate,
  MatchSelection,
  MatchSelections,
  MutationInput,
  StateTransitionResult,
  TieResolutionDecision,
  TournamentEngineService,
  TournamentMode,
} from "./types";

const isKnockout = (stage: EngineMatch["stage"]): boolean => stage !== "group";

const pointsFor = (selection: MatchSelection, team: "home" | "away"): number => {
  if (selection.outcome === "DRAW") return 1;
  if (selection.outcome === "HOME_WIN") return team === "home" ? 3 : 0;
  return team === "away" ? 3 : 0;
};

export class DeterministicTournamentEngine implements TournamentEngineService {
  calculateStandings(matches: EngineMatch[], selections: MatchSelections): GroupStandingTable[] {
    const grouped = new Map<string, Map<string, GroupStandingRow>>();

    for (const match of matches) {
      if (match.stage !== "group" || !match.groupId) continue;
      const selected = selections[match.id];
      if (!selected) continue;

      if (!grouped.has(match.groupId)) grouped.set(match.groupId, new Map());
      const table = grouped.get(match.groupId)!;

      const home = table.get(match.homeTeamId) ?? {
        groupId: match.groupId,
        teamId: match.homeTeamId,
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
      };
      const away = table.get(match.awayTeamId) ?? {
        groupId: match.groupId,
        teamId: match.awayTeamId,
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
      };

      home.points += pointsFor(selected, "home");
      away.points += pointsFor(selected, "away");

      if (selected.outcome === "DRAW") {
        home.draws += 1;
        away.draws += 1;
      } else if (selected.outcome === "HOME_WIN") {
        home.wins += 1;
        away.losses += 1;
      } else {
        away.wins += 1;
        home.losses += 1;
      }

      table.set(home.teamId, home);
      table.set(away.teamId, away);
    }

    return [...grouped.entries()].map(([groupId, byTeam]) => {
      const rows = [...byTeam.values()].sort((a, b) => b.points - a.points || a.teamId.localeCompare(b.teamId));
      const buckets = new Map<number, string[]>();
      for (const row of rows) {
        const bucket = buckets.get(row.points) ?? [];
        bucket.push(row.teamId);
        buckets.set(row.points, bucket);
      }

      const unresolvedTies = [...buckets.entries()]
        .filter(([, teamIds]) => teamIds.length > 1)
        .map(([points, teamIds]) => ({ points, teamIds: [...teamIds] }));

      return { groupId, rows, unresolvedTies };
    });
  }

  resolveGroupQualifications(
    standings: GroupStandingTable[],
    configs: GroupQualificationConfig[],
    tieDecisions: TieResolutionDecision[],
  ): Record<string, string[]> {
    const decisionsByGroup = new Map(tieDecisions.map((d) => [d.groupId, d.orderedTeamIds]));
    const configByGroup = new Map(configs.map((c) => [c.groupId, c.qualifiedCount]));
    const qualifiers: Record<string, string[]> = {};

    for (const table of standings) {
      const qualifiedCount = configByGroup.get(table.groupId) ?? 2;
      const unresolved = table.unresolvedTies.find((tie: { teamIds: string[]; points: number }) => {
        const rowsAhead = table.rows.filter((r: GroupStandingRow) => r.points > tie.points).length;
        return rowsAhead < qualifiedCount;
      });

      if (unresolved) {
        const decision = decisionsByGroup.get(table.groupId);
        if (!decision) throw new TieResolutionRequiredError(`Tie decision required for group ${table.groupId}`);

        const decisionSet = new Set(decision);
        if (decision.length !== unresolved.teamIds.length || unresolved.teamIds.some((id: string) => !decisionSet.has(id))) {
          throw new TieResolutionRequiredError(`Invalid tie decision for group ${table.groupId}`);
        }

        const rowsAhead = table.rows.filter((r: GroupStandingRow) => r.points > unresolved.points).map((r: GroupStandingRow) => r.teamId);
        const spotsLeft = qualifiedCount - rowsAhead.length;
        qualifiers[table.groupId] = [...rowsAhead, ...decision.slice(0, spotsLeft)];
      } else {
        qualifiers[table.groupId] = table.rows.slice(0, qualifiedCount).map((r: GroupStandingRow) => r.teamId);
      }
    }

    return qualifiers;
  }

  generateBracket(qualifiers: Record<string, string[]>, template: KnockoutTemplate): Record<string, { homeTeamId: string; awayTeamId: string }> {
    const resolveSource = (source: string): string => {
      const [groupId, posRaw] = source.split(":");
      const pos = Number(posRaw) - 1;
      if (!qualifiers[groupId] || !qualifiers[groupId][pos]) throw new Error(`Missing qualifier for source ${source}`);
      return qualifiers[groupId][pos];
    };

    const result: Record<string, { homeTeamId: string; awayTeamId: string }> = {};
    for (const slot of template.slots) {
      result[slot.matchId] = { homeTeamId: resolveSource(slot.homeSource), awayTeamId: resolveSource(slot.awaySource) };
    }
    return result;
  }

  applyMutation(state: EngineState, mutation: MutationInput): StateTransitionResult {
    const match = state.matches.find((m: EngineMatch) => m.id === mutation.matchId);
    if (!match) throw new Error(`Unknown match ${mutation.matchId}`);
    if (!this.canEditMatch(state.mode, match)) throw new ModeViolationError(`Match ${match.id} is locked for mode ${state.mode}`);

    this.validateSelection(match, mutation.selection);

    const selections = { ...state.selections, [mutation.matchId]: mutation.selection };
    const invalidatedMatchIds = this.findDependentMatches(state.matches, mutation.matchId);
    for (const id of invalidatedMatchIds) delete selections[id];

    return {
      state: { ...state, selections, version: state.version + 1 },
      invalidatedMatchIds,
    };
  }

  reconstructSnapshot(base: EngineState, mutations: MutationInput[]): EngineState {
    let state = structuredClone(base);
    for (const mutation of mutations) {
      state = this.applyMutation(state, mutation).state;
    }
    return state;
  }

  canEditMatch(mode: TournamentMode, match: EngineMatch): boolean {
    if (mode === "FULL_SIMULATION") return true;
    if (mode === "LIVE_REALITY") return false;
    return !match.played;
  }

  private validateSelection(match: EngineMatch, selection: MatchSelection): void {
    if (selection.outcome === "DRAW" && selection.winnerTeamId !== null) {
      throw new Error(`Draw selection for match ${match.id} must have null winnerTeamId`);
    }

    if (selection.outcome === "HOME_WIN" && selection.winnerTeamId !== match.homeTeamId) {
      throw new Error(`Home win selection for match ${match.id} must use home team as winner`);
    }

    if (selection.outcome === "AWAY_WIN" && selection.winnerTeamId !== match.awayTeamId) {
      throw new Error(`Away win selection for match ${match.id} must use away team as winner`);
    }
  }

  private findDependentMatches(matches: EngineMatch[], changedMatchId: string): string[] {
    const changed = matches.find((m) => m.id === changedMatchId);
    if (!changed) return [];
    if (!isKnockout(changed.stage)) return matches.filter((m) => isKnockout(m.stage)).map((m) => m.id);

    const stageOrder: EngineMatch["stage"][] = ["round_of_32", "round_of_16", "quarter_final", "semi_final", "third_place", "final"];
    const idx = stageOrder.indexOf(changed.stage);
    if (idx < 0) return [];
    const downstream = new Set(stageOrder.slice(idx + 1));
    return matches.filter((m) => downstream.has(m.stage)).map((m) => m.id);
  }
}
