// The Space's text for Summarise with AI (blueprint automations.md "The kit": text;
// liveworkspace/docs/specs/018-automations/automations.md "AI"): the outline view the api already serves agents
// (docs/specs/024-agents/document-views.md), one tab's or every tab's in order under its name. Read a tab at a time
// and stopped once the model's window is full, so a Space of many large tabs never holds more than one body. The
// Suggestion Box's notes are never read here: they reach no tab, API or agent read
// (docs/specs/009-elements/team-pieces.md "Suggestion Box").
import { AI_SUMMARISE_TEXT_MAX } from '@liveworkspace/automations/item';
import { renderView } from '@livehuddle/document-views';
import { getTab } from '../../db/tabs';
import type { DocumentEnv, TabDTO } from '../../types';
import { readDocumentTabs } from '../document-content';

function outlineOf(tab: TabDTO, tabIds: readonly string[]): string {
  const rendered = renderView({ view: 'outline' }, tab, {
    rev: tab.rev,
    tabIds: [...tabIds],
    selected: null,
  });
  return rendered.ok ? rendered.text : '';
}

/** One tab's outline, or the whole document's: each tab under its name, until the model's window is full. */
export async function documentText(
  env: DocumentEnv,
  documentId: string,
  tabId?: string,
): Promise<string> {
  const tabs = await readDocumentTabs(env, documentId);
  const ids = tabs.map((t) => t.id);
  if (tabId !== undefined) {
    const tab = await getTab(env, documentId, tabId);
    return tab ? outlineOf(tab, ids) : '';
  }
  const parts: string[] = [];
  let held = 0;
  for (const listed of tabs) {
    if (held >= AI_SUMMARISE_TEXT_MAX) break;
    const tab = await getTab(env, documentId, listed.id);
    if (!tab) continue;
    const part = `# ${listed.name}\n${outlineOf(tab, ids)}`;
    parts.push(part);
    held += part.length + 2;
  }
  return parts.join('\n\n');
}
