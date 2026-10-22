// How the pure lint logs (blueprint "Observability", LN30): an injected logger, by default the console's info.
// Fields are counts, codes and flags, never content.

export type LintLogger = (
  fingerprint: string,
  fields: Record<string, number | string | boolean>,
) => void;

export const consoleLintLogger: LintLogger = (fingerprint, fields) => {
  console.info(fingerprint, fields);
};
