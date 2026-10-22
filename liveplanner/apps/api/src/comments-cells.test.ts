import { describe, expect, it } from 'vitest';
import type { Comment, Element, ShapeElement } from '@liveplanner/project';
import {
  findCommentHost,
  hasNewComments,
  redactCommentAuthorIds,
  removeComment,
  rewriteCommentAuthors,
  threadsOfTab,
} from './comments';
import {
  claimedComments,
  newComments,
  newlyResolvedThreads,
  removedComments,
} from './timeline/tab-diff';
import type { ParticipantDTO } from './types';

// A Sheet's cell threads (docs/specs/029-sheets/sheet.md "Cell comments") behind the same trust boundary as an
// element's thread: authors locked on save, ids redacted, deletes found, and timeline events keyed per thread.

const B4 = 'row004:colb01';
const c = (id: string, extra: Partial<Comment> = {}): Comment => ({
  id,
  text: `t ${id}`,
  createdAt: 1,
  authorName: 'Priya',
  authorColor: '#000',
  ...extra,
});
const sheet = (comments: Comment[], resolved = false): ShapeElement => ({
  id: 'sh',
  type: 'shape',
  shape: 'plan-sheet',
  x: 0,
  y: 0,
  width: 960,
  height: 560,
  planSheet: { sheetId: 'sheet01' },
  cellComments: { [B4]: { comments, resolved } },
});
const cells = (el: Element) => (el as ShapeElement).cellComments![B4]!;

const writer: ParticipantDTO = {
  id: 'writer-id',
  name: 'Server Writer',
  color: '#0ea5e9',
  createdAt: 0,
};

describe('cell threads behind the comment trust boundary', () => {
  it("locks a stored cell comment's author and words, and stamps a new one with the writer", () => {
    const prev = [sheet([c('old', { authorId: 'priya', text: 'original' })])];
    const forged = sheet([
      c('old', { authorId: 'priya', authorName: 'Mallory', text: 'forged' }),
      c('new', { authorName: 'Fake', authorColor: '#fff' }),
    ]);
    const [out] = rewriteCommentAuthors([forged], prev, writer);
    expect(cells(out!).comments[0]).toMatchObject({ authorName: 'Priya', text: 'original' });
    expect(cells(out!).comments[1]).toMatchObject({
      authorName: 'Server Writer',
      authorId: 'writer-id',
    });
  });

  it('redacts author ids in cell threads for anyone but their author', () => {
    const [out] = redactCommentAuthorIds(
      [sheet([c('a', { authorId: 'priya', tokenId: 'tok' }), c('b', { authorId: 'me' })])],
      'me',
    );
    expect(cells(out!).comments.map((x) => x.authorId ?? null)).toEqual([null, 'me']);
    expect(cells(out!).comments[0]!.tokenId).toBeUndefined();
  });

  it('finds and removes a cell comment, the thread going with its last', () => {
    const els = [sheet([c('a')])];
    expect(findCommentHost(els, 'a')).toMatchObject({ elementId: 'sh', cell: B4 });
    expect(findCommentHost(els, 'none')).toBeNull();
    const [out] = removeComment(els, 'a');
    expect((out as ShapeElement).cellComments).toBeUndefined();
  });

  it('sees a new cell comment for the mention email', () => {
    expect(
      hasNewComments([sheet([c('a'), c('b', { authorId: 'me' })])], [sheet([c('a')])], 'me'),
    ).toBe(true);
    expect(hasNewComments([sheet([c('a')])], [sheet([c('a')])], 'me')).toBe(false);
  });

  it('lists a cell thread with the A1 the caller resolves', () => {
    const tab = { id: 't1', name: 'Main', elements: [sheet([c('a')])] };
    const [thread] = threadsOfTab(tab, 'open', null, (_el, cell) => (cell === B4 ? 'B4' : null));
    expect(thread).toMatchObject({ elementId: 'sh', cell: B4, cellRef: 'B4' });
    expect(threadsOfTab(tab, 'resolved', null)).toEqual([]);
  });
});

describe('timeline events for cell threads', () => {
  it('records new, claimed, removed and resolved cell comments, keyed per thread', () => {
    expect(
      newComments([sheet([c('a'), c('b')])], [sheet([c('a')])]).map((x) => [x.id, x.reply]),
    ).toEqual([['b', true]]);
    expect(
      claimedComments([sheet([c('a', { authorId: 'me' })])], [sheet([c('a')])]).map((x) => x.id),
    ).toEqual(['a']);
    expect(removedComments([sheet([c('b')])], [sheet([c('a'), c('b')])])).toEqual([
      { id: 'a', elementId: `sh#${B4}`, opening: true },
    ]);
    expect(newlyResolvedThreads([sheet([c('a')], true)], [sheet([c('a')])])).toEqual([
      { elementId: `sh#${B4}`, text: 't a' },
    ]);
  });
});
