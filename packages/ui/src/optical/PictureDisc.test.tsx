// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PictureDisc, resetPictureFailures } from './index';

// The shared avatar (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"): the picture over the initials, sized, lazy,
// sent with no referrer, never moving anything, and the initials again when there is no picture or it fails.

const PICTURE = 'https://lh3.googleusercontent.com/a/ACg8ocAda=s1000-c';

afterEach(() => {
  resetPictureFailures();
  vi.unstubAllGlobals();
});

describe('PictureDisc', () => {
  it('lays the picture over the initials at the disc’s own size, once it has loaded', () => {
    const { container } = render(
      <PictureDisc pictureUrl={PICTURE} name="Ada Lovelace" size={28} className="bg-sky-700">
        AL
      </PictureDisc>,
    );
    const disc = container.firstElementChild as HTMLElement;
    expect(disc.style.width).toBe('28px');
    expect(disc.style.height).toBe('28px');
    expect(disc.className).toContain('bg-sky-700');
    expect(disc.textContent).toBe('AL');
    const img = disc.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://lh3.googleusercontent.com/a/ACg8ocAda=s28-c');
    expect(img.getAttribute('srcset')).toBe(
      'https://lh3.googleusercontent.com/a/ACg8ocAda=s28-c 1x, https://lh3.googleusercontent.com/a/ACg8ocAda=s56-c 2x',
    );
    expect(img.getAttribute('width')).toBe('28');
    expect(img.getAttribute('height')).toBe('28');
    expect(img.getAttribute('alt')).toBe('Ada Lovelace');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    // Hidden until it loads, so the initials hold the place.
    expect(disc.dataset.picture).toBe('loading');
    expect(img.className).toContain('opacity-0');
    fireEvent.load(img);
    expect(disc.dataset.picture).toBe('loaded');
    expect(img.className).not.toContain('opacity-0');
  });

  it('falls back to the initials when the picture fails, for every avatar of that picture', () => {
    const { container } = render(
      <>
        <PictureDisc pictureUrl={PICTURE} name="Ada" size={24}>
          A
        </PictureDisc>
        <PictureDisc pictureUrl={PICTURE} name="Ada" size={40}>
          A
        </PictureDisc>
      </>,
    );
    expect(container.querySelectorAll('img')).toHaveLength(2);
    act(() => {
      fireEvent.error(container.querySelector('img')!);
    });
    expect(container.querySelectorAll('img')).toHaveLength(0);
    const discs = [...container.children] as HTMLElement[];
    expect(discs.map((d) => d.textContent)).toEqual(['A', 'A']);
    expect(discs.map((d) => d.style.width)).toEqual(['24px', '40px']);
    expect(discs.every((d) => d.dataset.picture === undefined)).toBe(true);
  });

  it('draws the initials alone with no picture, or one that is not a Google picture', () => {
    for (const pictureUrl of [null, undefined, 'https://evil.example/ada.png', 'javascript:x']) {
      const { container, unmount } = render(
        <PictureDisc pictureUrl={pictureUrl} name="Ada" size={20}>
          A
        </PictureDisc>,
      );
      expect(container.querySelector('img')).toBeNull();
      expect(container.textContent).toBe('A');
      unmount();
    }
  });

  it('starts again from the initials when the picture changes', () => {
    const { container, rerender } = render(
      <PictureDisc pictureUrl={PICTURE} name="Ada" size={20}>
        A
      </PictureDisc>,
    );
    fireEvent.load(container.querySelector('img')!);
    rerender(
      <PictureDisc pictureUrl="https://lh3.googleusercontent.com/a/other" name="Ada" size={20}>
        A
      </PictureDisc>,
    );
    expect((container.firstElementChild as HTMLElement).dataset.picture).toBe('loading');
  });

  it('makes no request of its own, however many avatars a page draws', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const people = Array.from(
      { length: 500 },
      (_, i) => `https://lh3.googleusercontent.com/a/p${i}`,
    );
    const { container } = render(
      <>
        {people.map((url, i) => (
          <PictureDisc key={url} pictureUrl={url} name={`Person ${i}`} size={24}>
            P
          </PictureDisc>
        ))}
      </>,
    );
    expect(container.querySelectorAll('img')).toHaveLength(500);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
