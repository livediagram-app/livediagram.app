import { describe, expect, it } from 'vitest';
import type { ArticleBlock, Tab } from '@livedocuments/document';
import { articleTitleName } from './article-document-name';

const tab = { id: 't', articles: { a: { blocks: [] } } } as unknown as Tab;
const title = (text: string): ArticleBlock => ({
  id: 'b1',
  type: 'paragraph',
  style: 'title',
  runs: [{ text }],
});
const body: ArticleBlock = { id: 'b2', type: 'paragraph', runs: [{ text: 'Hello' }] };

describe('articleTitleName', () => {
  it('names a default-named document after the Title', () => {
    expect(articleTitleName('Untitled Article', tab, 'a', [title('Q3 Report'), body])).toBe(
      'Q3 Report',
    );
    expect(articleTitleName('Untitled document', tab, 'a', [title('  Q3\n Report ')])).toBe(
      'Q3 Report',
    );
  });

  it('leaves a name someone gave, and an empty or missing Title, alone', () => {
    expect(articleTitleName('Roadmap', tab, 'a', [title('Q3')])).toBeNull();
    expect(articleTitleName('Untitled Article', tab, 'a', [title('  ')])).toBeNull();
    expect(articleTitleName('Untitled Article', tab, 'a', [body])).toBeNull();
  });

  it('ignores an article that is not on the first tab', () => {
    expect(articleTitleName('Untitled Article', tab, 'z', [title('Q3')])).toBeNull();
    expect(articleTitleName('Untitled Article', undefined, 'a', [title('Q3')])).toBeNull();
  });
});
