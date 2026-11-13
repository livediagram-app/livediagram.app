import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { imageBackingInsetRules } from '@liveworkspace/element-model/image-backing';

// The stylesheet every editor imports (@liveworkspace/workbench/styles/image-backing.css) holds the rules
// @liveworkspace/element-model/image-backing generates, so the attribute, the steps and the variable cannot drift.
describe('image-backing.css', () => {
  it('holds the generated rules', () => {
    const css = readFileSync(new URL('./image-backing.css', import.meta.url), 'utf8');
    expect(css.slice(css.indexOf('*/') + 2).trim()).toBe(imageBackingInsetRules());
  });
});
