import { lucideShieldCheck } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';
import type { CSSProperties } from 'react';
import { AppLogo } from '@/components/landing/AppLogo';
import { aiApps } from '@/lib/ai';

const ShieldIcon = lucideGlyph(lucideShieldCheck, 18);

// What it can do on liveworkspace.app's Build with AI page (liveworkspace/docs/specs/010-site/site.md "Build with
// AI"): a card for each app the one connection reaches, in its accent, with what the AI makes there, then what every
// app shares.
export function AiAppCapabilities() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {aiApps().map(({ app, makes }) => (
        <li
          key={app.id}
          style={{ '--lw-ink': app.deep, '--lw-ink-dark': app.light } as CSSProperties}
          className="rounded-2xl border border-slate-200 border-t-[3px] border-t-[var(--lw-ink)] bg-white p-5 dark:border-slate-700 dark:border-t-[var(--lw-ink-dark)] dark:bg-slate-900"
        >
          <h3>
            <AppLogo app={app} size="sm" />
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{makes}</p>
        </li>
      ))}
      <li className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <ShieldIcon aria-hidden className="text-slate-500 dark:text-slate-400" />
          In every app
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Find, read, share, rename, trash and restore anything you own or your teams share, and
          comment on it. Read-only if you prefer.
        </p>
      </li>
    </ul>
  );
}
