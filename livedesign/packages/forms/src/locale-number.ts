// A number answer as the respondent's locale writes it (docs/specs/030-forms/forms.md "Number"). The field offers
// a decimal keypad, which on a German or French phone has a comma, so `3,5` and `1.234,5` arrive; the check (here and
// on the server) reads plain JavaScript numbers. The respondent's browser knows their locale, so it rewrites the
// answer before checking and sending; the server never guesses whether a comma is a decimal point.
import type { FormQuestion } from './model';

function separators(locale: string): { group: string; decimal: string } {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
    return {
      group: parts.find((p) => p.type === 'group')?.value ?? ',',
      decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
    };
  } catch {
    return { group: ',', decimal: '.' };
  }
}

/** `3,5` in de-DE is `3.5`; `1,234.5` in en-GB is `1234.5`. Text that is not a number in the locale is kept as it is. */
export function readLocaleNumber(text: string, locale: string): string {
  const { group, decimal } = separators(locale);
  // Spaces (plain, no-break, narrow) group digits in some locales: they count as the locale's group mark.
  const spaced = text.trim().replace(/[\s\u00a0\u202f]+/g, group);
  const [whole = '', fraction, extra] = spaced.split(decimal);
  if (extra !== undefined) return text;
  // A group mark only between thousands (`1,234`), so an en-US `3,5` is not read as 35.
  if (whole.includes(group)) {
    const sign = whole.startsWith('-') ? '-' : '';
    const groups = whole.slice(sign.length).split(group);
    if (!/^\d{1,3}$/.test(groups[0]!) || groups.slice(1).some((g) => !/^\d{3}$/.test(g)))
      return text;
  }
  const plain = whole.split(group).join('') + (fraction === undefined ? '' : `.${fraction}`);
  return plain !== '' && Number.isFinite(Number(plain)) ? plain : text;
}

/** The answers with every number question's text read in the respondent's locale. */
export function withLocaleNumbers(
  questions: Iterable<FormQuestion>,
  answers: Record<string, unknown>,
  locale: string,
): Record<string, unknown> {
  let out: Record<string, unknown> | null = null;
  for (const q of questions) {
    const raw = answers[q.id];
    if (q.type !== 'number' || typeof raw !== 'string') continue;
    const read = readLocaleNumber(raw, locale);
    if (read === raw) continue;
    out ??= { ...answers };
    out[q.id] = read;
  }
  return out ?? answers;
}
