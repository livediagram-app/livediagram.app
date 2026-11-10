// Every lint disable says why (docs/ci.md "Lint disables and console.log"): a directive names the rule it turns off
// and ends in ` -- reason`, so a reader can tell a deliberate exception from a silenced finding. An `eslint-disable`
// directive is refused outright: the shared config reads only `oxlint-disable` (respectEslintDisableDirectives is
// off), so one suppresses nothing while looking as if it does.

export type DirectiveProblem = 'eslint' | 'noRule' | 'noReason';

export const DISABLE_REASON_MESSAGES: Record<DirectiveProblem, string> = {
  eslint:
    'eslint-disable does nothing here (only oxlint-disable is read). Delete it, or write `oxlint-disable-next-line rule -- reason`.',
  noRule: 'Name the rule this turns off: `oxlint-disable-next-line rule -- reason`.',
  noReason: 'Say why the rule is off here: `oxlint-disable-next-line rule -- reason`.',
};

const DIRECTIVE = /^\s*(eslint|oxlint)-disable(?:-next-line|-line)?(?=\s|$)(.*)$/s;

/** What is wrong with a comment's text as a disable directive, or null when it is fine or not a directive. */
export function directiveProblem(text: string): DirectiveProblem | null {
  const m = DIRECTIVE.exec(text);
  if (!m) return null;
  if (m[1] === 'eslint') return 'eslint';
  const [rules = '', reason] = (m[2] ?? '').split(/\s--\s/, 2);
  if (rules.trim() === '') return 'noRule';
  if (!reason || reason.trim() === '') return 'noReason';
  return null;
}
