// A page's icon as an agent reads it (docs/specs/030-knowledgebase/page-surface.md "The page icon"): its kind, and
// its emoji or its catalogue icon's id. Agents read it only; a person sets it in the editor.
import { parseTabIcon } from '@liveknowledge/document';
import type { AgentPageIcon } from '@liveknowledge/api-schema';

/** A stored icon as an agent reads it back; undefined for none, or for one that is not valid. */
export function agentPageIconOf(icon: unknown): AgentPageIcon | undefined {
  const parsed = parseTabIcon(icon);
  if (!parsed) return undefined;
  return 'emoji' in parsed
    ? { kind: 'emoji', emoji: parsed.emoji }
    : { kind: 'icon', iconId: parsed.iconId };
}
