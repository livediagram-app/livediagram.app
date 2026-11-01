'use client';

import { useSyncExternalStore, type ComponentType } from 'react';
import { FAN_FRONT, FAN_SIZE, FanCard, FanPlate, type PreviewFanProps } from './PreviewFan';

// PreviewFan with only its front card drawn in the first paint (and so in the page's HTML): the two behind it are
// added when the browser is idle. A page with a fan on every category card (the landing page's folded categories)
// would otherwise carry three preview SVGs a card, most of them half hidden behind the front one.
//
// Nothing moves: the plate has its own height and every card is absolutely placed, so adding the back two shifts no
// layout. They fade in over the fan's own transition (`starting:`), and keep the hover and focus fan of PreviewFan, so
// the hover look is unchanged; one idle callback serves every fan on the page, and its `timeout` means a pointer
// resting on a card before the browser is idle still sees them within a couple of seconds.

// How long a browser with no idle callback (Safari) waits, and the longest a busy one may keep the back cards away.
const FALLBACK_MS = 200;
const IDLE_TIMEOUT_MS = 2000;

let idle = false;
let scheduled = false;
const waiting = new Set<() => void>();

function fire() {
  idle = true;
  const callbacks = [...waiting];
  waiting.clear();
  for (const cb of callbacks) cb();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  if (typeof requestIdleCallback === 'function')
    requestIdleCallback(fire, { timeout: IDLE_TIMEOUT_MS });
  else setTimeout(fire, FALLBACK_MS);
}

function subscribe(wake: () => void) {
  // Already idle: nothing will ever wake it.
  if (idle) return () => {};
  waiting.add(wake);
  schedule();
  return () => {
    waiting.delete(wake);
  };
}

// True once the browser has been idle after the page's first paint (and for ever after on this page). The first paint,
// the server's and the hydrating client's, is always without.
function useIdle(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => idle,
    () => false,
  );
}

export function DeferredPreviewFan<Kind extends string>({
  Preview,
  kinds,
  plateClassName,
  cardClassName,
}: PreviewFanProps<Kind> & {
  // The product's preview of one template (its TemplatePreview).
  Preview: ComponentType<{ kind: Kind }>;
}) {
  const ready = useIdle();
  const shown = kinds.slice(0, FAN_SIZE);
  // The front card is the one in the middle; a category with a single template has only that card, in the first place.
  const front = Math.min(FAN_FRONT, shown.length - 1);
  return (
    <FanPlate plateClassName={plateClassName}>
      {shown.map((kind, i) =>
        ready || i === front ? (
          <FanCard
            key={kind}
            Preview={Preview}
            kind={kind}
            index={i}
            cardClassName={cardClassName}
            // The cards added at idle fade up from nothing, over the transition they already carry.
            extraClassName={i === front ? '' : 'starting:opacity-0'}
          />
        ) : null,
      )}
    </FanPlate>
  );
}
