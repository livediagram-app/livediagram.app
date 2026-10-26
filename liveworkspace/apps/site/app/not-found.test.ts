import { describe, expect, it } from 'vitest';
import { metadata as root } from './layout';
import { metadata } from './not-found';

// An unknown address must never pass itself off as the home page (liveworkspace/docs/specs/010-site/site.md).
describe('the not-found page', () => {
  it('has its own title and description, not the home page’s', () => {
    expect(metadata.title).toBe('Nothing here · liveworkspace');
    expect(metadata.title).not.toBe(root.title);
    expect(metadata.description).not.toBe(root.description);
  });

  it('claims no canonical or Open Graph address, and is not indexed', () => {
    expect(metadata.alternates?.canonical).toBeUndefined();
    expect(metadata.openGraph).toBeDefined();
    expect((metadata.openGraph as { url?: unknown }).url).toBeUndefined();
    expect(metadata.openGraph?.title).toBe(metadata.title);
    expect(metadata.robots).toMatchObject({ index: false });
  });
});
