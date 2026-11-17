// The Forum's contract (liveworkspace/docs/specs/007-community/community.md "The Forum"): its categories, reactions,
// validation, the list's query and its paths.
import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  FORUM_BODY_MAX,
  FORUM_CATEGORIES,
  FORUM_EXCERPT_MAX,
  FORUM_MAX_OFFSET,
  FORUM_TITLE_MAX,
  forumCategoryLabel,
  FORUM_ANY_APP_LABEL,
  FORUM_START_CATEGORY,
  forumAppLabel,
  isForumApp,
  forumExcerpt,
  forumFallbackColor,
  forumQueryParams,
  forumTopicPath,
  isForumCategory,
  isForumReaction,
  noForumReactions,
  normaliseForumText,
  parseForumListQuery,
  validateForumAuthor,
  validateForumEdit,
  validateForumReply,
  validateForumTopic,
} from './forum';

describe('categories and reactions', () => {
  it('are kinds of post, starting at Question, with the app a field of its own', () => {
    expect(FORUM_CATEGORIES.map((c) => c.id)).toEqual([
      'question',
      'tips',
      'feature',
      'bug',
      'showcase',
      'general',
    ]);
    expect(FORUM_START_CATEGORY).toBe('question');
    expect(forumCategoryLabel('tips')).toBe('Tips & Tricks');
    expect(forumCategoryLabel('showcase')).toBe('Show & Tell');
    expect(isForumApp(null)).toBe(true);
    expect(isForumApp('livedesign.app')).toBe(true);
    expect(isForumApp('livedesign')).toBe(false);
    expect(isForumApp(undefined)).toBe(false);
    expect(forumAppLabel('liveplanner.app')).toBe('liveplanner');
    expect(forumAppLabel(null)).toBe(FORUM_ANY_APP_LABEL);
    expect(isForumCategory('showcase')).toBe(true);
    expect(isForumCategory('livehuddle')).toBe(false);
    expect(isForumCategory(3)).toBe(false);
  });

  it('react three ways, starting at zero', () => {
    expect(noForumReactions()).toEqual({ helpful: 0, thanks: 0, celebrate: 0 });
    expect(isForumReaction('thanks')).toBe(true);
    expect(isForumReaction('love')).toBe(false);
    expect(isForumReaction(null)).toBe(false);
  });
});

describe('validation', () => {
  it('tidies a topic and names its first failing field', () => {
    expect(
      validateForumTopic({
        category: 'general',
        title: '  Hello   there  ',
        body: ' a\r\n\r\n\r\nb is long ',
      }),
    ).toEqual({
      ok: true,
      value: { category: 'general', app: null, title: 'Hello there', body: 'a\n\nb is long' },
    });
    expect(
      validateForumTopic({
        category: 'tips',
        app: 'livediagram.app',
        title: 'Hello',
        body: 'long enough',
      }),
    ).toMatchObject({ ok: true, value: { app: 'livediagram.app' } });
    expect(
      validateForumTopic({
        category: 'tips',
        app: 'example.com',
        title: 'Hello',
        body: 'long enough',
      }),
    ).toEqual({ ok: false, error: 'invalid_app' });
    expect(validateForumTopic(null)).toEqual({ ok: false, error: 'invalid_category' });
    expect(validateForumTopic({ category: 'general', title: 7 })).toEqual({
      ok: false,
      error: 'invalid_title',
    });
    expect(
      validateForumTopic({
        category: 'general',
        title: 'x'.repeat(FORUM_TITLE_MAX + 1),
        body: 'x'.repeat(20),
      }),
    ).toEqual({ ok: false, error: 'invalid_title' });
    expect(validateForumTopic({ category: 'general', title: 'Hello', body: 'short' })).toEqual({
      ok: false,
      error: 'invalid_body',
    });
  });

  it('checks a reply and an edit', () => {
    expect(validateForumReply({ body: ' ok ' })).toEqual({ ok: true, value: { body: 'ok' } });
    expect(validateForumReply({ body: 'x' })).toEqual({ ok: false, error: 'invalid_body' });
    expect(validateForumReply(undefined)).toEqual({ ok: false, error: 'invalid_body' });
    expect(validateForumReply({ body: 'x'.repeat(FORUM_BODY_MAX + 1) })).toEqual({
      ok: false,
      error: 'invalid_body',
    });
    expect(validateForumEdit({ title: 'ignored', body: 'Reply words' }, false)).toEqual({
      ok: true,
      value: { body: 'Reply words' },
    });
    expect(validateForumEdit({ title: 'A title', body: 'A long enough body' }, true)).toEqual({
      ok: true,
      value: { title: 'A title', body: 'A long enough body' },
    });
    expect(validateForumEdit(null, true)).toEqual({ ok: false, error: 'invalid_title' });
    expect(validateForumEdit({ title: 'A title', body: 'short' }, true)).toEqual({
      ok: false,
      error: 'invalid_body',
    });
  });

  it('shows an author by a bounded name and a colour, one from the account when none', () => {
    expect(validateForumAuthor({ name: ' Ada  L ', color: '#ABCDEF' }, 'user_1')).toEqual({
      ok: true,
      value: { name: 'Ada L', color: '#abcdef' },
    });
    const fallback = validateForumAuthor({ name: 'Ada' }, 'user_1');
    expect(fallback).toEqual({
      ok: true,
      value: { name: 'Ada', color: forumFallbackColor('user_1') },
    });
    expect(forumFallbackColor('user_1')).toBe(forumFallbackColor('user_1'));
    expect(validateForumAuthor({ name: 'x'.repeat(61) }, 'u')).toEqual({
      ok: false,
      error: 'invalid_author',
    });
    expect(validateForumAuthor(undefined, 'u')).toEqual({ ok: false, error: 'invalid_author' });
  });

  it('normalises text in one pass, however long', () => {
    expect(normaliseForumText(42)).toBe('');
    const worst = `a${'\r\n'.repeat(50_000)}b${' '.repeat(50_000)}`;
    expect(cpuMsOf(() => normaliseForumText(worst))).toBeLessThan(200);
    expect(normaliseForumText(worst)).toBe('a\n\nb');
  });
});

describe('the list', () => {
  it('cuts an excerpt at a word, on one line', () => {
    expect(forumExcerpt('One\n\ntwo')).toBe('One two');
    const long = `${'word '.repeat(60)}end`;
    const cut = forumExcerpt(long);
    expect(cut.length).toBeLessThanOrEqual(FORUM_EXCERPT_MAX + 1);
    expect(cut.endsWith('word…')).toBe(true);
    expect(forumExcerpt('x'.repeat(400))).toBe(`${'x'.repeat(FORUM_EXCERPT_MAX)}…`);
  });

  it('reads its query leniently and writes it back', () => {
    expect(parseForumListQuery(new URLSearchParams())).toEqual({
      category: null,
      app: null,
      sort: 'active',
      offset: 0,
    });
    const query = parseForumListQuery(
      new URLSearchParams('category=bug&app=livedesign&sort=unanswered&offset=40'),
    );
    expect(query).toEqual({
      category: 'bug',
      app: 'livedesign.app',
      sort: 'unanswered',
      offset: 40,
    });
    expect(forumQueryParams(query).toString()).toBe(
      'category=bug&app=livedesign&sort=unanswered&offset=40',
    );
    expect(parseForumListQuery(new URLSearchParams('app=livedesign.app')).app).toBe(
      'livedesign.app',
    );
    expect(parseForumListQuery(new URLSearchParams('app=example.com')).app).toBeNull();
    expect(parseForumListQuery(new URLSearchParams('category=livedesign')).category).toBeNull();
    expect(parseForumListQuery(new URLSearchParams('sort=popular')).sort).toBe('popular');
    expect(forumQueryParams({ sort: 'active' }).toString()).toBe('');
    expect(parseForumListQuery(new URLSearchParams('offset=-5')).offset).toBe(0);
    expect(parseForumListQuery(new URLSearchParams('offset=99999')).offset).toBe(FORUM_MAX_OFFSET);
    expect(parseForumListQuery(new URLSearchParams('offset=abc')).offset).toBe(0);
  });

  it('names a topic’s page', () => {
    expect(forumTopicPath('a b')).toBe('/community/forum/topic?id=a%20b');
  });
});
