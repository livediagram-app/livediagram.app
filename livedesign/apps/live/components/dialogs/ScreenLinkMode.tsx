'use client';

// Link Element's Screen mode (docs/specs/007-editor/wireframe-pages.md "Setting a link"): the transition, the tab's
// screens (the element's own shown, never pressable), Back, and a note when the element's screen link is broken.
// Pressing a row links the element with the chosen transition, as the Tab mode's rows do.
import { useState } from 'react';
import { SegmentedRadio } from '@liveworkspace/workbench/components/primitives/SegmentedRadio';
import {
  isScreenLink,
  pageLinkTransitionOf,
  type ElementLink,
  type PageLinkTransition,
  type ScreenLink,
} from '@livedesign/design';
import type { ScreenChoice } from '@/lib/screen-link-choices';
import { BackLinkGlyph, ScreenLinkGlyph } from '@/components/canvas/screen-link-glyphs';
import { RowButton } from './link-picker-rows';

const TRANSITIONS: readonly { id: PageLinkTransition; label: string }[] = [
  { id: 'instant', label: 'Instant' },
  { id: 'slide', label: 'Slide' },
  { id: 'dissolve', label: 'Dissolve' },
];

const CHIP =
  'ml-2 inline-flex shrink-0 items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300';

/** The link a Screen mode row writes: Instant is the absent transition, so it is never stored. */
export function screenLinkWith(
  target: { kind: 'page'; pageId: string } | { kind: 'back' },
  transition: PageLinkTransition,
): ScreenLink {
  return transition === 'instant' ? target : { ...target, transition };
}

export function ScreenLinkMode({
  screens,
  currentLink,
  onCommit,
}: {
  screens: readonly ScreenChoice[];
  currentLink: ElementLink | null;
  onCommit: (link: ScreenLink) => void;
}) {
  const current = isScreenLink(currentLink) ? currentLink : null;
  const [transition, setTransition] = useState<PageLinkTransition>(
    current ? pageLinkTransitionOf(current) : 'instant',
  );
  const linkedPageId = current?.kind === 'page' ? current.pageId : null;
  const broken = linkedPageId !== null && !screens.some((s) => s.id === linkedPageId);
  return (
    <div className="flex flex-col gap-4">
      {broken ? (
        <p
          role="status"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          This link&apos;s screen was deleted. Pick another screen, or remove the link.
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Transition</span>
        <SegmentedRadio
          label="Transition"
          options={TRANSITIONS}
          value={transition}
          onChange={setTransition}
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          How the screen changes when the element is pressed in Prototype mode.
        </p>
      </div>
      <ul className="flex flex-col gap-1" aria-label="Screens">
        {screens.map((s) => (
          <li key={s.id}>
            <RowButton
              active={linkedPageId === s.id}
              disabled={s.here}
              icon={<ScreenLinkGlyph />}
              onClick={() => onCommit(screenLinkWith({ kind: 'page', pageId: s.id }, transition))}
            >
              <span className="truncate">{s.name}</span>
              {s.here ? (
                <span className={CHIP}>
                  <span className="text-optical-line text-optical-caps [--optical-tracking:0.025em]">
                    this screen
                  </span>
                </span>
              ) : null}
            </RowButton>
          </li>
        ))}
        <li className="mt-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <RowButton
            active={current?.kind === 'back'}
            icon={<BackLinkGlyph />}
            onClick={() => onCommit(screenLinkWith({ kind: 'back' }, transition))}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate">Back</span>
              <span className="truncate text-[11px] font-normal text-slate-500 dark:text-slate-400">
                The screen shown before
              </span>
            </span>
          </RowButton>
        </li>
      </ul>
    </div>
  );
}
