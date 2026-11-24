import { describe, expect, it } from 'vitest';
import { INSERT_BLOCKS, INSERT_OBJECTS } from './page-toolbar-panels';

// The Insert menu draws each blurb on one truncated line in a fixed-width menu: past about 30 characters it is cut
// off mid-word ("A numbered note at the foot of th…").
describe('the article Insert menu', () => {
  it('keeps every blurb short enough to show whole', () => {
    for (const item of [...INSERT_OBJECTS, ...INSERT_BLOCKS]) {
      expect(item.blurb.length, item.label).toBeLessThanOrEqual(30);
    }
  });
});
