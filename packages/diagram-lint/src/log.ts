// How the pure lint logs (blueprint "Observability", LN30): an injected logger, by default the console
// at the level each fingerprint names. Fields are counts, codes and flags, never content.

export type LintLogger = (
  fingerprint: string,
  fields: Record<string, number | string | boolean>,
) => void;

const LEVELS: Readonly<Record<string, 'info' | 'warn' | 'debug'>> = {
  '[lint] crossings skipped': 'warn',
  '[lint] theme unresolved': 'debug',
};

export const consoleLintLogger: LintLogger = (fingerprint, fields) => {
  const level = LEVELS[fingerprint] ?? 'info';
  console[level](fingerprint, fields);
};
