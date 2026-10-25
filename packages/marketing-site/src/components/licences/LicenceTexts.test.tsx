// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LicenceTexts } from './LicenceTexts';

const TEXTS = [{ label: 'LICENSE', hash: 'aaaaaaaaaaaaaaaa', lines: 3 }];

function mount(open = false) {
  const view = render(
    <details open={open}>
      <summary>react</summary>
      <LicenceTexts work="react" texts={TEXTS} />
    </details>,
  );
  const details = view.container.querySelector('details')!;
  const box = () => screen.getByRole('region', { name: 'LICENSE for react' });
  const toggleOpen = async () => {
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
    });
  };
  return { box, toggleOpen };
}

function stubFetch(result: Promise<Response>) {
  const fetchMock = vi.fn((_url: string) => result);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LicenceTexts', () => {
  it('fetches nothing while its entry is closed', () => {
    const fetchMock = stubFetch(Promise.resolve(new Response('MIT')));
    const { box } = mount();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(box().textContent).toBe('Loading LICENSE…');
  });

  it('loads its text when the entry opens, in a box that never changes height', async () => {
    const fetchMock = stubFetch(Promise.resolve(new Response('MIT licence\n')));
    const { box, toggleOpen } = mount();
    const height = box().style.height;
    expect(box().getAttribute('aria-busy')).toBe('true');
    await toggleOpen();
    expect(fetchMock).toHaveBeenCalledWith('/licences/texts/aaaaaaaaaaaaaaaa.txt');
    expect(box().textContent).toBe('MIT licence');
    expect(box().getAttribute('aria-busy')).toBe('false');
    expect(box().style.height).toBe(height);
    expect(box().tabIndex).toBe(0);
  });

  it('loads at once when its entry is already open', async () => {
    const fetchMock = stubFetch(Promise.resolve(new Response('MIT')));
    await act(async () => {
      mount(true);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows the error copy in the same box when the text does not load', async () => {
    stubFetch(Promise.resolve(new Response('gone', { status: 404 })));
    const { box, toggleOpen } = mount();
    const height = box().style.height;
    await toggleOpen();
    expect(box().textContent).toBe(
      'This text could not be loaded. Open the plain-text file instead.',
    );
    expect(box().style.height).toBe(height);
  });

  it('shows the error copy when the network fails', async () => {
    stubFetch(Promise.reject(new TypeError('offline')));
    const { box, toggleOpen } = mount();
    await toggleOpen();
    expect(box().textContent).toContain('could not be loaded');
  });

  it('fetches once however often the entry toggles', async () => {
    const fetchMock = stubFetch(Promise.resolve(new Response('MIT')));
    const { toggleOpen } = mount();
    await toggleOpen();
    await toggleOpen();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('links the plain text with a name that says which, once the entry is open', async () => {
    stubFetch(Promise.resolve(new Response('MIT')));
    await act(async () => {
      mount(true);
    });
    const link = screen.getByRole('link', { name: 'Plain text of LICENSE for react' });
    expect(link.getAttribute('href')).toBe('/licences/texts/aaaaaaaaaaaaaaaa.txt');
  });
});
