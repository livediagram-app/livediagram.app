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
import { SyncKnowledgebaseButton } from '@/components/ask/SyncKnowledgebaseButton';
import { useKnowledgeViewsOffered } from '@/components/ask/useKnowledgeViewsOffered';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
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
// A view an Offline knowledgebase can't open: the tab stays, quieter, and says why (owner 2026-11-21).
const OFF_INK = 'text-slate-400 dark:text-slate-400/60';

// Why Ask and AI Knowledge are off in a knowledgebase kept Offline: both answer on the server, from the team's key.
export const OFFLINE_VIEW_WHY =
  'This knowledgebase is kept in this browser. Ask and AI Knowledge require your content to be synced to our servers.';

// A view this knowledgebase can't open while it is kept Offline: everything but Pages.
export const offlineOff = (view: KnowledgeView, offline: boolean): boolean =>
  offline && view !== 'pages';

/** The three tabs, or nothing for a session that is not offered the views (useKnowledgeViewsOffered). */
export function KnowledgeViewTabs() {
  const offered = useKnowledgeViewsOffered();
  const current = useKnowledgeView();
  const href = useKnowledgeViewHref(useEditorChrome((s) => (s.hydrated ? s.activeId : null)));
  const offline = useIsOfflineDocument(useEditorChrome((s) => s.documentId));
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
        const off = offlineOff(view, offline);
        return (
          <HoverCard
            key={view}
            title={off ? `${label} Needs Syncing` : label}
            description={off ? OFFLINE_VIEW_WHY : about}
            {...(off ? { action: <SyncKnowledgebaseButton />, pressWithText: true } : {})}
            className="self-end phone:min-w-0 phone:flex-1"
          >
            <span
              data-knowledge-view-tab={view}
              data-open={open ? '' : undefined}
              data-off={off ? '' : undefined}
              className={`${fixedTabShapeClass(open)} ${open ? OPEN_INK : off ? OFF_INK : ''} phone:h-11 phone:w-full phone:justify-center phone:px-2`}
            >
              {/* Off, the link goes nowhere: a press opens the card that says why and holds Sync Knowledgebase. */}
              <a
                {...(off ? { role: 'link', 'aria-disabled': true } : { href: href(view) })}
                tabIndex={0}
                aria-label={label}
                aria-current={open ? 'page' : undefined}
                data-tab-key=""
                data-knowledge-view-link={view}
                onClick={(event) => (off ? event.preventDefault() : pressed(event, view, current))}
                className={`${TAB_NAME_BUTTON_CLASS} ${off ? 'cursor-default!' : ''} phone:h-11`}
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
