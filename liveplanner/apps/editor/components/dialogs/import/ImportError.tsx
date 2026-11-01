import type { ReactNode } from 'react';

// Why a file was not taken, in the Import dialog: under its list or its preview, announced as it appears.
export function ImportError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
    >
      {children}
    </p>
  );
}
