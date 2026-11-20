'use client';

// The knowledgebase's three views as tabs at the footer's left (docs/specs/030-knowledgebase/page-surface.md "The
// footer"): Pages | Ask | AI Knowledge, drawn as the other liveworkspace editors draw the tabs of their footer tab
// bar (the shared tab shape, @liveworkspace/workbench tab-shape). They are views, not a person's tabs: no add,
// close, drag or menu. Each is a real link to the view's address (so it opens in a new tab, and Back returns),
// marked `aria-current` when it is the view showing; a plain press moves in place, as a new history entry.
import type { MouseEvent, ReactNode } from 'react';
import { HoverCard } from '@liveknowledge/ui';
import {
  TAB_LIST_CLASS,
  TAB_NAME_BUTTON_CLASS,
  TAB_NAME_CLASS,
  fixedTabShapeClass,
} from '@liveworkspace/workbench/components/chrome/tab-shape';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { AiViewIcon, AskViewIcon, PagesViewIcon } from '@/components/ask/ask-icons';
import { useKnowledgeViewsOffered } from '@/components/ask/useKnowledgeViewsOffered';
import {
  KNOWLEDGE_VIEWS,
  showKnowledgeView,
  type KnowledgeView,
} from '@/lib/knowledge-ask/knowledge-view';
import { useKnowledgeView, useKnowledgeViewHref } from '@/lib/knowledge-ask/useKnowledgeView';
import { track } from '@/lib/telemetry';

const ICONS: Record<KnowledgeView, ReactNode> = {
  pages: <PagesViewIcon />,
  ask: <AskViewIcon />,
  ai: <AiViewIcon />,
};

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

// The open tab's ink: the app's own, where another editor's tab wears its tab theme's accent.
const OPEN_INK = 'text-slate-900 dark:text-white';

/** The three tabs, or nothing for a session that is not offered the views (useKnowledgeViewsOffered). */
export function KnowledgeViewTabs() {
  const offered = useKnowledgeViewsOffered();
  const current = useKnowledgeView();
  const href = useKnowledgeViewHref(useEditorChrome((s) => (s.hydrated ? s.activeId : null)));
  if (!offered) return null;
  return (
    <nav
      aria-label="Knowledgebase Views"
      data-knowledge-view-tabs=""
      // The bar's full height, the tabs standing on its foot; a phone's three tabs share the row.
      className={`${TAB_LIST_CLASS} self-stretch phone:min-w-0 phone:flex-1 phone:shrink`}
    >
      {KNOWLEDGE_VIEWS.map(({ view, label, short, about }) => {
        const open = view === current;
        return (
          <HoverCard
            key={view}
            title={label}
            description={about}
            className="self-end phone:min-w-0 phone:flex-1"
          >
            <span
              data-knowledge-view-tab={view}
              data-open={open ? '' : undefined}
              className={`${fixedTabShapeClass(open)} ${open ? OPEN_INK : ''} phone:h-11 phone:w-full phone:justify-center phone:px-2`}
            >
              <a
                href={href(view)}
                aria-label={label}
                aria-current={open ? 'page' : undefined}
                data-tab-key=""
                data-knowledge-view-link={view}
                onClick={(event) => pressed(event, view, current)}
                className={`${TAB_NAME_BUTTON_CLASS} phone:h-11`}
              >
                <span aria-hidden className="flex shrink-0">
                  {ICONS[view]}
                </span>
                {/* The full name, and a phone's short one; the link is named by the full name either way. */}
                <span className={`${TAB_NAME_CLASS} phone:hidden`}>{label}</span>
                <span className={`${TAB_NAME_CLASS} hidden phone:inline`}>{short}</span>
              </a>
            </span>
          </HoverCard>
        );
      })}
    </nav>
  );
}
