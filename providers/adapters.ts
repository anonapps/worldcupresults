import type { ProviderContext, ProviderPullResult, SourceProviderAdapter, SourceProviderDescriptor } from "./types";

abstract class BaseAdapter implements SourceProviderAdapter {
  constructor(public readonly descriptor: SourceProviderDescriptor) {}

  abstract pull(ctx: ProviderContext, previousCheckpoint: string | null): Promise<ProviderPullResult>;

  protected emptyResult(checkpoint: string | null = null): ProviderPullResult {
    return { teams: [], matches: [], tournamentRuleVersions: [], checkpoint };
  }
}

export class FifaOfficialSourceAdapter extends BaseAdapter {
  constructor() {
    super({
      key: "fifa_official",
      kind: "FIFA_OFFICIAL",
      displayName: "FIFA Official Source",
      capabilities: { canPullIncremental: true, supportsManualFileUpload: false, priority: 1 },
    });
  }

  async pull(_ctx: ProviderContext, previousCheckpoint: string | null): Promise<ProviderPullResult> {
    return this.emptyResult(previousCheckpoint);
  }
}

export class FallbackSourceAdapter extends BaseAdapter {
  constructor() {
    super({
      key: "fallback_source",
      kind: "FALLBACK",
      displayName: "Fallback Source",
      capabilities: { canPullIncremental: true, supportsManualFileUpload: false, priority: 2 },
    });
  }

  async pull(_ctx: ProviderContext, previousCheckpoint: string | null): Promise<ProviderPullResult> {
    return this.emptyResult(previousCheckpoint);
  }
}

export class ManualAdminImportAdapter extends BaseAdapter {
  constructor() {
    super({
      key: "manual_admin_import",
      kind: "MANUAL_IMPORT",
      displayName: "Manual Admin Import",
      capabilities: { canPullIncremental: false, supportsManualFileUpload: true, priority: 3 },
    });
  }

  async pull(_ctx: ProviderContext): Promise<ProviderPullResult> {
    return this.emptyResult(null);
  }
}
