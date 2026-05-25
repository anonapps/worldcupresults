import type { SourceProviderRegistry } from "../../providers/registry";
import type { SyncNormalizer } from "./normalizer";
import { waitFor } from "./retry";
import type { RetryPolicy, SyncAuditLogger, SyncRepository } from "./types";

export class SyncOrchestrator {
  constructor(
    private readonly providers: SourceProviderRegistry,
    private readonly normalizer: SyncNormalizer,
    private readonly repository: SyncRepository,
    private readonly auditLogger: SyncAuditLogger,
    private readonly retryPolicy: RetryPolicy,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async run(sourceId: string): Promise<{ runId: string; attempts: number }> {
    const source = await this.repository.getSourceOrThrow(sourceId);
    const adapter = this.providers.getOrThrow(source.providerKey);
    const run = await this.repository.createRun(source.id);
    await this.repository.markRunRunning(run.id);

    await this.auditLogger.onEvent({ runId: run.id, sourceId: source.id, event: "run_started", details: { provider: adapter.descriptor.key }, at: this.now() });

    let attempt = 0;
    while (true) {
      attempt += 1;
      try {
        const raw = await adapter.pull({ sourceId: source.id, runId: run.id, nowIso: this.now() }, source.lastCheckpoint);
        const normalized = this.normalizer.normalize(raw);

        await this.repository.upsertTeams(normalized.teams);
        await this.repository.upsertMatches(normalized.matches);
        await this.repository.upsertTournamentRuleVersions(normalized.tournamentRuleVersions);
        await this.repository.updateSourceCheckpoint(source.id, normalized.checkpoint);
        await this.repository.markRunCompleted(run.id);

        await this.auditLogger.onEvent({ runId: run.id, sourceId: source.id, event: "run_completed", details: { attempts: attempt }, at: this.now() });
        return { runId: run.id, attempts: attempt };
      } catch (error) {
        const shouldRetry = this.retryPolicy.shouldRetry(error, attempt);
        await this.auditLogger.onEvent({
          runId: run.id,
          sourceId: source.id,
          event: shouldRetry ? "run_retry_scheduled" : "run_failed",
          details: { attempt, message: error instanceof Error ? error.message : "unknown_error" },
          at: this.now(),
        });

        if (!shouldRetry) {
          const message = error instanceof Error ? error.message : "unknown_error";
          await this.repository.markRunFailed(run.id, "SYNC_RUN_FAILURE", message, attempt - 1);
          throw error;
        }

        await waitFor(this.retryPolicy.baseDelayMs * attempt);
      }
    }
  }
}
