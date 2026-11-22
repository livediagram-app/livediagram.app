'use client';

// Sign In (one-explorer-contracts.md "Sharing and access", Work Tracker 1330 and 1331): who may open the item's passes,
// one rule over every pass as Password Protection is, in the same settings-card look, just under it. Two rows in one
// card: Require Sign In (accounts only, no guests), and Anybody With Email Address Domain (only accounts with a
// verified email at these domains), whose switch opens a domain box. Domains imply sign-in, so with domains saved the
// first switch reads on and is held there. The index checks the rule; the card only sets it, and reads back what the
// index stored, so a switch never disagrees with what is enforced.

import { useEffect, useRef, useState } from 'react';
import {
  parseShareDomains,
  SHARE_DOMAINS_MAX,
  SHARE_DOMAINS_TEXT_MAX,
  type ShareSignInRule,
} from '@liveworkspace/index-client';
import { Button, Switch } from '@liveworkspace/ui';
import { AtSignIcon, UserIcon } from '../../ui/icons';
import { HelpLink } from './HelpLink';
import { SETTING_CARD, SETTING_DETAIL, SETTING_DETAIL_ROW, SETTING_NOTE } from './parts';
import type { ShareHelpHref } from './types';

const ROW = 'relative flex items-center gap-4 px-4 py-3';
const ROW_HOVER = 'transition-colors duration-micro hover:bg-slate-50 dark:hover:bg-slate-700/40';
const TITLE = 'text-sm font-medium text-slate-800 dark:text-slate-100';
const HINT = 'mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400';

/** What the domain box says of what was typed: nothing while it is empty or fine, else why Save waits. */
export function domainsProblem(typed: string): string | null {
  if (!typed.trim()) return null;
  const parsed = parseShareDomains(typed);
  if (parsed.ok) return null;
  return parsed.tooMany
    ? `Up to ${SHARE_DOMAINS_MAX} domains.`
    : `“${parsed.invalid.slice(0, 60)}” isn’t an email domain. Use names like acme.com.`;
}

/** Domains as the box shows them: each with its @, a space between. */
export const domainsText = (domains: readonly string[]) => domains.map((d) => `@${d}`).join(' ');

export function SignInSection({
  signIn,
  suggestedDomain = null,
  busy,
  helpHref,
  lockedReason = null,
  onSet,
}: {
  signIn: ShareSignInRule;
  // The domain a team item's box starts with (the sharer's own), or null.
  suggestedDomain?: string | null;
  busy: boolean;
  helpHref?: ShareHelpHref;
  // Why it cannot be switched on now (a listed Community post); a rule already in force can still be turned off.
  lockedReason?: string | null;
  // Resolves true once the index took it; false when it refused (the dialog has said so).
  onSet: (rule: ShareSignInRule) => Promise<boolean>;
}) {
  const saved = signIn.domains;
  const hasDomains = saved.length > 0;
  // The domain switch on with nothing saved yet, or Change pressed: the box is open.
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const locked = Boolean(lockedReason);
  const lockRequire = locked && !signIn.requireAccount;
  const lockDomains = locked && !hasDomains;
  const focusField = () => requestAnimationFrame(() => field.current?.focus());
  // A rule another tab or person saved while the box was open closes it.
  const savedText = domainsText(saved);
  const shown = useRef(savedText);
  useEffect(() => {
    if (shown.current !== savedText) setEditing(false);
    shown.current = savedText;
  }, [savedText]);

  const openBox = () => {
    setTyped(hasDomains ? savedText : suggestedDomain ? `@${suggestedDomain}` : '');
    setEditing(true);
    focusField();
  };
  const toggleRequire = () => {
    if (hasDomains) return;
    void onSet({ requireAccount: !signIn.requireAccount, domains: [] });
  };
  const toggleDomains = () => {
    if (editing && !hasDomains) {
      setEditing(false);
      return;
    }
    if (hasDomains) {
      // Off removes the domains; sign-in, which they held on, stays on until switched off itself.
      setEditing(false);
      void onSet({ requireAccount: true, domains: [] });
      return;
    }
    openBox();
  };
  const parsed = parseShareDomains(typed);
  const problem = domainsProblem(typed);
  const ready = parsed.ok && parsed.domains.length > 0;
  const save = async () => {
    if (!parsed.ok || parsed.domains.length === 0) return;
    if (await onSet({ requireAccount: true, domains: parsed.domains })) setEditing(false);
  };
  const domainsOn = hasDomains || editing;

  return (
    <section
      aria-label="Who can open passes"
      data-tour-id="share-sign-in"
      className="border-t border-slate-100 pt-4 dark:border-slate-800"
    >
      <div className={SETTING_CARD}>
        {/* Require Sign In: the Settings dialog's row, its switch covering the row. */}
        <div className={`${ROW} rounded-t-[inherit] ${lockRequire || hasDomains ? '' : ROW_HOVER}`}>
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-700/70 dark:text-slate-300"
          >
            <UserIcon size={15} />
          </span>
          <div className={`min-w-[9rem] flex-1 ${lockRequire ? 'opacity-50' : ''}`}>
            <div id="share-sign-in-label" className={`${TITLE} flex items-center gap-1.5`}>
              Require Sign In
              <span className="relative z-[1] flex">
                <HelpLink
                  href={helpHref?.('sharing')}
                  label="How Require Sign In works"
                  description="Only people signed in to a liveworkspace account can open a pass, so you always know who is in. Guests are asked to sign in first and come back with the pass's role."
                />
              </span>
            </div>
            <p id="share-sign-in-description" className={HINT}>
              {hasDomains
                ? 'On while email domains are set: only accounts can be at a domain.'
                : 'Only people signed in to a liveworkspace account can open a pass. No guests.'}
            </p>
          </div>
          <Switch
            size="sm"
            checked={signIn.requireAccount}
            labelledBy="share-sign-in-label"
            describedBy="share-sign-in-description"
            disabled={lockRequire || hasDomains}
            busy={busy}
            onChange={toggleRequire}
            coversRow
            className="ml-auto"
          />
        </div>
        {/* Email domains: a second row in the same card, its box below it when on. */}
        <div
          className={`${ROW} border-t border-slate-100 dark:border-slate-700/70 ${
            domainsOn || locked ? '' : 'rounded-b-[inherit]'
          } ${lockDomains ? '' : ROW_HOVER}`}
        >
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-700/70 dark:text-slate-300"
          >
            <AtSignIcon size={15} />
          </span>
          <div className={`min-w-[9rem] flex-1 ${lockDomains ? 'opacity-50' : ''}`}>
            <div id="share-domains-label" className={TITLE}>
              Anybody With Email Address Domain
            </div>
            <p id="share-domains-description" className={HINT}>
              Only accounts with a verified email at these domains, such as @acme.com.
            </p>
          </div>
          <Switch
            size="sm"
            checked={domainsOn}
            labelledBy="share-domains-label"
            describedBy="share-domains-description"
            disabled={lockDomains}
            busy={busy}
            onChange={toggleDomains}
            coversRow
            className="ml-auto"
          />
        </div>
        {locked && (lockRequire || lockDomains) ? (
          <div className={SETTING_DETAIL}>
            <p className={SETTING_NOTE}>{lockedReason}</p>
          </div>
        ) : null}
        {hasDomains && !editing ? (
          <div className={SETTING_DETAIL}>
            <div className={SETTING_DETAIL_ROW}>
              <ul aria-label="Email domains" className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {saved.map((domain) => (
                  <li
                    key={domain}
                    className="inline-flex max-w-full items-center truncate rounded-full bg-brand-50 px-2.5 py-1 font-mono text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-400/30"
                  >
                    @{domain}
                  </li>
                ))}
              </ul>
              <Button variant="secondary" size="xs" disabled={busy} onClick={openBox}>
                Change
              </Button>
            </div>
          </div>
        ) : null}
        {editing ? (
          <div className={SETTING_DETAIL}>
            <form
              className={SETTING_DETAIL_ROW}
              onSubmit={(e) => {
                e.preventDefault();
                if (ready) void save();
              }}
            >
              <div className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <AtSignIcon size={13} />
                </span>
                <input
                  ref={field}
                  type="text"
                  inputMode="email"
                  value={typed}
                  maxLength={SHARE_DOMAINS_TEXT_MAX}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      // Escape backs out of the box, and leaves the dialog open.
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      setEditing(false);
                    }
                  }}
                  placeholder="@acme.com @example.org"
                  aria-label="Email domains"
                  aria-invalid={problem !== null}
                  aria-describedby="share-domains-hint"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 font-mono text-sm text-slate-800 outline-none transition duration-micro placeholder:font-sans placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 aria-[invalid=true]:border-rose-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-500/20"
                />
              </div>
              <Button type="submit" size="xs" disabled={!ready} busy={busy} className="shadow-sm">
                Save
              </Button>
              {hasDomains ? (
                <Button
                  variant="secondary"
                  size="xs"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              ) : null}
            </form>
            <p
              id="share-domains-hint"
              className={
                problem ? 'text-xs font-medium text-rose-700 dark:text-rose-300' : SETTING_NOTE
              }
            >
              {problem ??
                'Separate several with spaces or commas. People sign in, then open it with the pass’s role.'}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
