'use client';

// The page a share link's visitor sees when the item's sign-in rule turns them away (liveworkspace/docs/specs/004-index/
// one-explorer-contracts.md "Sharing and access"; each product's 013-workspace/share-password.md "Restricted to
// accounts"). Signed out, or a guest: sign in or create an account, and the accounts site brings them straight back
// to this address, where the link opens with its role. Signed in at another domain: Use Another Account, which asks the
// accounts site to sign in afresh. It says who the item is for (the domains the refusal named), never anything else
// of it. Shown in the password gate's place (SharePasswordGate, with `restricted`).

import { buttonClassName, Glyph } from '@liveworkspace/ui';
import { accountsSignInUrl } from '../chrome/auth-routes';
import type { ShareRestriction } from '../../lib/share-restriction';

export type { ShareRestriction } from '../../lib/share-restriction';

const at = (domain: string) => `@${domain}`;

/** The domains in words: "@acme.com", "@acme.com or @b.org", "@a.com, @b.org or @c.net". */
export function domainsInWords(domains: readonly string[]): string {
  const named = domains.map(at);
  if (named.length <= 1) return named[0] ?? '';
  return `${named.slice(0, -1).join(', ')} or ${named[named.length - 1]}`;
}

// The page only renders in the browser: the gate opens after the arrival resolves the link, never on the server.

/** Inside an embed's frame the accounts site can't show (it refuses framing): its links open in a new tab, and the
 *  embed opens once the frame is reloaded signed in. */
function framed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // A cross-origin parent throws on `top`: that is a frame too.
    return true;
  }
}

/** Where the visitor comes back to after signing in: this very address, so the link opens again. */
function here(): string {
  return window.location.pathname + window.location.search + window.location.hash;
}

export function ShareRestricted({
  noun,
  restriction,
  ownerName,
}: {
  // The product's word for what the link opens, in lower case ('canvas', 'plan').
  noun: string;
  restriction: ShareRestriction;
  ownerName: string | null;
}) {
  const { reason, domains } = restriction;
  const out = framed() ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  const toDomains = domains.length > 0;
  const who = ownerName ?? 'The owner';
  const title = toDomains
    ? domains.length === 1
      ? `This ${noun} is restricted to ${at(domains[0]!)}`
      : `This ${noun} is restricted to ${domains.length} email domains`
    : `Sign in to open this ${noun}`;
  const body =
    reason === 'domain'
      ? `You’re signed in with an account at another domain. Sign in with your ${domainsInWords(domains)} account to open it.`
      : toDomains
        ? `${who} shared it with people at ${domainsInWords(domains)}. Sign in with an account there to open it.`
        : `${who} asked everyone who opens this ${noun} to sign in with a liveworkspace account first.`;
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <section
        aria-labelledby="share-restricted-title"
        className="flex w-[26rem] max-w-full animate-fly-up-in flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          <PersonLockIcon />
        </span>
        <div>
          <h1
            id="share-restricted-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{body}</p>
        </div>
        {domains.length > 1 ? (
          <ul aria-label="Email domains" className="flex flex-wrap justify-center gap-1.5">
            {domains.map((domain) => (
              <li
                key={domain}
                className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {at(domain)}
              </li>
            ))}
          </ul>
        ) : null}
        {reason === 'domain' ? (
          <a
            href={accountsSignInUrl(here(), 'switch')}
            {...out}
            className={buttonClassName({ size: 'md', className: 'w-full shadow-sm' })}
          >
            Use Another Account
          </a>
        ) : (
          <div className="flex w-full flex-col gap-2">
            <a
              href={accountsSignInUrl(here())}
              {...out}
              className={buttonClassName({ size: 'md', className: 'w-full shadow-sm' })}
            >
              Sign In
            </a>
            <a
              href={accountsSignInUrl(here(), true)}
              {...out}
              className={buttonClassName({ variant: 'secondary', size: 'md', className: 'w-full' })}
            >
              Create Account
            </a>
          </div>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {framed()
            ? 'It opens in a new tab. Once you’re signed in, reload this page.'
            : 'You come straight back here, with the role the link gives.'}
        </p>
      </section>
    </div>
  );
}

function PersonLockIcon() {
  return (
    <Glyph size={22} units={16} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="5" r="2.5" />
      <path d="M1.8 13.5c.4-2.4 2.3-4 4.7-4 1 0 1.9.3 2.6.8" />
      <rect x="9.5" y="10" width="5" height="4" rx="1" />
      <path d="M10.6 10V9a1.4 1.4 0 0 1 2.8 0v1" />
    </Glyph>
  );
}
