'use client';

// Page Health's Review Period value as a link (docs/specs/030-knowledgebase/verification.md "The Review Period"; owner
// 2026-11-22, was a pencil before the value): "Every 90 Days", underlined on hover, for an Editor of the whole
// knowledgebase only (PageRail decides, with useSettingsOffered), that opens the period in a popover under it (a
// sheet on a phone). Its hover card says it is the whole knowledgebase's. The popover's code is fetched when the pointer
// or focus first reaches the button, and the popover opens once it is in, so its first row takes focus at once.
import { useCallback, useId, useState, type ComponentType } from 'react';
import { HoverCard, ResponsivePopover } from '@liveknowledge/ui';
import {
  CHANGE_PERIOD_HINT,
  CHANGE_PERIOD_NAME,
} from '@/lib/knowledge-settings/review-period-words';
import { track } from '@/lib/telemetry';

type Panel = ComponentType<{ titleId: string }>;

// One fetch for the session, shared by every button that asks.
let panelLoad: Promise<Panel> | null = null;
const loadPanel = (): Promise<Panel> =>
  (panelLoad ??= import('./ReviewPeriodPanel').then((m) => m.ReviewPeriodPanel));

export function ReviewPeriodButton({ label }: { label: string }) {
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
          aria-label={`${CHANGE_PERIOD_NAME}: ${label}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-review-period-change=""
          onPointerEnter={warm}
          onFocus={warm}
          onClick={(e) => onClick(e.currentTarget)}
          // A link in the brand's ink, underlined on hover and while open; 44 px tall on a phone.
          className="cursor-pointer rounded-sm font-medium tracking-tight text-brand-700 underline decoration-brand-300 decoration-dotted underline-offset-[3px] motion-safe:transition-colors motion-safe:duration-micro hover:text-brand-800 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 aria-expanded:decoration-solid phone:min-h-11 dark:text-brand-300 dark:decoration-brand-500/60 dark:hover:text-brand-200"
        >
          <span data-review-period="">{label}</span>
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
