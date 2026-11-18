'use client';

import { useContext, useSyncExternalStore } from 'react';
import { HoverCard } from '@livediagram/ui';
import type { ServiceState } from '@livediagram/api-schema';
import { useCanvasZoom } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { ADORNMENT_MIN_ZOOM } from '@/components/canvas/element-badges';
import { serviceStatusCopy, type ServiceStatusCopy } from '@/lib/service-status-copy';
import {
  ServiceStatusContext,
  type ServiceStatusSnapshot,
  type ServiceStatusStore,
} from '@/lib/service-status-store';

// A bound shape's live status badge (docs/specs/009-elements/live-status.md "The badge"): a pill on the bottom-right
// corner, half outside the shape, with a coloured dot and the state's word. Read-only for every role: it takes the
// pointer only so its hover card opens, and a press on it bubbles to the shape, which selects it as before. Not an
// element indicator, so a presented slide shows it too; exports draw from the document and never show it.

// The dot and the word's ink per state: the 700 ink on the white pill, the 300 on the slate one in dark mode.
const TONE: Record<ServiceState, { dot: string; ink: string }> = {
  up: { dot: 'bg-emerald-500 dark:bg-emerald-400', ink: 'text-emerald-700 dark:text-emerald-300' },
  degraded: { dot: 'bg-amber-500 dark:bg-amber-400', ink: 'text-amber-700 dark:text-amber-300' },
  down: { dot: 'bg-rose-500 dark:bg-rose-400', ink: 'text-rose-700 dark:text-rose-300' },
  unknown: { dot: 'bg-slate-400 dark:bg-slate-500', ink: 'text-slate-600 dark:text-slate-300' },
};

const EMPTY: ServiceStatusSnapshot = { statuses: {}, now: 0 };
const NO_STORE: Pick<ServiceStatusStore, 'subscribe' | 'getSnapshot'> = {
  subscribe: () => () => {},
  getSnapshot: () => EMPTY,
};

export function ServiceStatusBadge({ url }: { url: string }) {
  const store = useContext(ServiceStatusContext) ?? NO_STORE;
  const { statuses, now } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const zoom = useCanvasZoom();
  const status = Object.hasOwn(statuses, url) ? statuses[url] : undefined;
  // Nothing until the room has checked it, and nothing at an overview zoom, like the other adornments.
  if (!status || zoom < ADORNMENT_MIN_ZOOM) return null;
  const copy = serviceStatusCopy(status, url, now);
  return (
    <HoverCard
      title={copy.title}
      description={copy.detail}
      className="pointer-events-auto absolute bottom-0 right-2.5 z-[1] translate-y-1/2"
    >
      <ServiceStatusPill copy={copy} />
    </HoverCard>
  );
}

/** The pill itself: the badge's face, and the Live Status dialog's current state. */
export function ServiceStatusPill({ copy }: { copy: ServiceStatusCopy }) {
  const tone = TONE[copy.state];
  return (
    <span
      role="img"
      aria-label={copy.label}
      data-service-status={copy.state}
      className="flex h-[18px] items-center gap-1 rounded-full bg-white px-1.5 shadow-sm ring-1 ring-slate-900/10 dark:bg-slate-800 dark:ring-white/15"
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      <span aria-hidden className={`text-[10px] font-semibold leading-none ${tone.ink}`}>
        <span className="text-optical-centre">{copy.word}</span>
      </span>
    </span>
  );
}
