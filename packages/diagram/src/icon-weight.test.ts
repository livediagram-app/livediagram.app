import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ICON_WEIGHT,
  ICON_REMOTE_HIGHLIGHT_PX,
  ICON_WEIGHTS,
  ICON_WEIGHT_PX,
  iconWeightPx,
} from './icon-weight';

describe('icon weight', () => {
  it('offers thin, regular and bold, regular by default', () => {
    expect(ICON_WEIGHTS).toEqual(['thin', 'regular', 'bold']);
    expect(DEFAULT_ICON_WEIGHT).toBe('regular');
  });

  it('maps each weight to an on-screen stroke, regular matching the chrome weight', () => {
    expect(ICON_WEIGHT_PX).toEqual({ thin: 1, regular: 1.5, bold: 2.25 });
    expect(ICON_REMOTE_HIGHLIGHT_PX).toBe(3);
  });

  it('reads an unset or unknown weight as regular', () => {
    expect(iconWeightPx(undefined)).toBe(1.5);
    expect(iconWeightPx('bold')).toBe(2.25);
    expect(iconWeightPx('heavy' as never)).toBe(1.5);
  });
});
