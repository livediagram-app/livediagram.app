'use client';

// The X on the open Connect MCP tab (docs/specs/030-knowledgebase/mcp-connect.md "Closing the tab"): hides the tab for
// this person in every knowledgebase, by turning off their Show Connect MCP setting, and moves to Pages. Settings >
// Appearance brings it back.
import { CloseIcon, Tooltip } from '@liveknowledge/ui';
import { useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { showKnowledgeView } from '@/lib/knowledge-ask/knowledge-view';
import { commitUserPreferences } from '@/lib/user-preferences';
import { track } from '@/lib/telemetry';

export const HIDE_CONNECT_LABEL = 'Hide Connect MCP';
export const HIDE_CONNECT_TIP = 'Hide Connect MCP. Settings, Appearance brings it back';

// The tabs' trailing button: 24 px (a 44 px target on touch), the tab's ink, its own inset wash on hover and the
// brand ring on keyboard focus.
const CLOSE_CLASS =
  'relative flex size-6 shrink-0 cursor-pointer touch-target items-center justify-center rounded-md text-current/60 outline-none transition-colors duration-150 hover:bg-slate-400/[0.2] hover:text-current focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-slate-400/[0.14] motion-reduce:transition-none';

export function ConnectTabClose() {
  const chrome = useEditorChromeStore();
  const hide = () => {
    // Reported before it is written, as every settings flip is, so the event goes out whatever the write does.
    track('UI', 'Toggled', 'ConnectMcpTabOff');
    const now = chrome.get();
    const prefs = now.userPreferences ?? {};
    now.setUserPreferences(
      commitUserPreferences(
        prefs,
        { ...prefs, showConnectMcp: false },
        now.selfParticipant?.id ?? null,
      ),
    );
    // In place: Back should not return to a view whose tab is gone.
    showKnowledgeView('pages', { replace: true });
  };
  return (
    <Tooltip label={HIDE_CONNECT_TIP}>
      <button
        type="button"
        aria-label={HIDE_CONNECT_LABEL}
        data-connect-tab-close=""
        onClick={hide}
        className={CLOSE_CLASS}
      >
        <CloseIcon size={14} />
      </button>
    </Tooltip>
  );
}
