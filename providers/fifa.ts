import { SourceAdapterNotConfiguredError } from "../services/sync/errors";
import type { SourceFetchContext, SourcePayload, WorldCupSourceAdapter } from "../services/sync/types";

export class FifaOfficialSourceAdapter implements WorldCupSourceAdapter {
  readonly provider = "fifa_official" as const;
  readonly sourceName = "fifa_official";

  async fetch(_context: SourceFetchContext): Promise<SourcePayload> {
    throw new SourceAdapterNotConfiguredError(this.sourceName);
  }
}
