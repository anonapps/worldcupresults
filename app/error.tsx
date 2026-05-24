"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <p className="mb-3 text-red-700">Something went wrong.</p>
      <button className="rounded bg-slate-900 px-4 py-2 text-white" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
