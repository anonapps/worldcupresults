'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-2xl font-semibold text-slate-900">Something went wrong.</h2>
      <button
        type="button"
        className="rounded-md bg-slate-900 px-4 py-2 text-white"
        onClick={() => reset()}
      >
        Try again
      </button>
    </main>
  );
}
