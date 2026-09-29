// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { AccountAvatar } from './AccountAvatar';

// The account avatar's states (docs/specs/014-identity/profile-picture.md §5): the initial always
// holds the box, the picture overlays it once loaded, and a failure goes back to the initial.

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const PICTURE = 'https://img.clerk.com/picture?width=96&height=96&fit=crop';
const OTHER = 'https://img.clerk.com/other?width=96&height=96&fit=crop';

function renderAvatar(pictureUrl: string | null) {
  const view = render(
    <AccountAvatar initial="W" pictureUrl={pictureUrl} size={20} className="bg-brand-500" />,
  );
  const box = () => view.container.firstElementChild as HTMLElement;
  const img = () => view.container.querySelector('img');
  return { ...view, box, img };
}

describe('AccountAvatar', () => {
  it('shows the initial alone when there is no picture', () => {
    const { box, img, getByText } = renderAvatar(null);
    expect(box().dataset.avatarState).toBe('initial');
    expect(getByText('W')).toBeTruthy();
    expect(img()).toBeNull();
  });

  it('keeps the initial visible and the picture transparent while loading', () => {
    const { box, img } = renderAvatar(PICTURE);
    expect(box().dataset.avatarState).toBe('loading');
    expect(img()!.className).toContain('opacity-0');
    expect(box().querySelector('[data-optical="disc"]')!.className).not.toContain(
      '[&>span]:invisible',
    );
  });

  it('shows the picture over a hidden initial once it loads', () => {
    const { box, img } = renderAvatar(PICTURE);
    fireEvent.load(img()!);
    expect(box().dataset.avatarState).toBe('picture');
    expect(img()!.className).toContain('opacity-100');
    expect(box().querySelector('[data-optical="disc"]')!.className).toContain('[&>span]:invisible');
  });

  it('falls back to the initial when the picture fails to load', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { box, img } = renderAvatar(PICTURE);
    fireEvent.error(img()!);
    expect(box().dataset.avatarState).toBe('initial');
    expect(img()).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('logs the host, not the URL, when the picture fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { img } = renderAvatar(PICTURE);
    fireEvent.error(img()!);
    expect(warn).toHaveBeenCalledWith('[profile-picture] load failed', { host: 'img.clerk.com' });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('picture?width');
  });

  it('starts again from loading when a new picture arrives after a failure', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { box, img, rerender } = renderAvatar(PICTURE);
    fireEvent.error(img()!);
    rerender(<AccountAvatar initial="W" pictureUrl={OTHER} size={20} className="bg-brand-500" />);
    expect(box().dataset.avatarState).toBe('loading');
    expect(img()!.getAttribute('src')).toBe(OTHER);
  });

  it('renders the picture decoratively without a referrer', () => {
    const { box, img } = renderAvatar(PICTURE);
    expect(box().getAttribute('aria-hidden')).toBe('true');
    expect(img()!.getAttribute('alt')).toBe('');
    expect(img()!.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(img()!.getAttribute('decoding')).toBe('async');
    expect(img()!.getAttribute('loading')).toBeNull();
  });

  it('holds the same fixed box in every state', () => {
    const sizes = (el: HTMLElement) => [el.style.width, el.style.height];
    const { box, img } = renderAvatar(PICTURE);
    expect(sizes(box())).toEqual(['20px', '20px']);
    expect([img()!.getAttribute('width'), img()!.getAttribute('height')]).toEqual(['20', '20']);
    fireEvent.load(img()!);
    expect(sizes(box())).toEqual(['20px', '20px']);
  });
});
