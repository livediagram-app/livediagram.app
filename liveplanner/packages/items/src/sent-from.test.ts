import { describe, expect, it } from 'vitest';
import { readSentFrom, sentFromValue } from './sent-from';

const FROM = {
  app: 'livediagram',
  itemId: 'D',
  title: 'Retro',
  kind: 'element',
  label: 'Board',
  text: 'Fix the login',
  link: 'https://www.livediagram.app/d/D#el=e',
};

describe('sent-from', () => {
  it('keeps a whole Sent From as its JSON, and reads it back', () => {
    const value = sentFromValue({ ...FROM, extra: 1 });
    expect(value).toBe(JSON.stringify(FROM));
    expect(readSentFrom(value)).toEqual(FROM);
  });

  it('refuses anything that is not one', () => {
    for (const bad of [
      null,
      [],
      'x',
      { ...FROM, app: 'elsewhere' },
      { ...FROM, kind: 'nope' },
      { ...FROM, itemId: '' },
      { ...FROM, title: 3 },
      { ...FROM, label: null },
      { ...FROM, text: 'x'.repeat(2001) },
      { ...FROM, link: 'javascript:alert(1)' },
    ])
      expect(sentFromValue(bad)).toBeNull();
    expect(readSentFrom(42)).toBeNull();
    expect(readSentFrom('{not json')).toBeNull();
    expect(readSentFrom('x'.repeat(7000))).toBeNull();
  });
});
