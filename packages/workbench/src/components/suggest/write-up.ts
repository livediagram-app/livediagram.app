// Write It Up and Add to Knowledgebase's one click (liveworkspace/docs/specs/016-notifications/suggestions.md "What
// taking one does"; the index's write-up.md): where a write-up from the item goes, asked once per item a page load and
// only after the cheap part of a trigger found something, and the page written as the person, a toast saying where.
import { IndexError, writeUpBody } from '@liveworkspace/index-client';
import { indexClient } from '../../lib/index-client';

type Kb = { id: string; title: string };

const targets = new Map<string, Promise<Kb | null>>();

/** The knowledgebase a write-up from this item goes to, or null; one read per item a page load. */
export function writeUpTarget(itemId: string): Promise<Kb | null> {
  let found = targets.get(itemId);
  if (!found) {
    found = indexClient
      .writeUpTarget(itemId)
      .then((t) => t.knowledgebase)
      .catch(() => {
        // Not now: a later check asks again.
        targets.delete(itemId);
        return null;
      });
    targets.set(itemId, found);
  }
  return found;
}

/** The words a page ends with: where it came from. */
export const writeUpFrom = (title: string, app: string, link: string): string =>
  `\n\n---\n\nFrom ${title} (${app}): ${link}`;

export type WriteUpToast = {
  success: (
    message: string,
    options?: { action?: { label: string; onSelect: () => void } },
  ) => void;
  error: (message: string) => void;
};

/** Writes the page; a toast says where, with Open Page, or why not. */
export async function writeUpToKnowledgebase(
  toast: WriteUpToast,
  itemId: string,
  kb: Kb,
  page: { title: string; body: string },
): Promise<void> {
  try {
    const { page: made } = await indexClient.writeUp(itemId, {
      knowledgebase: kb.id,
      title: page.title.trim().slice(0, 200) || 'Untitled',
      body: writeUpBody(page.body),
    });
    toast.success(`Written up in ${kb.title || 'the knowledgebase'}`, {
      action: { label: 'Open Page', onSelect: () => window.open(made.link, '_blank', 'noopener') },
    });
  } catch (err) {
    const reason =
      err instanceof IndexError && typeof err.detail?.reason === 'string' && err.detail.reason
        ? err.detail.reason
        : 'Check you can edit that knowledgebase.';
    toast.error(`It couldn’t be written up. ${reason}`);
  }
}

/** Forgets the targets read, for tests. */
export function resetWriteUpTargetsForTests(): void {
  targets.clear();
}
