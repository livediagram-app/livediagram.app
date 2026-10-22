// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLinkCard, createShape, type Element, type Tab } from '@livedocuments/document';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const api = vi.hoisted(() => ({ apiUnfurl: vi.fn() }));
vi.mock('@/lib/api-client', () => api);

import { useElementLinks } from './useElementLinks';

const linkCard: Element = { ...createLinkCard(0, 0), id: 'card' };
const square: Element = { ...createShape('square', 0, 0), id: 'box' };

function links(selected: string) {
  const tab: Tab = { id: 't', name: 'Tab', elements: [linkCard, square] };
  return renderHook(() =>
    useElementLinks({
      currentSelectionIds: () => new Set([selected]),
      commit: () => {},
      tabs: [tab],
      setActiveId: () => {},
      setSelectedId: () => {},
      setEditingId: () => {},
      setFormatSourceId: () => {},
      openDocument: () => {},
    }),
  ).result.current;
}

// docs/specs/009-elements/link-cards.md "Fetching the preview": only a link card draws a preview, so only a link
// card's URL is sent to the unfurl endpoint.
describe('useElementLinks unfurl', () => {
  beforeEach(() => {
    api.apiUnfurl.mockReset();
    api.apiUnfurl.mockResolvedValue(null);
  });

  it('fetches a preview for a URL set on a link card', () => {
    links('card').applyElementLink({ kind: 'url', url: 'https://example.com' });
    expect(api.apiUnfurl).toHaveBeenCalledWith('https://example.com');
  });

  it('sends no request for a URL linked from any other element', () => {
    links('box').applyElementLink({ kind: 'url', url: 'https://example.com' });
    expect(api.apiUnfurl).not.toHaveBeenCalled();
  });
});
