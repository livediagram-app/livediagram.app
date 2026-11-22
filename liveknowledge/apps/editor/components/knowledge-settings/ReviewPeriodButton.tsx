'use client';

// Page Health's pencil, beside the Review Period (docs/specs/030-knowledgebase/verification.md "The Review Period"):
// a small bordered icon button with no label (so the period beside it shows in full), for an Editor of the whole
// knowledgebase only (PageRail decides, with useSettingsOffered), that opens the period in a popover under it (a
// sheet on a phone). Its hover card says it is the whole knowledgebase's. The popover's code is fetched when the pointer
// or focus first reaches the button, and the popover opens once it is in, so its first row takes focus at once.
import { useCallback, useId, useState, type ComponentType } from 'react';
import { lucidePencil } from '@liveworkspace/icons/lucide';
import { HoverCard, ResponsivePopover, lucideGlyph } from '@liveknowledge/ui';
import {
  CHANGE_PERIOD_HINT,
  CHANGE_PERIOD_NAME,
} from '@/lib/knowledge-settings/review-period-words';
import { track } from '@/lib/telemetry';

const PencilIcon = lucideGlyph(lucidePencil, 11);

type Panel = ComponentType<{ titleId: string }>;

// One fetch for the session, shared by every button that asks.
let panelLoad: Promise<Panel> | null = null;
const loadPanel = (): Promise<Panel> =>
  (panelLoad ??= import('./ReviewPeriodPanel').then((m) => m.ReviewPeriodPanel));

export function ReviewPeriodButton() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [Panel, setPanel] = useState<Panel | null>(null);
  const titleId = useId();
  const open = anchor !== null && Panel !== null;
  const close = useCallback(() => setAnchor(null), []);
  const warm = () => void loadPanel().catch(() => (panelLoad = null));
  const onClick = (el: HTMLElement) => {
    if (open) return close();
    track('UI', 'Opened', 'ReviewPeriod');
    loadPanel().then(
      (loaded) => {
        setPanel(() => loaded);
        setAnchor(el);
      },
      () => (panelLoad = null),
    );
  };
  return (
    <>
      <HoverCard title={CHANGE_PERIOD_NAME} description={CHANGE_PERIOD_HINT}>
        <button
          type="button"
          aria-label={CHANGE_PERIOD_NAME}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-review-period-change=""
          onPointerEnter={warm}
          onFocus={warm}
          onClick={(e) => onClick(e.currentTarget)}
          // The sidebar foot's bordered look (New Page, Hide Pages), 18 px so "Every 90 Days" keeps the label's line
          // at the rail's width; 44 px on a phone.
          className="flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] border border-slate-200 bg-white text-slate-600 motion-safe:transition-colors motion-safe:duration-micro hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600 aria-expanded:border-brand-300 aria-expanded:bg-brand-50 aria-expanded:text-brand-700 phone:size-11 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100 dark:aria-expanded:border-brand-400/60 dark:aria-expanded:bg-brand-500/20 dark:aria-expanded:text-brand-100"
        >
          <PencilIcon />
        </button>
      </HoverCard>
      {Panel ? (
        <ResponsivePopover
          open={open}
          onClose={close}
          anchor={anchor}
          titleId={titleId}
          width={360}
        >
          <Panel titleId={titleId} />
        </ResponsivePopover>
      ) : null}
    </>
  );
}
