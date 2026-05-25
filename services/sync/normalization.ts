import { NormalizationError } from "./errors";
import type { NormalizedDataset, NormalizedMatch, NormalizedTeam, SourcePayload, SyncSourceRecord } from "./types";

const assertIsoDate = (value: string, field: string): void => {
  if (Number.isNaN(Date.parse(value))) throw new NormalizationError(`${field} must be an ISO date string`);
};

const assertFifaCode = (value: string): void => {
  if (!/^[A-Z]{3}$/.test(value)) throw new NormalizationError(`Invalid FIFA team code ${value}`);
};

const assertUnique = <T>(items: T[], keyFor: (item: T) => string, label: string): void => {
  const seen = new Set<string>();
  for (const item of items) {
    const key = keyFor(item);
    if (seen.has(key)) throw new NormalizationError(`Duplicate ${label} ${key}`);
    seen.add(key);
  }
};

export const normalizeSourcePayload = (
  source: SyncSourceRecord,
  payload: SourcePayload,
  tournamentRuleVersionId: string,
): NormalizedDataset => {
  assertIsoDate(payload.fetchedAt, "fetchedAt");
  assertUnique(payload.teams, (team) => team.providerTeamId, "provider team id");
  assertUnique(payload.teams, (team) => team.fifaCode, "FIFA team code");
  assertUnique(payload.matches, (match) => match.providerMatchId, "provider match id");
  assertUnique(payload.tournamentRuleVersions, (version) => version.versionName, "rule version");

  const teamCodesByProviderId = new Map<string, string>();
  const teams: NormalizedTeam[] = payload.teams.map((team) => {
    assertFifaCode(team.fifaCode);
    teamCodesByProviderId.set(team.providerTeamId, team.fifaCode);
    return {
      fifa_code: team.fifaCode,
      name_es: team.name,
      flag_url: team.flagUrl,
      confederation: team.confederation,
    };
  });

  const matches: NormalizedMatch[] = payload.matches.map((match) => {
    assertIsoDate(match.scheduledAt, "scheduledAt");
    const homeCode = teamCodesByProviderId.get(match.homeTeamProviderId);
    const awayCode = teamCodesByProviderId.get(match.awayTeamProviderId);
    const winnerCode = match.winnerTeamProviderId ? teamCodesByProviderId.get(match.winnerTeamProviderId) : null;

    if (!homeCode) throw new NormalizationError(`Unknown home team ${match.homeTeamProviderId} for match ${match.providerMatchId}`);
    if (!awayCode) throw new NormalizationError(`Unknown away team ${match.awayTeamProviderId} for match ${match.providerMatchId}`);
    if (match.winnerTeamProviderId && !winnerCode) {
      throw new NormalizationError(`Unknown winner team ${match.winnerTeamProviderId} for match ${match.providerMatchId}`);
    }
    if (winnerCode && winnerCode !== homeCode && winnerCode !== awayCode) {
      throw new NormalizationError(`Winner team must be home or away for match ${match.providerMatchId}`);
    }

    return {
      tournament_rule_version_id: match.tournamentRuleVersionId ?? tournamentRuleVersionId,
      stage: match.stage,
      group_id: match.groupId,
      home_team_fifa_code: homeCode,
      away_team_fifa_code: awayCode,
      scheduled_at: match.scheduledAt,
      status: match.status,
      source_type: "sync",
      source_reference: `${source.source_name}:${match.providerMatchId}`,
      winner_team_fifa_code: winnerCode,
    };
  });

  return {
    source,
    fetchedAt: payload.fetchedAt,
    watermark: payload.watermark,
    teams,
    matches,
    tournamentRuleVersions: payload.tournamentRuleVersions.map((version) => {
      assertIsoDate(version.effectiveFrom, "effectiveFrom");
      return {
        version_name: version.versionName,
        effective_from: version.effectiveFrom,
        description: version.description,
        rules_payload: version.rulesPayload,
      };
    }),
  };
};
