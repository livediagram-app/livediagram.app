'use client';

import { isMadeByAiSource } from '@livediagram/api-schema';
import { HoverCard } from '@livediagram/ui';
import { SparkleIcon } from '@/components/primitives/explorer-icons';

// The Made by AI badge (docs/specs/013-workspace/explorer-filters.md "Dimensions"): every row and
// card of a document an AI made carries it, so what the Made by AI filter reads is visible. A
// sparkle and the words, never colour alone; built like the Local only pill, in violet.

export const MADE_BY_AI_LABEL = 'Made by AI';
export const MADE_BY_AI_DESCRIPTION =
  'Made by an AI tool, through the AI assistant or the MCP server. Filter with Made by AI.';

// The words meet 4.5:1 on the fill, the ring 3:1 against the row.
const PILL =
  'optical-edges inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold leading-4 bg-violet-50 text-violet-800 ring-1 ring-violet-600 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-400';

/** Whether a listed document was made by AI: the AI assistant or the MCP made it (a CLI document is not). */
export function isMadeByAi(doc: { source?: string | null }): boolean {
  return isMadeByAiSource(doc.source);
}

/** `compact` (the floating panel's narrow rows): the sparkle alone, its words kept for assistive
 *  technology and on hover. */
export function MadeByAiPill({ compact = false }: { compact?: boolean }) {
  return (
    <HoverCard title={MADE_BY_AI_LABEL} description={MADE_BY_AI_DESCRIPTION}>
      <span className={compact ? `${PILL} px-1` : PILL} data-made-by-ai>
        <SparkleIcon size={10} />
        <span className={compact ? 'sr-only' : 'text-optical-line'}>{MADE_BY_AI_LABEL}</span>
      </span>
    </HoverCard>
  );
}
