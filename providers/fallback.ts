import { SourceAdapterNotConfiguredError } from "../services/sync/errors";
import type { SourceFetchContext, SourcePayload, WorldCupSourceAdapter } from "../services/sync/types";

export class FallbackSourceAdapter implements WorldCupSourceAdapter {
  readonly provider = "fallback" as const;

  constructor(readonly sourceName = "fallback_world_cup_source") {}

  async fetch(_context: SourceFetchContext): Promise<SourcePayload> {
    throw new SourceAdapterNotConfiguredError(this.sourceName);
  }
}
