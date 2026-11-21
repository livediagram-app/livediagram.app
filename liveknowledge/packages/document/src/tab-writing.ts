// Whether a tab holds writing (docs/specs/006-document/document-snapshots.md): a knowledgebase page is an article
// with no elements, so a reader that counts elements alone reads every page as empty.

const hasWords = (block: unknown): boolean => {
  const runs = (block as { runs?: unknown } | null)?.runs;
  return (
    Array.isArray(runs) &&
    runs.some((r) => {
      const text = (r as { text?: unknown } | null)?.text;
      return typeof text === 'string' && text.trim() !== '';
    })
  );
};

/** Whether the tab holds writing: an article flow with a block that has words. Reads the stored shape defensively. */
export function hasWriting(tab: { articles?: unknown }): boolean {
  const flows = tab.articles;
  if (!flows || typeof flows !== 'object') return false;
  return Object.values(flows as Record<string, unknown>).some((flow) => {
    const blocks = (flow as { blocks?: unknown } | null)?.blocks;
    return Array.isArray(blocks) && blocks.some(hasWords);
  });
}
