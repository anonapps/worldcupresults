import type {
  NormalizedDataset,
  NormalizedMatch,
  NormalizedTeam,
  NormalizedTournamentRuleVersion,
  PersistenceSummary,
  SyncPersistenceAdapter,
  UUID,
} from "./types";

export type TeamUpsert = NormalizedTeam;
export type TournamentRuleVersionUpsert = NormalizedTournamentRuleVersion;

export interface MatchUpsert {
  tournament_rule_version_id: UUID;
  stage: NormalizedMatch["stage"];
  group_id: UUID | null;
  home_team_id: UUID;
  away_team_id: UUID;
  scheduled_at: string;
  status: NormalizedMatch["status"];
  source_type: "sync";
  source_reference: string;
  winner_team_id: UUID | null;
}

export interface TeamLookupRepository {
  findIdsByFifaCode(fifaCodes: string[]): Promise<Map<string, UUID>>;
}

export interface TournamentDataRepository {
  upsertTeams(teams: TeamUpsert[]): Promise<number>;
  upsertTournamentRuleVersions(versions: TournamentRuleVersionUpsert[]): Promise<number>;
  upsertMatches(matches: MatchUpsert[]): Promise<number>;
}

export interface PersistenceOperations {
  teams: TeamUpsert[];
  tournamentRuleVersions: TournamentRuleVersionUpsert[];
  matches: MatchUpsert[];
}

export const buildPersistenceOperations = async (
  dataset: NormalizedDataset,
  teamLookup: TeamLookupRepository,
): Promise<PersistenceOperations> => {
  const neededCodes = new Set<string>();
  for (const team of dataset.teams) neededCodes.add(team.fifa_code);
  for (const match of dataset.matches) {
    neededCodes.add(match.home_team_fifa_code);
    neededCodes.add(match.away_team_fifa_code);
    if (match.winner_team_fifa_code) neededCodes.add(match.winner_team_fifa_code);
  }

  const teamIdsByCode = await teamLookup.findIdsByFifaCode([...neededCodes]);
  const requireTeamId = (code: string): UUID => {
    const id = teamIdsByCode.get(code);
    if (!id) throw new Error(`Missing persisted team id for FIFA code ${code}`);
    return id;
  };

  return {
    teams: dataset.teams,
    tournamentRuleVersions: dataset.tournamentRuleVersions,
    matches: dataset.matches.map((match) => ({
      tournament_rule_version_id: match.tournament_rule_version_id,
      stage: match.stage,
      group_id: match.group_id,
      home_team_id: requireTeamId(match.home_team_fifa_code),
      away_team_id: requireTeamId(match.away_team_fifa_code),
      scheduled_at: match.scheduled_at,
      status: match.status,
      source_type: "sync",
      source_reference: match.source_reference,
      winner_team_id: match.winner_team_fifa_code ? requireTeamId(match.winner_team_fifa_code) : null,
    })),
  };
};

export class RepositorySyncPersistenceAdapter implements SyncPersistenceAdapter {
  constructor(
    private readonly teamLookup: TeamLookupRepository,
    private readonly repository: TournamentDataRepository,
  ) {}

  async persist(dataset: NormalizedDataset): Promise<PersistenceSummary> {
    const teams = await this.repository.upsertTeams(dataset.teams);
    const tournamentRuleVersions = await this.repository.upsertTournamentRuleVersions(dataset.tournamentRuleVersions);
    const operations = await buildPersistenceOperations(dataset, this.teamLookup);
    const matches = await this.repository.upsertMatches(operations.matches);
    return { teams, tournamentRuleVersions, matches };
  }
}
