import { expect, it } from 'vitest';

import { logLine } from './log.ts';

it('prints a greppable [preview] line', () => {
  expect(logLine('tier', { pr: 7, tier: 'full', add_label: true })).toBe(
    '[preview] tier pr=7 tier=full add_label=true',
  );
});
