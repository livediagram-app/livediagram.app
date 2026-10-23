'use client';

// The frame of the OAuth pages (the consent page and the device page, docs/specs/015-api/blueprints/cli.md
// "The device grant") and the workbench pairing page: the Night Band frame (docs/specs/014-identity/
// auth-and-guest-access.md "The look: Night Band") with the connect pitch beside the card, and the help link to the
// connect-an-AI-tool article.
import { Glyph, SOLID_BRAND_DARK_CONTROL } from '@liveplanner/ui';
import { AuthStage } from '@/components/chrome/AuthStage';
import { ConnectPitch } from '@/components/chrome/auth-pitches';
import { ToggleSwitch } from '@/components/palette/palette-controls';

// The primary action of every page in the shell (Allow, Approve, Continue). White on brand-700 in light
// (about 5.9:1; brand-600 was 4.1:1, under WCAG 2.2 AA), darker still on hover; the shared solid brand
// control in dark.
export const OAUTH_PRIMARY = `min-h-11 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 ${SOLID_BRAND_DARK_CONTROL}`;

export function OauthShell({ children }: { children: React.ReactNode }) {
  return <AuthStage aside={<ConnectPitch />}>{children}</AuthStage>;
}

// Help link to the connect-an-AI-tool article. Opens in a new tab so it never
// abandons the in-progress OAuth session on this screen.
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
  readOnly,
  onChange,
}: {
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
        let it find and view your plans, but not create, edit, delete, or share them. Leave off for
        full read + write.
      </span>
      <span className="mt-0.5 shrink-0">
        <ToggleSwitch presentational checked={readOnly} label="Read-only access" />
      </span>
    </button>
  );
}
