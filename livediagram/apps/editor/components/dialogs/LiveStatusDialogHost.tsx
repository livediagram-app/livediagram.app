'use client';

import { useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import type { Element, ShapeElement } from '@livediagram/document';
import { canBindLiveStatus } from '@/lib/live-status-input';
import type { ServiceStatusSnapshot, ServiceStatusStore } from '@/lib/service-status-store';
import { track } from '@/lib/telemetry';

const LiveStatusDialog = dynamic(
  () => import('@/components/dialogs/LiveStatusDialog').then((m) => m.LiveStatusDialog),
  { ssr: false },
);

const EMPTY: ServiceStatusSnapshot = { statuses: {}, now: 0 };
const NO_STORE: Pick<ServiceStatusStore, 'subscribe' | 'getSnapshot'> = {
  subscribe: () => () => {},
  getSnapshot: () => EMPTY,
};

// The Live Status dialog's wiring (docs/specs/009-elements/live-status.md "The Live Status dialog"): an Editor's, on
// a shape that takes a badge. Its writes are one undo step each on the active tab; the room's next round, brought
// forward by the save, checks the new address within seconds. EditorElementDialogs closes it when its shape stops
// qualifying (deleted, locked, the role changed).
export function LiveStatusDialogHost() {
  const {
    liveStatusOpenForId,
    setLiveStatusOpenForId,
    activeTab,
    can,
    commitElements,
    serviceStatuses,
  } = useEditorContext();
  const store = serviceStatuses ?? NO_STORE;
  const { statuses, now } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  if (liveStatusOpenForId === null || can.level !== 'edit') return null;
  const el = activeTab.elements.find((e) => e.id === liveStatusOpenForId);
  if (!el || el.type !== 'shape' || !canBindLiveStatus(el)) return null;
  const id = el.id;
  const url = el.statusUrl;
  return (
    <LiveStatusDialog
      key={id}
      url={url}
      status={url !== undefined && Object.hasOwn(statuses, url) ? statuses[url] : undefined}
      now={now}
      onSave={(next) => {
        commitElements((els) =>
          // The id names the shape checked above: one element, changed in place.
          els.map((e) => (e.id === id ? ({ ...e, statusUrl: next } as Element) : e)),
        );
        track('Element', 'Linked', 'LiveStatus');
      }}
      onRemove={() => {
        commitElements((els) =>
          els.map((e) => {
            if (e.id !== id) return e;
            const { statusUrl: _drop, ...rest } = e as ShapeElement;
            return rest;
          }),
        );
        track('Element', 'Cleared', 'LiveStatus');
      }}
      onClose={() => setLiveStatusOpenForId(null)}
    />
  );
}
