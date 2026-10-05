// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { PictureDisc } from './PictureDisc';

// A disc that may carry a profile picture (docs/specs/014-identity/profile-picture.md §7): the
// initial always holds the box, the picture overlays it once loaded, and a failure goes back to
// the initial.

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const PICTURE = 'https://img.clerk.com/picture';
const OTHER = 'https://img.clerk.com/other';

function renderDisc(pictureUrl: string | null, size = 20) {
  const view = render(
    <PictureDisc pictureUrl={pictureUrl} size={size} className="bg-brand-500" aria-hidden>
      W
    </PictureDisc>,
  );
  const box = () => view.container.firstElementChild as HTMLElement;
  const disc = () => box().querySelector('[data-optical="disc"]') as HTMLElement;
  const img = () => view.container.querySelector('img');
  return { ...view, box, disc, img };
}

describe('PictureDisc', () => {
  it('shows the initial alone when there is no picture', () => {
    const { box, img, getByText } = renderDisc(null);
    expect(box().dataset.avatarState).toBe('initial');
    expect(getByText('W')).toBeTruthy();
    expect(img()).toBeNull();
  });

  it('keeps the initial visible and the picture transparent while loading', () => {
    const { box, disc, img } = renderDisc(PICTURE);
    expect(box().dataset.avatarState).toBe('loading');
    expect(img()!.className).toContain('opacity-0');
    expect(disc().className).not.toContain('[&>span]:invisible');
  });

  it('shows the picture over a hidden initial once it loads', () => {
    const { box, disc, img } = renderDisc(PICTURE);
    fireEvent.load(img()!);
    expect(box().dataset.avatarState).toBe('picture');
    expect(img()!.className).toContain('opacity-100');
    expect(disc().className).toContain('[&>span]:invisible');
  });

  it('falls back to the initial when the picture fails to load', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { box, img } = renderDisc(PICTURE);
    fireEvent.error(img()!);
    expect(box().dataset.avatarState).toBe('initial');
    expect(img()).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('logs the host, not the URL, when the picture fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { img } = renderDisc(PICTURE);
    fireEvent.error(img()!);
    expect(warn).toHaveBeenCalledWith('[profile-picture] load failed', { host: 'img.clerk.com' });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('/picture');
  });

  it('starts again from loading when a new picture arrives after a failure', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { box, img, rerender } = renderDisc(PICTURE);
    fireEvent.error(img()!);
    rerender(
      <PictureDisc pictureUrl={OTHER} size={20} className="bg-brand-500">
        W
      </PictureDisc>,
    );
    expect(box().dataset.avatarState).toBe('loading');
    expect(img()!.getAttribute('src')).toBe(`${OTHER}?width=96&height=96`);
  });

  it('asks Clerk for a size, never a crop, with a 2x source sized to the disc', () => {
    const { img } = renderDisc(PICTURE, 44);
    expect(img()!.getAttribute('src')).toBe(`${PICTURE}?width=96&height=96`);
    expect(img()!.getAttribute('srcset')).toBe(
      `${PICTURE}?width=96&height=96 96w, ${PICTURE}?width=192&height=192 192w`,
    );
    expect(img()!.getAttribute('sizes')).toBe('44px');
    expect(img()!.getAttribute('src')).not.toContain('fit=');
  });

  it('renders the picture decoratively without a referrer', () => {
    const { img } = renderDisc(PICTURE);
    expect(img()!.getAttribute('alt')).toBe('');
    expect(img()!.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(img()!.getAttribute('decoding')).toBe('async');
    expect(img()!.getAttribute('loading')).toBeNull();
  });

  it('passes ARIA and style to the disc, so a named avatar stays named', () => {
    const view = render(
      <PictureDisc
        pictureUrl={PICTURE}
        size={28}
        role="img"
        aria-label="Ann (Online)"
        style={{ boxShadow: '0 0 0 2px white' }}
        className="bg-brand-500"
      >
        A
      </PictureDisc>,
    );
    const named = view.getByRole('img', { name: 'Ann (Online)' });
    expect(named.dataset.optical).toBe('disc');
    expect(named.style.boxShadow).toBe('0 0 0 2px white');
  });

  it('holds the same fixed box in every state', () => {
    const sizes = (el: HTMLElement) => [el.style.width, el.style.height];
    const { box, img } = renderDisc(PICTURE);
    expect(sizes(box())).toEqual(['20px', '20px']);
    expect([img()!.getAttribute('width'), img()!.getAttribute('height')]).toEqual(['20', '20']);
    fireEvent.load(img()!);
    expect(sizes(box())).toEqual(['20px', '20px']);
  });
});
