import type { SourceFetchContext, SourcePayload, WorldCupSourceAdapter } from "../services/sync/types";

export class ManualAdminImportSourceAdapter implements WorldCupSourceAdapter {
  readonly provider = "manual_admin_import" as const;

  constructor(
    readonly sourceName = "manual_admin_import",
    private readonly payload: SourcePayload,
  ) {}

  async fetch(_context: SourceFetchContext): Promise<SourcePayload> {
    return structuredClone(this.payload);
  }
}
