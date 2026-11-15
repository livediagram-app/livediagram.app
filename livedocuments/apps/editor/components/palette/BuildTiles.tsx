'use client';

// The Animation row's Build section (docs/specs/012-collaboration/presentation-mode.md "Setting builds up"): when the
// selection comes onto a presented slide, and how. Effect tiles (None, Appear, Fade, Rise), each a live miniature of a
// slide whose third line builds in that way, then, once a build is set, Order: a tile per step the slide has and New
// for a step after them. Every write goes to the whole selection through the element-style ops, one undo step each.

import {
  BUILD_EFFECTS,
  buildOf,
  nextBuildOrder,
  slideBuildOrders,
  withBuild,
  type BuildEffect,
  type Element,
} from '@livedocuments/document';
import { AnimationPreviewTile } from '@/components/palette/AnimationPreviewTile';
import { BorderGrid } from '@/components/palette/context-menu-rows';
import { SizeButton } from '@/components/palette/palette-controls';
import type { ElementStyleOps } from '@/lib/element-style-ops';

const EFFECT_LABEL: Record<BuildEffect, string> = { appear: 'Appear', fade: 'Fade', rise: 'Rise' };

// The frame each miniature rests on: Fade and Rise mid-way in, so the three read apart at a glance; Appear shown.
const FRAME: Record<BuildEffect, number> = { appear: 0.7, fade: 0.32, rise: 0.32 };

/** A tiny slide: a title bar and two lines already there, and a third that builds in by `effect` (None: no build). */
export function BuildPreview({ effect }: { effect: BuildEffect | null }) {
  const line = 'block h-[3px] rounded-full bg-current';
  return (
    <span className="flex h-[28px] w-[40px] flex-col gap-[4px] rounded-[4px] p-[5px] ring-1 ring-current/30">
      <span className={`${line} w-[60%] opacity-90`} />
      <span className={`${line} w-full opacity-45`} />
      <span className={`${line} w-[80%] opacity-45`} />
      <span
        data-build-mini={effect ?? 'none'}
        className={`${line} w-[70%] bg-brand-500 ${effect ? `lvd-build-mini-${effect}` : ''}`}
      />
    </span>
  );
}

export function BuildTiles({
  selection,
  slideElements,
  ops,
}: {
  // The selection (the menu's members); only the ones that take a build are written.
  selection: readonly Element[];
  // Every element on the slide the selection is on, for its steps and the next one.
  slideElements: readonly Element[];
  ops: ElementStyleOps;
}) {
  const first = selection.map(buildOf).find(Boolean);
  const effect = first?.effect ?? null;
  const orders = slideBuildOrders(slideElements);
  const last = orders.at(-1);
  // The selection is the last step on its own: a New step would be the step it already is.
  const selectedIds = new Set(selection.map((el) => el.id));
  const aloneAtLast =
    last !== undefined &&
    slideElements.every((el) => buildOf(el)?.order !== last || selectedIds.has(el.id));
  const commit = (map: (el: Element) => Element) => ops.commit(map, 'Build');

  const setEffect = (v: BuildEffect | null) => {
    if (v === null) return commit((el) => withBuild(el, null));
    // A first build takes the step after the slide's last; one already set keeps its step.
    const order = first?.order ?? nextBuildOrder(slideElements);
    commit((el) => withBuild(el, { order: buildOf(el)?.order ?? order, effect: v }));
  };
  const setOrder = (order: number) =>
    commit((el) => withBuild(el, { order, effect: buildOf(el)?.effect ?? effect ?? 'appear' }));

  return (
    <>
      <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
        {[null, ...BUILD_EFFECTS].map((v) => (
          <AnimationPreviewTile
            key={v ?? 'none'}
            active={effect === v}
            label={v ? EFFECT_LABEL[v] : 'None'}
            frame={v ? FRAME[v] : 0}
            onClick={() => {
              if (effect !== v) setEffect(v);
            }}
          >
            <BuildPreview effect={v} />
          </AnimationPreviewTile>
        ))}
      </div>
      {first ? (
        <div className="px-2 pb-1.5">
          <BorderGrid label="Order" cols={5}>
            {orders.map((order, i) => (
              <SizeButton
                key={order}
                active={first.order === order}
                label={`Step ${i + 1}`}
                onClick={() => setOrder(order)}
              >
                <span className="text-[11px] font-medium tabular-nums leading-none">{i + 1}</span>
              </SizeButton>
            ))}
            {last !== undefined && !aloneAtLast ? (
              <SizeButton active={false} label="New Step" onClick={() => setOrder(last + 1)}>
                <span className="text-[10px] leading-none">New</span>
              </SizeButton>
            ) : null}
          </BorderGrid>
        </div>
      ) : null}
    </>
  );
}
