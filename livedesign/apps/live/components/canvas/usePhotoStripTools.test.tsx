// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { photoTools } from '@/lib/photo-editor/tool-state';
import { usePhotoStripTools } from './usePhotoStripTools';

// docs/specs/031-photo/photo-pages.md "The photo tools", docs/specs/007-editor/toolbar-layout.md.
const view = (canEdit: boolean, canInspect: boolean, session = true) =>
  ({ session: session ? {} : null, canEdit, canInspect }) as unknown as PhotoEditorView;

const run = (
  photo: PhotoEditorView | undefined,
  { isMobile = false, chromeHidden = false } = {},
) => {
  const onSetCanvasTool = vi.fn();
  const { result } = renderHook(() =>
    usePhotoStripTools({ photo, isMobile, chromeHidden, onSetCanvasTool }),
  );
  return { ...result.current, onSet: onSetCanvasTool };
};

afterEach(() => photoTools.take(null));

describe('a photo page’s tools in the palette strip', () => {
  it('take the categories’ place for an Editor, and follow a Participant’s strip', () => {
    expect(run(view(true, true)).stripTools?.inPlaceOfCategories).toBe(true);
    expect(run(view(false, true)).stripTools?.inPlaceOfCategories).toBe(false);
  });

  it('are not there for a Viewer, with no photo in focus, on a phone, or while the chrome is away', () => {
    expect(run(view(false, false)).stripTools).toBeNull();
    expect(run(view(true, true, false)).stripTools).toBeNull();
    expect(run(undefined).stripTools).toBeNull();
    expect(run(view(true, true), { isMobile: true }).stripTools).toBeNull();
    expect(run(view(true, true), { chromeHidden: true }).stripTools).toBeNull();
  });

  it('put the photo tool down when a selection mode is picked', () => {
    photoTools.take('brush');
    const { onSetCanvasTool, onSet } = run(view(true, true));
    onSetCanvasTool('select');
    expect(photoTools.get().tool).toBeNull();
    expect(onSet).toHaveBeenCalledWith('select');
  });
});
