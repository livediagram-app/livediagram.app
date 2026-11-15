// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLinkCard, createShape, type Element, type Tab } from '@livedesign/design';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const api = vi.hoisted(() => ({ apiUnfurl: vi.fn() }));
vi.mock('@/lib/api-client', () => api);

import { useElementLinks } from './useElementLinks';

const linkCard: Element = { ...createLinkCard(0, 0), id: 'card' };
const square: Element = { ...createShape('square', 0, 0), id: 'box' };

function links(selected: string, setActiveId: (id: string) => void = () => {}) {
  const tab: Tab = { id: 't', name: 'Tab', elements: [linkCard, square] };
  return renderHook(() =>
    useElementLinks({
      currentSelectionIds: () => new Set([selected]),
      commit: () => {},
      tabs: [tab],
      setActiveId,
      setSelectedId: () => {},
      setEditingId: () => {},
      setFormatSourceId: () => {},
      openDesign: () => {},
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

// docs/specs/007-editor/wireframe-pages.md "Clickable prototypes": a screen link is followed in Prototype mode, so in
// the editor following one (a link to a deleted page included) does nothing and never throws.
describe('useElementLinks follow', () => {
  it('leaves a screen link and a back link alone in the editor', () => {
    const setActiveId = vi.fn();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { followLink } = links('box', setActiveId);
    followLink({ kind: 'page', pageId: 'gone', transition: 'slide' });
    followLink({ kind: 'back' });
    expect(setActiveId).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('still follows a tab link', () => {
    const setActiveId = vi.fn();
    links('box', setActiveId).followLink({ kind: 'tab', tabId: 't' });
    expect(setActiveId).toHaveBeenCalledWith('t');
  });
});
