'use client';

// The pieces both OAuth pages share (the consent page and the device page, docs/specs/015-api/mcp-server.md §3 and
// docs/specs/015-api/blueprints/cli.md "The device grant", "Presentation and UX"): their buttons, the help link, the
// read-only choice, the Unverified App badge and the warning note. The frame itself (each editor's Night Band
// `OauthShell`) and the editor's facts are handed in through `OauthPagesConfig`.
import type { ComponentType, ReactNode } from 'react';
import { lucideTriangleAlert } from '@liveworkspace/icons/lucide';
import { Chip, Glyph, SOLID_BRAND_DARK_CONTROL, Switch, lucideGlyph } from '@liveworkspace/ui';
import type { SignInGate } from '../../hooks/auth/useSignInGate';

// What an editor tells its OAuth pages, once, in its app/oauth/oauth-shell.tsx.
export type OauthPagesConfig = {
  // The product's name as its copy writes it ("livediagram").
  product: string;
  // What the sign-in step says a person connects an app to ("canvases").
  noun: string;
  // The editor's trusted MCP origin (lib/mcp-config.ts), never one from the page URL.
  mcpOrigin: string;
  // The product's built-in CLI client id, which tells the CLI apart for telemetry (CLI77).
  cliClientId: string;
  // The Night Band frame with the connect pitch.
  Shell: ComponentType<{ children: ReactNode }>;
  // The card title's classes (AuthStage's AUTH_TITLE).
  titleClass: string;
  // Whether the page may show its content, and whose account mints the token.
  useSignIn: () => { gate: SignInGate; accountUserId: string | null | undefined };
  // Anonymous telemetry: a token was created for the CLI or an MCP client.
  onTokenCreated: (type: 'Cli' | 'MCP') => void;
};

// The primary action of every page in the shell (Connect, Continue, Sign in). White on brand-700 in light (about
// 5.9:1; brand-600 was 4.1:1, under WCAG 2.2 AA), darker still on hover; the shared solid brand control in dark.
export const OAUTH_PRIMARY = `min-h-11 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 ${SOLID_BRAND_DARK_CONTROL}`;

export const OAUTH_SECONDARY =
  'rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';

export const OAUTH_BODY = 'mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400';

export const OAUTH_QUIET = 'text-sm text-slate-500 dark:text-slate-400';

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
}: {
  noun: string;
  readOnly: boolean;
  onChange: (readOnly: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!readOnly)}
      aria-pressed={readOnly}
      className="mt-4 flex w-full cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm dark:border-slate-700"
    >
      <span className="min-w-0 text-slate-600 dark:text-slate-300">
        <span className="font-medium text-slate-800 dark:text-slate-100">Read-only access</span>:
        let it find and view your {noun}, but not create, edit, delete, or share them. Leave off for
        full read + write.
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
export function OauthWarning({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div
      role="note"
      className="mt-4 flex gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <WarningGlyph aria-hidden className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{title}</p>
        {children ? <div className="mt-1 text-xs leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}
