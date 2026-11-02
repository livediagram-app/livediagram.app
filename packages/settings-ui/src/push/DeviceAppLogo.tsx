'use client';

// Where a device was turned on, by its logo (liveworkspace/docs/specs/003-accounts/push.md "Settings"): the app's
// prism and wordmark, "live" in its colour (its deep shade on light, its light shade on dark, for contrast), or the
// liveworkspace wordmark. Never the name as plain text.
import type { CSSProperties } from 'react';
import { BrandMark, WorkspaceWordmark } from '@liveworkspace/brand';
import { APP_SITES } from '@liveworkspace/sites';
import type { PushDeviceApp } from '@liveworkspace/settings/push';

export function DeviceAppLogo({ app }: { app: PushDeviceApp }) {
  const site = app === 'liveworkspace' ? undefined : APP_SITES.find((s) => s.name === app);
  if (!site || app === 'liveworkspace') return <WorkspaceWordmark size="xs" />;
  return (
    <span
      data-logotype=""
      className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-tight text-slate-900 dark:text-slate-100"
      style={{ '--site-ink': site.deep, '--site-ink-dark': site.light } as CSSProperties}
    >
      <BrandMark app={app} accentColor={site.accent} className="size-4 shrink-0" />
      <span>
        <span className="text-[var(--site-ink)] dark:text-[var(--site-ink-dark)]">live</span>
        {app.replace(/^live/, '')}
      </span>
    </span>
  );
}
