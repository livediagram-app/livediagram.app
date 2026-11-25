import { describe, expect, it } from 'vitest';
import { APP_ITEMS, type AppName } from '@liveworkspace/sites';
import { itemCommandNames } from './item-command-names';

describe('itemCommandNames', () => {
  it('names Share, Rename and Delete with the app’s own noun', () => {
    expect(itemCommandNames('livediagram')).toEqual({
      share: 'Share Canvas',
      rename: 'Rename Canvas',
      delete: 'Delete Canvas',
    });
    expect(itemCommandNames('liveplanner').delete).toBe('Delete Plan');
    expect(itemCommandNames('livehuddle').share).toBe('Share Space');
  });

  it('gives every app the same three verbs', () => {
    for (const app of Object.keys(APP_ITEMS) as AppName[]) {
      const noun = APP_ITEMS[app].noun;
      expect(Object.values(itemCommandNames(app))).toEqual([
        `Share ${noun}`,
        `Rename ${noun}`,
        `Delete ${noun}`,
      ]);
    }
  });
});
