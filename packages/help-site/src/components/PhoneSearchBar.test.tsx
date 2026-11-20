// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { HelpClientProvider } from '../client';
import { CLIENT } from '../test/fixture';
import { PhoneSearchBar } from './PhoneSearchBar';
import { SearchInput } from './SearchInput';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// liveworkspace/docs/specs/017-help/help-centre.md "Choosing an app": the home's hero holds the search, so the header's
// box and the phone row leave it out there and show it on every other page; the hero's box always shows.
let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

function render(node: React.ReactNode) {
  const host = document.createElement('div');
  const root = createRoot(host);
  act(() => root.render(<HelpClientProvider value={CLIENT}>{node}</HelpClientProvider>));
  const boxes = [...host.querySelectorAll('input[data-help-search]')].map(
    (i) => (i as HTMLInputElement).dataset.helpSearch,
  );
  act(() => root.unmount());
  return boxes;
}

describe('where the search shows', () => {
  it('leaves the header and the phone row out on the home, keeping the hero', () => {
    pathname = '/';
    expect(render(<SearchInput />)).toEqual([]);
    expect(render(<PhoneSearchBar />)).toEqual([]);
    expect(render(<SearchInput large />)).toEqual(['large']);
  });

  it('shows the header and the phone row on every other page', () => {
    pathname = '/canvas/';
    expect(render(<SearchInput />)).toEqual(['header']);
    expect(render(<PhoneSearchBar />)).toEqual(['bar']);
  });
});
