import type { RetryPolicy } from "./types";

export class DefaultRetryPolicy implements RetryPolicy {
  constructor(
    public readonly maxAttempts: number = 3,
    public readonly baseDelayMs: number = 50,
  ) {}

  shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.maxAttempts) return false;
    return error instanceof Error;
  }
}

export const waitFor = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};
