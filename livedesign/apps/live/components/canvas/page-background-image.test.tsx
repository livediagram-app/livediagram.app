// @vitest-environment jsdom

// The Background section's Image category (docs/specs/007-editor/pages-mode.md "Image
// backgrounds"): offered but on a logo page, the search asking for the page's shape, a hovered
// result previewed, a pick one edit with a readable overlay, and the overlay, strength and position.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Page, PageFill, PageImageFill } from '@livedesign/document';
import type { OpenverseImage } from '@/lib/image-search/openverse';
import type { PickedImage } from '@/lib/upload-image';

const pane = vi.hoisted(() => ({
  props: null as null | {
    filters?: unknown;
    columns?: number;
    onPreview?: (r: OpenverseImage | null) => void;
    onPicked: (image: PickedImage, result: OpenverseImage) => void;
  },
}));
vi.mock('@/components/panels/ImageSearchPane', () => ({
  ImageSearchPane: (props: typeof pane.props) => {
    pane.props = props;
    return <div data-testid="search-pane" />;
  },
}));
vi.mock('@/lib/page-image-tone', () => ({ sampleImageTone: vi.fn(async () => '#203040') }));
vi.mock('@/hooks/persistence/useImageBlobUrl', () => ({
  useImageBlobUrl: () => ({ status: 'loading' }),
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import { BackgroundSection } from './page-background-section';
import { PageImageAccessProvider } from './page-image-access';
import { CanvasSurfaceProvider } from './CanvasSurfaceContext';
import { pageImageFilters } from './page-background-image';

afterEach(() => {
  cleanup();
  pane.props = null;
  track.mockClear();
});

const ACCESS = { ownerId: 'o', documentId: 'd', shareCode: null };
const picture: PageImageFill = {
  kind: 'image',
  imageId: 'img-1',
  tone: '#203040',
  overlay: { kind: 'light', strength: 0.6 },
};
const result = {
  id: 'r',
  url: 'https://x.org/r.jpg',
  thumbnail: 'https://api.openverse.org/r/thumb/',
  width: 800,
  height: 1200,
} as OpenverseImage;

function show(page: Partial<Page> & { fill?: PageFill }, surface: 'light' | 'dark' = 'light') {
  const { fill, ...rest } = page;
  const onBackground = vi.fn();
  const onPreview = vi.fn();
  render(
    <CanvasSurfaceProvider surface={surface}>
      <PageImageAccessProvider access={ACCESS}>
        <BackgroundSection
          page={{
            id: 'p',
            orientation: 'portrait',
            ...rest,
            ...(fill ? { background: { fill } } : {}),
          }}
          themePresets={[
            {
              id: 'theme-bright',
              label: 'Theme bright',
              fill: { kind: 'gradient', from: '#7c3aed', to: '#2563eb', angle: 160 },
            },
          ]}
          onBackground={onBackground}
          onPreview={onPreview}
        />
      </PageImageAccessProvider>
    </CanvasSurfaceProvider>,
  );
  return { onBackground, onPreview };
}
const radio = (name: string) => screen.getByRole('radio', { name });

describe('the Image category', () => {
  it('is offered on an infographic page, never on a logo page', () => {
    show({});
    expect(radio('Image')).toBeTruthy();
    cleanup();
    show({ kind: 'logo', size: 'logo' });
    expect(screen.queryByRole('radio', { name: 'Image' })).toBeNull();
  });

  it('opens on a page with a picture, and asks the search for the page’s shape (never large: its thumbnails fail)', () => {
    show({ fill: picture });
    expect(radio('Image').getAttribute('aria-checked')).toBe('true');
    // The search waits behind Replace Image while the page has a picture.
    expect(screen.queryByTestId('search-pane')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Replace Image' }));
    expect(pane.props!.filters).toEqual({ aspectRatio: 'tall' });
    expect(pane.props!.columns).toBe(3);
    expect(pageImageFilters({ id: 'p', orientation: 'landscape' })).toEqual({
      aspectRatio: 'wide',
    });
    expect(
      pageImageFilters({ id: 'p', orientation: 'portrait', size: 'logo', kind: 'logo' })
        .aspectRatio,
    ).toBe('square');
  });

  it('previews a hovered result under the overlay a pick would get', () => {
    const { onPreview } = show({});
    fireEvent.click(radio('Image'));
    act(() => pane.props!.onPreview!(result));
    expect(onPreview).toHaveBeenLastCalledWith({
      fill: {
        kind: 'image',
        imageId: 'preview',
        preview: result.thumbnail,
        overlay: { kind: 'light', strength: 0.6 },
      },
    });
    act(() => pane.props!.onPreview!(null));
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  it('lands a pick as one edit with its tone, credit and a readable wash for the canvas', async () => {
    const { onBackground } = show({}, 'dark');
    fireEvent.click(radio('Image'));
    const credit = { text: '"Sea" by Ada, CC BY 4.0', sourceUrl: 'https://x.org/sea' };
    await act(async () =>
      pane.props!.onPicked({ id: 'img-9', width: 800, height: 1200, credit }, result),
    );
    expect(onBackground).toHaveBeenCalledTimes(1);
    expect(onBackground).toHaveBeenCalledWith({
      fill: {
        kind: 'image',
        imageId: 'img-9',
        tone: '#203040',
        overlay: { kind: 'dark', strength: 0.6 },
        credit,
      },
    });
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'PageBackgroundImage');
  });

  it('changes the overlay, its tint from the theme accent, and the position, one edit each', () => {
    const { onBackground, onPreview } = show({ fill: picture });
    fireEvent.pointerEnter(radio('Dark'));
    expect(onPreview).toHaveBeenLastCalledWith({
      fill: { ...picture, overlay: { kind: 'dark', strength: 0.6 } },
    });
    fireEvent.click(radio('Tint'));
    expect(onBackground).toHaveBeenLastCalledWith({
      fill: { ...picture, overlay: { kind: 'tint', strength: 0.6, color: '#7c3aed' } },
    });
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Overlay' })).getByRole('radio', {
        name: 'None',
      }),
    );
    const { overlay: _o, ...bare } = picture;
    void _o;
    expect(onBackground).toHaveBeenLastCalledWith({ fill: bare });
    fireEvent.click(radio('Top'));
    expect(onBackground).toHaveBeenLastCalledWith({ fill: { ...picture, position: 'top' } });
  });

  it('previews the strength while dragged and commits it on release', () => {
    const { onBackground, onPreview } = show({ fill: picture });
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '30' } });
    expect(onPreview).toHaveBeenLastCalledWith({
      fill: { ...picture, overlay: { kind: 'light', strength: 0.3 } },
    });
    expect(onBackground).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider);
    fireEvent.keyUp(slider);
    expect(onBackground).toHaveBeenCalledWith({
      fill: { ...picture, overlay: { kind: 'light', strength: 0.3 } },
    });
  });

  it('shows a search pick’s credit, and Remove puts the paper back', () => {
    const credit = { text: '"Sea" by Ada', sourceUrl: 'https://x.org/sea' };
    const { onBackground } = show({ fill: { ...picture, credit } });
    expect(screen.getByText('"Sea" by Ada')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onBackground).toHaveBeenCalledWith({ fill: undefined });
  });
});
