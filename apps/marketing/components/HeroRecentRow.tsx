'use client';

import type { RecentDiagram } from '@livediagram/api-schema';
import {
  ChevronRightIcon,
  EDITOR_MODE_ICONS,
  EXPLORER_HOME_HREF,
  relativeSince,
  TeamIcon,
} from '@livediagram/ui';
import { useState } from 'react';
import { useRecentDiagrams, useRecentThumb } from './useRecentDiagrams';

// Pick up where you left off (docs/specs/019-marketing/returning-visitor.md): a returning visitor's four
// most recent diagrams under the hero's search, and a link to Explorer Home. Nothing for someone new.
// Its box is reserved before first paint only when <html data-returning> says this browser holds a
// recent-diagrams note (.hero-recent-slot in app/hero-band.css), so drawing the tiles after hydration
// moves nothing below, and a new visitor gets no empty gap.

const HERO_RECENT_LIMIT = 4;

export function HeroRecentRow() {
  const recent = useRecentDiagrams();
  return (
    <div className="hero-recent-slot mx-auto flex w-full max-w-5xl flex-col items-center">
      {recent ? <RecentRow diagrams={recent.slice(0, HERO_RECENT_LIMIT)} /> : null}
    </div>
  );
}

function RecentRow({ diagrams }: { diagrams: readonly RecentDiagram[] }) {
  // Read once per mount: "2 hours ago" need not tick while the page is open.
  const [now] = useState(() => Date.now());
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p id="hero-recent-label" className="text-sm text-(--hero-muted)">
        Pick up where you left off
      </p>
      <ul
        aria-labelledby="hero-recent-label"
        className="grid w-full grid-cols-2 gap-2.5 lg:flex lg:w-auto lg:flex-nowrap lg:justify-center"
      >
        {diagrams.map((d) => (
          <li key={d.id} className="min-w-0">
            <RecentTile diagram={d} now={now} />
          </li>
        ))}
      </ul>
      <a
        href={EXPLORER_HOME_HREF}
        className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-(--hero-link) transition-colors hover:underline"
      >
        <span className="text-optical-centre">Open Explorer Home</span>
        <ChevronRightIcon size={14} aria-hidden />
      </a>
    </div>
  );
}

function RecentTile({ diagram, now }: { diagram: RecentDiagram; now: number }) {
  const thumb = useRecentThumb(diagram.id, diagram.savedAt);
  const Icon = EDITOR_MODE_ICONS[diagram.mode ?? 'diagram'];
  return (
    <a
      href={`/document/${encodeURIComponent(diagram.id)}`}
      className="group flex h-14 items-center gap-3 rounded-xl border border-(--hero-chip-border) bg-(--hero-chip-bg) p-2 pr-4 text-left transition duration-micro hover:border-(--hero-chip-border-hover) motion-safe:hover:-translate-y-0.5 lg:w-56"
    >
      <span
        className="relative h-10 w-16 shrink-0 overflow-hidden rounded-md bg-(--hero-thumb)"
        style={
          thumb.status === 'ready' && thumb.backgroundColor
            ? { backgroundColor: thumb.backgroundColor }
            : undefined
        }
      >
        {thumb.status === 'ready' ? (
          // A blob URL from the browser's own cache (static export: no image optimiser).
          <img
            src={thumb.url}
            alt=""
            className="hero-recent-thumb absolute inset-0 h-full w-full object-contain p-0.5"
          />
        ) : thumb.status === 'none' ? (
          <span className="absolute inset-0 flex items-center justify-center text-(--hero-icon)">
            <Icon size={18} />
          </span>
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1 text-sm font-semibold text-(--hero-chip-text)">
          {diagram.teamName != null ? (
            <TeamIcon size={12} data-team-mark="" className="shrink-0 text-(--hero-muted)" />
          ) : null}
          <span className="truncate">{diagram.name || 'Untitled diagram'}</span>
        </span>
        <span className="block text-xs text-(--hero-muted)">
          {relativeSince(diagram.savedAt, now)}
        </span>
      </span>
    </a>
  );
}
