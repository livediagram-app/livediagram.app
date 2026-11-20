// Whether a message's sender proved who they are (liveworkspace/docs/specs/003-accounts/inbound-email.md
// "Authentication"): read from the topmost Authentication-Results header (RFC 8601) Email Routing wrote, and only when
// its authserv-id is one the app trusts. A sender can add their own such header, but only below the receiver's.

export type InboundAuthentication = {
  verdict: 'pass' | 'fail';
  reason: 'dmarc_pass' | 'aligned_pass' | 'dmarc_fail' | 'no_results' | 'unaligned' | 'none_passed';
};

const DMARC_FAILS = new Set(['fail', 'quarantine', 'reject', 'permerror', 'temperror']);

// The domain a passing DKIM signature signed as: its `header.d`, else the domain of its `header.i` (RFC 8601 2.7.1).
function signingDomain(words: readonly string[]): string | null {
  let identity: string | null = null;
  for (const word of words) {
    const lower = word.toLowerCase();
    if (lower.startsWith('header.d=')) return lower.slice('header.d='.length) || null;
    if (lower.startsWith('header.i=')) identity = lower.slice(lower.lastIndexOf('@') + 1) || null;
  }
  return identity;
}

/** Each method's result (`spf`, `dkim`, `dmarc`): the first of each, but any `pass` for dkim, with the domain each
 *  passing DKIM signature signed as (`dkimDomains`). */
export function authResults(header: string): {
  servId: string;
  results: Map<string, string>;
  dkimDomains: string[];
} {
  const parts = header.split(';');
  // The authserv-id may carry a version after a space (`mx.example 1`).
  const servId = (parts[0] ?? '').trim().split(' ')[0]!.toLowerCase();
  const results = new Map<string, string>();
  const dkimDomains: string[] = [];
  for (const part of parts.slice(1)) {
    const words = part.trim().split(/\s+/);
    const token = words[0] ?? '';
    const eq = token.indexOf('=');
    if (eq <= 0) continue;
    const method = token.slice(0, eq).toLowerCase();
    const result = token.slice(eq + 1).toLowerCase();
    if (method === 'dkim' && result === 'pass') {
      results.set(method, result);
      const domain = signingDomain(words.slice(1));
      if (domain) dkimDomains.push(domain);
    } else if (!results.has(method)) results.set(method, result);
  }
  return { servId, results, dkimDomains };
}

// Whether a DKIM signature by `signer` speaks for an address at `domain`: the same domain, or a parent of it (DMARC's
// relaxed alignment). A signature only passes for a domain whose DNS holds its key, so a parent is the sender's own.
const signsFor = (signer: string, domain: string): boolean =>
  domain === signer || domain.endsWith(`.${signer}`);

/** The verdict for a message whose topmost Authentication-Results is `header` (undefined: none), whose header From
 *  is `from` and whose envelope sender is `envelopeFrom`. */
export function authenticationOf(
  header: string | undefined,
  opts: { trusted: readonly string[]; from: string | null; envelopeFrom: string },
): InboundAuthentication {
  if (!header) return { verdict: 'fail', reason: 'no_results' };
  const { servId, results, dkimDomains } = authResults(header);
  if (!opts.trusted.some((t) => t.toLowerCase() === servId))
    return { verdict: 'fail', reason: 'no_results' };
  const dmarc = results.get('dmarc');
  if (dmarc === 'pass') return { verdict: 'pass', reason: 'dmarc_pass' };
  if (dmarc !== undefined && DMARC_FAILS.has(dmarc))
    return { verdict: 'fail', reason: 'dmarc_fail' };
  const spf = results.get('spf') === 'pass';
  if (!spf && results.get('dkim') !== 'pass') return { verdict: 'fail', reason: 'none_passed' };
  // No DMARC verdict: the app does DMARC's own check. The header From must be the envelope sender, and one method
  // must have passed FOR the From's domain: SPF proves the envelope's domain, which is then the From's; a DKIM pass
  // proves only the domain that signed, and anyone can sign with a domain of their own, so it counts only when that
  // domain is the From's (or a parent of it).
  if (opts.from === null || opts.from !== opts.envelopeFrom.trim().toLowerCase())
    return { verdict: 'fail', reason: 'unaligned' };
  const domain = opts.from.slice(opts.from.lastIndexOf('@') + 1);
  return spf || dkimDomains.some((signer) => signsFor(signer, domain))
    ? { verdict: 'pass', reason: 'aligned_pass' }
    : { verdict: 'fail', reason: 'unaligned' };
}
