'use client';

// The frame of the OAuth pages (the consent page and the device page, docs/specs/015-api/blueprints/cli.md
// "The device grant"): the brand over a card on the animated lines backdrop, and the help link to the
// connect-an-AI-tool article.
import { Brand, Glyph, SOLID_BRAND_DARK_CONTROL } from '@livediagram/ui';
import { AnimatedLinesBackdrop } from '@/components/canvas/AnimatedLinesBackdrop';

// The primary action of every page in the shell (Allow, Approve, Continue). White on brand-700 in light
// (about 5.9:1; brand-600 was 4.1:1, under WCAG 2.2 AA), darker still on hover; the shared solid brand
// control in dark.
export const OAUTH_PRIMARY = `rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 ${SOLID_BRAND_DARK_CONTROL}`;

export function OauthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-50 px-4 dark:bg-slate-950">
      {/* Same animated lines backdrop as the new-document page; decorative,
          reduced-motion aware, hidden below sm. */}
      <AnimatedLinesBackdrop />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-xl backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mb-5">
          <Brand href="/" size="md" />
        </div>
        {children}
      </div>
    </main>
  );
}

// Help link to the connect-an-AI-tool article. Opens in a new tab so it never
// abandons the in-progress OAuth session on this screen.
export function OauthHelpLink() {
  return (
    <a
      href="/help/account-and-data/connect-ai-mcp/"
      target="_blank"
      rel="noopener noreferrer"
      className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-brand-600 dark:hover:text-brand-400"
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
