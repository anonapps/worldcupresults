import type { ProviderPullResult } from "../../providers/types";
import type { NormalizedPayload } from "./types";

const dedupeBy = <T>(items: T[], key: (item: T) => string): T[] => {
  const map = new Map<string, T>();
  for (const item of items) map.set(key(item), item);
  return [...map.values()];
};

export class SyncNormalizer {
  normalize(raw: ProviderPullResult): NormalizedPayload {
    return {
      teams: dedupeBy(
        raw.teams.map((t) => ({ externalSourceId: t.sourceTeamId, name: t.name.trim(), fifaCode: t.fifaCode })),
        (t) => t.externalSourceId,
      ),
      matches: dedupeBy(
        raw.matches.map((m) => ({
          externalSourceId: m.sourceMatchId,
          homeExternalTeamId: m.homeSourceTeamId,
          awayExternalTeamId: m.awaySourceTeamId,
          scheduledAt: m.kickoffAt,
          status: m.status,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
        })),
        (m) => m.externalSourceId,
      ),
      tournamentRuleVersions: dedupeBy(
        raw.tournamentRuleVersions.map((r) => ({ externalSourceId: r.sourceRuleVersionId, label: r.label, effectiveFrom: r.effectiveFrom })),
        (r) => r.externalSourceId,
      ),
      checkpoint: raw.checkpoint,
    };
  }
}
