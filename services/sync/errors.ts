export class SyncError extends Error {}

export class SyncSourceNotFoundError extends SyncError {
  constructor(sourceName: string) {
    super(`Sync source ${sourceName} was not found`);
    this.name = "SyncSourceNotFoundError";
  }
}

export class InactiveSyncSourceError extends SyncError {
  constructor(sourceName: string) {
    super(`Sync source ${sourceName} is inactive`);
    this.name = "InactiveSyncSourceError";
  }
}

export class SourceAdapterNotConfiguredError extends SyncError {
  constructor(sourceName: string) {
    super(`Source adapter ${sourceName} is architecture-only and has no fetch implementation yet`);
    this.name = "SourceAdapterNotConfiguredError";
  }
}

export class NormalizationError extends SyncError {
  constructor(message: string) {
    super(message);
    this.name = "NormalizationError";
  }
}
