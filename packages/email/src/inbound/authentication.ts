// Whether a message's sender proved who they are (liveworkspace/docs/specs/003-accounts/inbound-email.md
// "Authentication"): read from the topmost Authentication-Results header (RFC 8601) Email Routing wrote, and only when
// its authserv-id is one the app trusts. A sender can add their own such header, but only below the receiver's.

export type InboundAuthentication = {
  verdict: 'pass' | 'fail';
  reason: 'dmarc_pass' | 'aligned_pass' | 'dmarc_fail' | 'no_results' | 'unaligned' | 'none_passed';
};

const DMARC_FAILS = new Set(['fail', 'quarantine', 'reject', 'permerror', 'temperror']);

/** Each method's result (`spf`, `dkim`, `dmarc`): the first of each, but any `pass` for dkim. */
export function authResults(header: string): { servId: string; results: Map<string, string> } {
  const parts = header.split(';');
  // The authserv-id may carry a version after a space (`mx.example 1`).
  const servId = (parts[0] ?? '').trim().split(' ')[0]!.toLowerCase();
  const results = new Map<string, string>();
  for (const part of parts.slice(1)) {
    const token = part.trim().split(' ')[0] ?? '';
    const eq = token.indexOf('=');
    if (eq <= 0) continue;
    const method = token.slice(0, eq).toLowerCase();
    const result = token.slice(eq + 1).toLowerCase();
    if (method === 'dkim' && result === 'pass') results.set(method, result);
    else if (!results.has(method)) results.set(method, result);
  }
  return { servId, results };
}

/** The verdict for a message whose topmost Authentication-Results is `header` (undefined: none), whose header From
 *  is `from` and whose envelope sender is `envelopeFrom`. */
export function authenticationOf(
  header: string | undefined,
  opts: { trusted: readonly string[]; from: string | null; envelopeFrom: string },
): InboundAuthentication {
  if (!header) return { verdict: 'fail', reason: 'no_results' };
  const { servId, results } = authResults(header);
  if (!opts.trusted.some((t) => t.toLowerCase() === servId))
    return { verdict: 'fail', reason: 'no_results' };
  const dmarc = results.get('dmarc');
  if (dmarc === 'pass') return { verdict: 'pass', reason: 'dmarc_pass' };
  if (dmarc !== undefined && DMARC_FAILS.has(dmarc))
    return { verdict: 'fail', reason: 'dmarc_fail' };
  const passed = results.get('dkim') === 'pass' || results.get('spf') === 'pass';
  if (!passed) return { verdict: 'fail', reason: 'none_passed' };
  return opts.from !== null && opts.from === opts.envelopeFrom.trim().toLowerCase()
    ? { verdict: 'pass', reason: 'aligned_pass' }
    : { verdict: 'fail', reason: 'unaligned' };
}
