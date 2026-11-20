'use client';

// The switch between the knowledgebase's three views (docs/specs/030-knowledgebase/search-and-ask.md "The three
// views"): Pages | Ask | AI Knowledge, a rounded track with the showing view white and softly raised. Each segment is
// a real link to the view's address (so it opens in a new tab, and says where it goes), marked `aria-current` when
// it is the view showing; a plain press moves in place, as a new history entry.
import type { MouseEvent, ReactNode } from 'react';
import { HoverCard } from '@liveknowledge/ui';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import {
  KNOWLEDGE_VIEWS,
  showKnowledgeView,
  type KnowledgeView,
} from '@/lib/knowledge-ask/knowledge-view';
import { useKnowledgeView, useKnowledgeViewHref } from '@/lib/knowledge-ask/useKnowledgeView';
import { track } from '@/lib/telemetry';
import { AiViewIcon, AskViewIcon, PagesViewIcon } from './ask-icons';

const ICONS: Record<KnowledgeView, ReactNode> = {
  pages: <PagesViewIcon />,
  ask: <AskViewIcon />,
  ai: <AiViewIcon />,
};

const TRACK = 'flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800';
const SEGMENT =
  'optical-edges flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-medium motion-safe:transition-colors motion-safe:duration-micro focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600';
const SEGMENT_ON = 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white';
const SEGMENT_OFF = 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white';

// Each view's own telemetry call, so the pair and its type stay literal (telemetry-coverage.test.ts).
function trackView(view: KnowledgeView): void {
  if (view === 'ask') track('UI', 'Opened', 'AskView');
  else if (view === 'ai') track('UI', 'Opened', 'AiKnowledgeView');
  else track('UI', 'Opened', 'PagesView');
}

/** A plain press moves in place; a press that asks for a new tab or window is the link's own. */
function pressed(
  event: MouseEvent<HTMLAnchorElement>,
  view: KnowledgeView,
  current: KnowledgeView,
) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  event.preventDefault();
  if (view === current) return;
  trackView(view);
  showKnowledgeView(view);
}

export function KnowledgeViewSwitch({
  placement,
}: {
  // 'corner': in the top row's card, the size of its buttons, names dropped when the card goes compact.
  // 'row': a phone's own row, each segment a 44px target sharing the width.
  placement: 'corner' | 'row';
}) {
  const current = useKnowledgeView();
  const href = useKnowledgeViewHref(useEditorChrome((s) => (s.hydrated ? s.activeId : null)));
  const corner = placement === 'corner';
  return (
    <nav
      aria-label="Knowledgebase Views"
      data-knowledge-switch={placement}
      className={corner ? `${TRACK} phone:hidden` : `${TRACK} w-full`}
    >
      {KNOWLEDGE_VIEWS.map(({ view, label, about }) => (
        <HoverCard
          key={view}
          title={label}
          description={about}
          {...(corner ? {} : { block: true, className: 'min-w-0 flex-1' })}
        >
          <a
            href={href(view)}
            aria-current={view === current ? 'page' : undefined}
            data-knowledge-view-link={view}
            onClick={(event) => pressed(event, view, current)}
            className={`${SEGMENT} ${view === current ? SEGMENT_ON : SEGMENT_OFF} ${
              corner ? 'h-8 px-2.5 [[data-compact]_&]:px-2' : 'h-11 w-full px-2'
            }`}
          >
            <span aria-hidden className="shrink-0">
              {ICONS[view]}
            </span>
            <span className={corner ? '[[data-compact]_&]:sr-only' : 'truncate'}>{label}</span>
          </a>
        </HoverCard>
      ))}
    </nav>
  );
}
