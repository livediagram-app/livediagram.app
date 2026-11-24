'use client';

// The pieces liveworkspace.app's two OAuth pages share, the one MCP's consent page and the CLI's device page
// (liveworkspace/docs/specs/021-mcp/mcp.md): their buttons, the help link, the read-only choice, the Unverified App
// badge and the warning note.
import type { ReactNode } from 'react';
import { lucideTriangleAlert } from '@liveworkspace/icons/lucide';
import {
  Chip,
  Glyph,
  SOLID_BRAND_DARK_CONTROL,
  Spinner,
  Switch,
  lucideGlyph,
} from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { isLoopbackHost } from '@liveworkspace/api-kit/request-auth';

// The primary action of every page in the shell (Connect, Continue, Sign in). White on brand-700 in light (about
// 5.9:1; brand-600 was 4.1:1, under WCAG 2.2 AA), darker still on hover; the shared solid brand control in dark.
export const OAUTH_PRIMARY = `min-h-11 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 ${SOLID_BRAND_DARK_CONTROL}`;

export const OAUTH_SECONDARY =
  'rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';

export const OAUTH_BODY = 'mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400';

export const OAUTH_QUIET = 'text-sm text-slate-500 dark:text-slate-400';

// Both pages' waiting line, while the sign-in gate or the request is still loading: a spinner beside the word, so it
// reads as work in progress rather than a stray line of grey text.
export function OauthLoading() {
  return (
    <p role="status" className={`flex items-center gap-2 ${OAUTH_QUIET}`}>
      <Spinner size={14} />
      Loading…
    </p>
  );
}

// Help link to the connect-an-AI-tool article. Opens in a new tab so it never abandons the in-progress OAuth
// session on this screen.
export function OauthHelpLink() {
  return (
    <a
      href="/help/account-and-data/connect-ai-mcp/"
      target="_blank"
      rel="noopener noreferrer"
      className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 transition hover:text-brand-700 dark:hover:text-brand-400"
    >
      <Glyph size={13} units={16} strokeLinecap="butt" strokeLinejoin="miter">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M6.2 6.3a1.8 1.8 0 1 1 2.3 1.8c-.5.2-.7.5-.7 1.1" strokeLinecap="round" />
        <circle cx="8" cy="11.4" r="0.5" fill="currentColor" stroke="none" />
      </Glyph>
      Learn about connecting AI tools
    </a>
  );
}

// The read-only choice both approval pages offer (an MCP client's consent, a CLI's device sign-in): a whole-row
// toggle with the shared presentational switch, as ProfilePane and SettingsDialog rows are.
export function ReadOnlyAccessToggle({
  noun,
  readOnly,
  onChange,
  line,
}: {
  noun: string;
  readOnly: boolean;
  onChange: (readOnly: boolean) => void;
  // A page's own wording after the label, in place of the full one.
  line?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!readOnly)}
      aria-pressed={readOnly}
      className="mt-4 flex w-full cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm dark:border-slate-700"
    >
      <span className="min-w-0 text-slate-600 dark:text-slate-300">
        <span className="font-medium text-slate-800 dark:text-slate-100">Read-only access</span>:{' '}
        {line ??
          `let it find and view your ${noun}, but not create, edit, delete, or share them. Leave off for full read + write.`}
      </span>
      <span className="mt-0.5 shrink-0">
        <Switch presentational size="sm" checked={readOnly} />
      </span>
    </button>
  );
}

const WarningGlyph = lucideGlyph(lucideTriangleAlert, 14);

// Beside a registered client's name: registration is open, so its name is whatever it sent.
export function UnverifiedAppBadge() {
  return (
    <Chip
      caps
      title="Anyone can register an app under any name."
      icon={<WarningGlyph aria-hidden />}
      className="px-2 py-0.5 text-[10px] font-semibold ring-1 [--optical-tracking:0.025em] bg-amber-50 text-amber-800 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/40"
    >
      Unverified App
    </Chip>
  );
}

// A caution on an approval card: the warning glyph, a heading line, and what to check under it.
export function OauthWarning({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Callout tone="warning" role="note" title={title} className="mt-4">
      {children}
    </Callout>
  );
}

// The host, as the line says it, in mono. A site's may be long, so it breaks anywhere; a loopback one is short
// (`localhost:55884`) and is kept whole.
function Host({ host, whole = false }: { host: string; whole?: boolean }) {
  return (
    <span
      className={`font-mono text-sm font-semibold text-slate-900 dark:text-white ${whole ? 'whitespace-nowrap' : 'break-all'}`}
    >
      {host}
    </span>
  );
}

// Where the access goes, for a client the server vouches for (the product's CLI): the quiet line.
export function VerifiedDestination({ host }: { host: string }) {
  return (
    <Callout tone="info" className="mt-3">
      {isLoopbackHost(host) ? (
        <>
          Access will be sent back to the app on this computer (
          <span className="font-semibold">{host}</span>). Only continue if you started this
          connection yourself.
        </>
      ) : (
        <>
          Access will be sent to <span className="font-semibold">{host}</span>. Only continue if you
          recognise this.
        </>
      )}
    </Callout>
  );
}

// Where the access goes, for any other client: the card's first fact, with whose app this is not.
export function UnverifiedDestination({ client, host }: { client: string; host: string }) {
  return (
    <OauthWarning title={`${client} is not made by liveworkspace, and we can’t check who made it.`}>
      {host && isLoopbackHost(host) ? (
        <p>
          Access will be sent back to the app on this computer{' '}
          <span className="whitespace-nowrap">
            (<Host host={host} whole />)
          </span>
          . Only continue if you started this connection yourself.
        </p>
      ) : host ? (
        <p>
          Access will be sent to <Host host={host} />. Only continue if you recognise this site and
          started this connection yourself.
        </p>
      ) : (
        <p>Only continue if you started this connection yourself.</p>
      )}
    </OauthWarning>
  );
}
