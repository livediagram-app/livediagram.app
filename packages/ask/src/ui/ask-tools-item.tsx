'use client';

// The Ask AI row in the footer's Tools (liveworkspace/docs/specs/019-ask/ask.md "The tool"; footer-tools-menu.md),
// under Find after Search, in every app but liveknowledge (whose Ask is a tab of its own). It opens inside Tools, and
// Tools stays open beside the canvas while a source is looked at. This module is the row alone: the tool, its model
// and its popovers load when the row is first opened, so an editor's first load carries none of them.
import { lazy, Suspense, useMemo } from 'react';
import { SparkleIcon } from '@liveworkspace/ui';
import { ToolSkeleton } from '@liveworkspace/ui/tool-explainer';
import type { ChromeToolsItem } from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
import { APP_ITEMS } from '@liveworkspace/sites';
import type { AskHost } from './host';

export type { AskHost } from './host';

export const ASK_TOOL_ID = 'ask-ai';

const AskTool = lazy(() => import('./AskTool').then((m) => ({ default: m.AskTool })));

/** The row, for an open item; null with none open (`host` null). */
export function useAskToolsItem(host: AskHost | null): ChromeToolsItem | null {
  return useMemo<ChromeToolsItem | null>(() => {
    if (!host) return null;
    return {
      id: ASK_TOOL_ID,
      group: 'find',
      label: 'Ask AI',
      description: `Ask a question, get an answer from this ${APP_ITEMS[host.app].noun.toLowerCase()}.`,
      icon: <SparkleIcon size={16} />,
      onSelect: () => {},
      // Used alongside the canvas: going to a source leaves the chat open.
      keepOpen: true,
      ...(host.accountId ? {} : { badges: ['Sign In'] }),
      view: (ctx) => (
        <Suspense fallback={<ToolSkeleton label="Loading Ask AI" />}>
          <AskTool host={host} ctx={ctx} />
        </Suspense>
      ),
    };
  }, [host]);
}
