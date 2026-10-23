// @vitest-environment jsdom
// docs/specs/031-photo/photo-pages.md "Making a photo page": a photo just started has a tool in hand.
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LaidOutPage } from '@livedesign/design';
import { photoOf } from '@/lib/photo-editor/photo-test-utils';
import { photoTools } from '@/lib/photo-editor/tool-state';
import { photoView } from './photo-view-test-utils';
import { readyTool, StartPhotoCard } from './StartPhotoCard';

beforeEach(() => photoTools.take(null));
afterEach(cleanup);

describe('a photo just started', () => {
  it('picks up the Brush on a blank photo and Move on a picture, keeping a tool already in hand', () => {
    readyTool(true);
    expect(photoTools.get().tool).toBe('brush');
    photoTools.take(null);
    readyTool(false);
    expect(photoTools.get().tool).toBe('move');
    photoTools.take('lasso');
    readyTool(true);
    expect(photoTools.get().tool).toBe('lasso');
  });

  it('makes a blank photo transparent: one Background layer with no pixels', () => {
    const { view, s } = photoView(photoOf(16, 12, []), {});
    const page = { id: 'p', rect: { x: 0, y: 0, width: 16, height: 12 } } as unknown as LaidOutPage;
    render(createElement(StartPhotoCard, { page, photo: view, zoom: 1 }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(s.photo.layers.map((l) => l.name)).toEqual(['Background']);
    expect(s.raster(s.photo.layers[0]!.id).keys()).toEqual([]);
  });
});
