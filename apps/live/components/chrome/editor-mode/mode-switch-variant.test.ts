import { describe, expect, it } from 'vitest';
import { parseModeSwitchVariant } from './mode-switch-variant';

describe('parseModeSwitchVariant', () => {
  it.each(['a', 'b', 'c', 'd'] as const)('reads ?modeSwitch=%s', (variant) => {
    expect(parseModeSwitchVariant(`?modeSwitch=${variant}`)).toBe(variant);
  });

  it('reads the value case-insensitively among other params', () => {
    expect(parseModeSwitchVariant('?tab=1&modeSwitch=C')).toBe('c');
  });

  it.each(['', '?modeSwitch=', '?modeSwitch=e', '?other=b'])('falls back to a for %j', (search) => {
    expect(parseModeSwitchVariant(search)).toBe('a');
  });
});
