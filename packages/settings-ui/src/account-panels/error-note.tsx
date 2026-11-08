import type { ReactNode } from 'react';

// The account panels' error note, in a module of its own so a row outside them (Reset All Settings, drawn in each
// editor's own Settings) can say a refusal the same way without bringing the panels' other parts along.
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
    >
      {children}
    </p>
  );
}
