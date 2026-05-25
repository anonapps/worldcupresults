import { InactiveSyncSourceError, SyncSourceNotFoundError } from "./errors";
import { normalizeSourcePayload } from "./normalization";
import type {
  Clock,
  RetryPolicy,
  Sleep,
  SyncAuditLogger,
  SyncPersistenceAdapter,
  SyncRequest,
  SyncResult,
  SyncRunRepository,
  SyncSourceRepository,
  WorldCupSourceAdapter,
} from "./types";

const defaultClock: Clock = { now: () => new Date().toISOString() };
const defaultSleep: Sleep = () => Promise.resolve();

export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  shouldRetry: (_error, attempt) => attempt < 3,
};

export class SyncOrchestrationService {
  private readonly adaptersBySourceName: Map<string, WorldCupSourceAdapter>;

  constructor(
    adapters: WorldCupSourceAdapter[],
    private readonly sources: SyncSourceRepository,
    private readonly runs: SyncRunRepository,
    private readonly persistence: SyncPersistenceAdapter,
    private readonly audit: SyncAuditLogger,
    private readonly retryPolicy: RetryPolicy = defaultRetryPolicy,
    private readonly clock: Clock = defaultClock,
    private readonly sleep: Sleep = defaultSleep,
  ) {
    this.adaptersBySourceName = new Map(adapters.map((adapter) => [adapter.sourceName, adapter]));
  }

  async sync(request: SyncRequest): Promise<SyncResult> {
    const source = await this.sources.findByName(request.sourceName);
    if (!source) throw new SyncSourceNotFoundError(request.sourceName);
    if (!source.is_active) throw new InactiveSyncSourceError(request.sourceName);

    const adapter = this.adaptersBySourceName.get(source.source_name);
    if (!adapter) throw new SyncSourceNotFoundError(source.source_name);

    const run = await this.runs.start(source.id, {
      provider: adapter.provider,
      sourceName: source.source_name,
      tournamentRuleVersionId: request.tournamentRuleVersionId ?? null,
    });

    await this.audit.record({
      type: "sync_started",
      sourceName: source.source_name,
      runId: run.id,
      attempt: 1,
      at: this.clock.now(),
      details: { provider: adapter.provider },
    });

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.retryPolicy.maxAttempts; attempt += 1) {
      try {
        const payload = await adapter.fetch({
          source,
          tournamentRuleVersionId: request.tournamentRuleVersionId,
          requestedAt: this.clock.now(),
        });
        const dataset = normalizeSourcePayload(source, payload, request.tournamentRuleVersionId ?? "");
        const summary = await this.persistence.persist(dataset);
        const completedRun = await this.runs.succeed(run.id, {
          attempts: attempt,
          fetchedAt: dataset.fetchedAt,
          watermark: dataset.watermark,
          summary,
        });
        await this.audit.record({
          type: "sync_succeeded",
          sourceName: source.source_name,
          runId: run.id,
          attempt,
          at: this.clock.now(),
          details: summary,
        });
        return { run: completedRun, summary, attempts: attempt };
      } catch (error) {
        lastError = error;
        const canRetry = this.retryPolicy.shouldRetry(error, attempt) && attempt < this.retryPolicy.maxAttempts;
        if (!canRetry) break;

        await this.audit.record({
          type: "sync_retry",
          sourceName: source.source_name,
          runId: run.id,
          attempt,
          at: this.clock.now(),
          details: { error: error instanceof Error ? error.message : String(error) },
        });
        await this.sleep(this.retryPolicy.baseDelayMs * attempt);
      }
    }

    const failedRun = await this.runs.fail(run.id, {
      attempts: this.retryPolicy.maxAttempts,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    });
    await this.audit.record({
      type: "sync_failed",
      sourceName: source.source_name,
      runId: run.id,
      attempt: this.retryPolicy.maxAttempts,
      at: this.clock.now(),
      details: failedRun.details,
    });
    throw lastError;
  }
}
