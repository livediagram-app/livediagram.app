// The design's text for Summarise with AI (blueprint automations.md "The kit": text;
// liveworkspace/docs/specs/018-automations/automations.md "AI"): the `pages` view the api already serves agents
// (docs/specs/024-agents/pages-for-agents.md "Reading: the pages view"): each page (a frame: a logo, a wireframe
// screen, a photo) with its elements and their text. One tab's, or every tab's in order under its name, read a tab
// at a time and stopped once the model's window is full, so a design of many large tabs never holds more than one
// body.
import { AI_SUMMARISE_TEXT_MAX } from '@liveworkspace/automations/item';
import { renderView } from '@livedesign/design-views';
import { getTab } from '../../db/tabs';
import type { DesignEnv, TabDTO } from '../../types';
import { readDesignTabs } from '../design-content';

const NOT_WORDS = /^(layouts \w+: |Rectangles and elements' x, y )/;

function pagesOf(tab: TabDTO, tabIds: readonly string[]): string {
  const rendered = renderView({ view: 'pages' }, tab, {
    rev: tab.rev,
    tabIds: [...tabIds],
    selected: null,
  });
  if (!rendered.ok) return '';
  // The words only: the view's header, its note on coordinates and the layouts each kind offers are for an agent
  // that edits the tab, and would spend the model's window on nothing the summary needs.
  return rendered.text
    .split('\n')
    .filter((line, i) => !(i === 0 && line.startsWith('tab ')) && !NOT_WORDS.test(line))
    .join('\n')
    .trim();
}

/** One tab's text, or the whole design's: each tab under its name, until the model's window is full. */
export async function designText(
  env: DesignEnv,
  designId: string,
  tabId?: string,
): Promise<string> {
  const tabs = await readDesignTabs(env, designId);
  const ids = tabs.map((t) => t.id);
  if (tabId !== undefined) {
    const tab = await getTab(env, designId, tabId);
    return tab ? pagesOf(tab, ids) : '';
  }
  const parts: string[] = [];
  let held = 0;
  for (const listed of tabs) {
    if (held >= AI_SUMMARISE_TEXT_MAX) break;
    const tab = await getTab(env, designId, listed.id);
    if (!tab) continue;
    const part = `# ${listed.name}\n${pagesOf(tab, ids)}`;
    parts.push(part);
    held += part.length + 2;
  }
  return parts.join('\n\n');
}
