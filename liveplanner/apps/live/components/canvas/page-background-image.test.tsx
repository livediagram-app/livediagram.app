// @vitest-environment jsdom

// The Background section's Image category (docs/specs/007-editor/pages-mode.md "Image
// backgrounds"): offered but on a logo page, a pick one edit with a readable overlay, and the
// overlay, strength and position.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Page, PageFill, PageImageFill } from '@liveplanner/document';
import type { PickedImage } from '@/lib/upload-image';

const gallery = vi.hoisted(() => ({
  props: null as null | { onPicked: (image: PickedImage) => void },
}));
vi.mock('./PageGalleryPicker', () => ({
  PageGalleryPicker: (props: typeof gallery.props) => {
    gallery.props = props;
    return <div data-testid="gallery-picker" />;
  },
}));
vi.mock('@/lib/page-image-tone', () => ({ sampleImageTone: vi.fn(async () => '#203040') }));
// A gallery pick reads its tone off the stored picture.
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiFetchImageBlobUrl: vi.fn(async () => 'blob:http://localhost/img-9'),
  releaseImageBlobUrl: vi.fn(),
}));
vi.mock('@/hooks/persistence/useImageBlobUrl', () => ({
  useImageBlobUrl: () => ({ status: 'loading' }),
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import { BackgroundSection } from './page-background-section';
import { PageImageAccessProvider } from './page-image-access';
import { CanvasSurfaceProvider } from './CanvasSurfaceContext';

afterEach(() => {
  cleanup();
  gallery.props = null;
  track.mockClear();
});

const ACCESS = { ownerId: 'o', documentId: 'd', shareCode: null };
const picture: PageImageFill = {
  kind: 'image',
  imageId: 'img-1',
  tone: '#203040',
  overlay: { kind: 'light', strength: 0.6 },
};
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

  it('opens on a page with a picture, the pickers waiting behind Replace Image', () => {
    show({ fill: picture });
    expect(radio('Image').getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByTestId('gallery-picker')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Replace Image' }));
    expect(screen.getByTestId('gallery-picker')).toBeTruthy();
  });

  it('lands a pick as one edit with its tone and a readable wash for the canvas', async () => {
    const { onBackground } = show({}, 'dark');
    fireEvent.click(radio('Image'));
    await act(async () => gallery.props!.onPicked({ id: 'img-9', width: 800, height: 1200 }));
    expect(onBackground).toHaveBeenCalledTimes(1);
    expect(onBackground).toHaveBeenCalledWith({
      fill: {
        kind: 'image',
        imageId: 'img-9',
        tone: '#203040',
        overlay: { kind: 'dark', strength: 0.6 },
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

  it('puts the paper back on Remove', () => {
    const { onBackground } = show({ fill: picture });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onBackground).toHaveBeenCalledWith({ fill: undefined });
  });
});
