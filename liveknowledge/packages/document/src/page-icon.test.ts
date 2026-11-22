import { describe, expect, it } from 'vitest';
import {
  PAGE_ICON_EMOJI_MAX,
  isPageEmoji,
  isPageIconId,
  pageIconKey,
  pageIconOfKey,
  parseTabIcon,
  samePageIcon,
  withSettledIcon,
} from './page-icon';
import { migrateStoredTab } from './stored-tab';

describe('isPageEmoji', () => {
  it('takes one emoji: a pictograph, with its modifiers and joiners, a flag or a keycap', () => {
    for (const e of ['🚀', '❤️', '👍🏽', '👩‍💻', '👨‍👩‍👧‍👦', '🇬🇧', '#️⃣', '1️⃣', '🏳️‍🌈'])
      expect(isPageEmoji(e), e).toBe(true);
  });

  it('refuses words, two emoji, spaces, empty and over-long strings', () => {
    for (const e of [
      'a',
      'rocket',
      '🚀🚀',
      '🚀 ',
      ' 🚀',
      '',
      '1',
      '#',
      'x'.repeat(PAGE_ICON_EMOJI_MAX + 1),
    ])
      expect(isPageEmoji(e), JSON.stringify(e)).toBe(false);
    expect(isPageEmoji(42)).toBe(false);
    expect(isPageEmoji(undefined)).toBe(false);
  });
});

describe('isPageIconId', () => {
  it('takes a kebab-case id and nothing else', () => {
    expect(isPageIconId('rocket')).toBe(true);
    expect(isPageIconId('git-branch')).toBe(true);
    expect(isPageIconId('Rocket')).toBe(false);
    expect(isPageIconId('-x')).toBe(false);
    expect(isPageIconId('a'.repeat(65))).toBe(false);
    expect(isPageIconId(3)).toBe(false);
  });
});

describe('parseTabIcon', () => {
  it('reads an emoji or an icon, an emoji first', () => {
    expect(parseTabIcon({ emoji: '🚀' })).toEqual({ emoji: '🚀' });
    expect(parseTabIcon({ iconId: 'rocket' })).toEqual({ iconId: 'rocket' });
    expect(parseTabIcon({ emoji: '🚀', iconId: 'rocket' })).toEqual({ emoji: '🚀' });
    expect(parseTabIcon({ emoji: 'no', iconId: 'rocket' })).toEqual({ iconId: 'rocket' });
  });

  it('reads anything else as none', () => {
    for (const v of [undefined, null, 'rocket', '🚀', 3, {}, { emoji: 'hi' }, { iconId: 'Bad Id' }])
      expect(parseTabIcon(v)).toBeUndefined();
  });
});

describe('pageIconKey and pageIconOfKey', () => {
  it('make a plain key and read it back', () => {
    expect(pageIconKey({ emoji: '🚀' })).toBe('e:🚀');
    expect(pageIconKey({ iconId: 'rocket' })).toBe('i:rocket');
    expect(pageIconKey(undefined)).toBeNull();
    expect(pageIconOfKey('e:🚀')).toEqual({ emoji: '🚀' });
    expect(pageIconOfKey('i:rocket')).toEqual({ iconId: 'rocket' });
    expect(pageIconOfKey(null)).toBeUndefined();
    expect(pageIconOfKey('x:rocket')).toBeUndefined();
    expect(pageIconOfKey('e:words')).toBeUndefined();
  });

  it('compare two icons by value', () => {
    expect(samePageIcon({ emoji: '🚀' }, { emoji: '🚀' })).toBe(true);
    expect(samePageIcon({ emoji: '🚀' }, { iconId: 'rocket' })).toBe(false);
    expect(samePageIcon(undefined, undefined)).toBe(true);
  });
});

describe('withSettledIcon', () => {
  it('is the same tab when there is nothing to settle', () => {
    const none = { id: 't' };
    expect(withSettledIcon(none)).toBe(none);
    const good = { id: 't', icon: { emoji: '🚀' } };
    expect(withSettledIcon(good)).toBe(good);
  });

  it('keeps what of an icon is valid and drops one that is not', () => {
    expect(withSettledIcon({ id: 't', icon: { emoji: '🚀', extra: 1 } })).toEqual({
      id: 't',
      icon: { emoji: '🚀' },
    });
    expect(withSettledIcon({ id: 't', icon: { emoji: 'words' } })).toEqual({ id: 't' });
  });

  it('runs on every stored tab read', () => {
    const tab = migrateStoredTab({
      id: 't',
      name: 'Page',
      elements: [],
      icon: { emoji: 'not one' },
    } as unknown as Parameters<typeof migrateStoredTab>[0]);
    expect('icon' in tab).toBe(false);
  });
});
