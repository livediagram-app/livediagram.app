// Add a Tab from a Template (docs/specs/013-workspace/automations.md "Steps of its own"; blueprint automations.md
// "The kit": addTab): the platform's step (@liveworkspace/automations/room addTemplateTab: the checks, the limit
// and the words) over this app's own. The tab is made as New Tab makes it from that template, through the path a
// seeded create takes (routes/document-seed.ts compileSeededTabs, the same engine a `replace` changeset compiles
// with) and the one tab write every save uses, last in order. Everyone with the document open sees it arrive, as an
// ordered op a blipped socket replays.
import { isValidTab, migrateIncomingTab, pageCount, type Tab } from '@liveknowledge/document';
import { countPages, knowledgePagesMax } from '../../knowledge/tier-limits';
import { KINDS } from '@liveknowledge/document/automations';
import { templateKindOf } from '@liveknowledge/templates';
import { nextOrderIndex } from '@liveworkspace/api-kit/tab-order';
import { addTemplateTab as addItemTab } from '@liveworkspace/automations/room';
import { upsertTab } from '../../db/tabs';
import { MAX_TAB_BYTES, tabDataBytes } from '../../limits';
import { capStoredName } from '../../names';
import { compileSeededTabs } from '../../routes/document-seed';
import type { DocumentEnv } from '../../types';
import { connectedTabArrival } from '../connected-tab';
import { readDocumentOutline } from '../document-content';
import type { DocumentRoom } from '../document-room';
import { sequenceMutation } from '../document-room-sockets';

export async function addTemplateTab(
  room: DocumentRoom,
  env: DocumentEnv,
  documentId: string,
  template: string,
  name: string,
): Promise<{ id: string; name: string } | { failed: string }> {
  const outline = await readDocumentOutline(env, documentId);
  // A full knowledgebase takes no new page from a rule either (tiers.md): its fixed bound, then its owner's
  // Knowledgebase Pages over all of theirs.
  const max = knowledgePagesMax();
  if (outline.meta && pageCount(outline.tabs) >= max)
    return {
      failed: `This knowledgebase holds ${max.toLocaleString('en-US')} pages, the most it can.`,
    };
  if (outline.meta) {
    const over = await countPages(room.tier, documentId, pageCount(outline.tabs) + 1);
    if (over === 'unavailable')
      return { failed: 'Couldn’t check the owner’s pages. Try again later.' };
    if (over)
      return {
        failed: `The owner’s Knowledgebases hold ${over.max.toLocaleString('en-US')} pages, the most they can.`,
      };
  }
  return addItemTab<Tab>(
    {
      itemWord: KINDS.itemWord,
      tabCount: async () => (outline.meta ? outline.tabs.length : null),
      // A retired template's kind makes its replacement, as everywhere a template is named.
      kindOf: templateKindOf,
      storedName: (given) => capStoredName(given, null, 'tab'),
      build: ({ id, name: stored, kind }) => {
        const seed = compileSeededTabs([{ id, name: stored, template: kind }], documentId);
        if ('refusal' in seed) return null;
        const tab = migrateIncomingTab(seed.tabs[0]) as Tab;
        return isValidTab(tab) ? tab : null;
      },
      tooLarge: (tab) => tabDataBytes(tab) > MAX_TAB_BYTES,
      write: async (tab, id, stored) => {
        await upsertTab(
          env,
          documentId,
          { ...tab, id, name: stored },
          nextOrderIndex(outline.tabs),
        );
        const arrival = await connectedTabArrival(env, documentId);
        if (arrival) sequenceMutation(room, 'system', arrival);
      },
    },
    template,
    name,
  );
}
