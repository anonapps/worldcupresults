import type { SourceProviderAdapter } from "./types";

export class SourceProviderRegistry {
  private readonly byKey: Map<string, SourceProviderAdapter>;

  constructor(adapters: SourceProviderAdapter[]) {
    this.byKey = new Map(adapters.map((a) => [a.descriptor.key, a]));
  }

  getOrThrow(key: string): SourceProviderAdapter {
    const adapter = this.byKey.get(key);
    if (!adapter) throw new Error(`Unknown source provider adapter: ${key}`);
    return adapter;
  }
}
