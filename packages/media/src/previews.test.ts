import { previewsTargetFor, PREVIEWS_PATH } from '@liveworkspace/sites/workspace-proxy';
import { describe, expect, it } from 'vitest';
import {
  PREVIEWS_API_PATH,
  isPreviewAppearance,
  previewItemPath,
  previewSharePath,
  SHARE_PREVIEW_DOORS,
} from './previews';

describe('the previews addresses', () => {
  it('are the ones every router forwards (@liveworkspace/sites/workspace-proxy)', () => {
    expect(PREVIEWS_PATH).toBe(PREVIEWS_API_PATH);
    for (const door of SHARE_PREVIEW_DOORS) {
      expect(previewsTargetFor(`/api/share/CODE/${door}`)).toBe(previewSharePath('CODE', door));
    }
    expect(previewsTargetFor(previewItemPath('I1'))).toBe(previewItemPath('I1'));
  });

  it('key an item preview by its version', () => {
    expect(previewItemPath('a b', 12)).toBe('/api/previews/items/a%20b?v=12');
  });

  it('ask for the reader’s appearance when given one', () => {
    expect(previewItemPath('i', 12, 'dark')).toBe('/api/previews/items/i?v=12&appearance=dark');
    expect(previewsTargetFor(previewItemPath('i', 12, 'light'))).toBe(
      previewItemPath('i', 12, 'light'),
    );
  });

  it('name light and dark as appearances, and nothing else', () => {
    expect(isPreviewAppearance('light')).toBe(true);
    expect(isPreviewAppearance('dark')).toBe(true);
    for (const other of ['system', '', null, 1]) expect(isPreviewAppearance(other)).toBe(false);
  });
});
