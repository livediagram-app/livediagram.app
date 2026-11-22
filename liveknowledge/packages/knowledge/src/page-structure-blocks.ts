// A drafted page structure as the page's writing (docs/specs/030-knowledgebase/describe-to-set-up.md "Describe
// Structure on a page", "What it writes"): each heading a Heading 2 or 3, each line under one italic body text, a
// callout a quote, a list its list items, a table its header row of column names and one empty row. Only ever text:
// no link, no mark but the italic. Pure.
import { tableFromGrid, type ArticleBlock, type ArticleRun } from '@liveknowledge/document';
import type { PageStructureBlock } from './page-structure';

const LIST = { bullets: 'bullet', numbered: 'numbered', checklist: 'todo' } as const;

/** The blocks a structure becomes, each with a fresh id from `newId`. */
export function pageStructureArticleBlocks(
  structure: readonly PageStructureBlock[],
  newId: () => string,
): ArticleBlock[] {
  return structure.flatMap((block): ArticleBlock[] => {
    switch (block.kind) {
      case 'heading':
        return [
          {
            id: newId(),
            type: 'paragraph',
            style: block.level === 3 ? 'h3' : 'h2',
            runs: [{ text: block.text }],
          },
        ];
      case 'text':
        return [{ id: newId(), type: 'paragraph', runs: [{ text: block.text, i: true }] }];
      case 'callout':
        return [{ id: newId(), type: 'paragraph', style: 'quote', runs: [{ text: block.text }] }];
      case 'table': {
        const header = block.columns.map((text): ArticleRun[] => [{ text }]);
        const empty = block.columns.map((): ArticleRun[] => []);
        // A grid of two rows and two to five columns always makes a table.
        return [tableFromGrid(newId(), [header, empty], true)!];
      }
      default:
        return block.items.map((text): ArticleBlock => ({
          id: newId(),
          type: 'list',
          list: LIST[block.kind],
          runs: [{ text }],
        }));
    }
  });
}
