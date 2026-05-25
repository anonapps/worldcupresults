import type { SourceFetchContext, SourcePayload, WorldCupSourceAdapter } from "../services/sync/types";

export class ManualAdminImportSourceAdapter implements WorldCupSourceAdapter {
  readonly provider = "manual_admin_import" as const;

  constructor(
    private readonly payload: SourcePayload,
    readonly sourceName = "manual_admin_import",
  ) {}

  async fetch(_context: SourceFetchContext): Promise<SourcePayload> {
    return structuredClone(this.payload);
  }
}
