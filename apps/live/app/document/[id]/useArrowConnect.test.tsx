// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  layOutIllustratePages,
  newLogoPage,
  type Element,
  type LaidOutPage,
  type Tab,
} from '@livediagram/document';
import { useArrowConnect } from './useArrowConnect';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/illustrate-pages.md "Arrows stay on one page": Connect never joins two pages.
const pages = layOutIllustratePages([newLogoPage('a'), newLogoPage('b')]);
const box = (id: string, page: number) => {
  const r = pages[page]!.rect;
  return {
    id,
    type: 'shape',
    shape: 'square',
    x: r.x + r.width / 2 - 10,
    y: r.y + r.height / 2 - 10,
    width: 20,
    height: 20,
  } as Element;
};
const tab = { id: 't', name: 'T', elements: [box('s', 0), box('same', 0), box('other', 1)] } as Tab;

function setup(withPages: readonly LaidOutPage[] | null) {
  const commitTabs = vi.fn();
  const hook = renderHook(() =>
    useArrowConnect({
      editsBlocked: false,
      activeId: 't',
      activeTab: tab,
      readSelection: () => ({ selectedId: 's', multiSelectedIds: new Set() }) as never,
      setSelectedId: vi.fn(),
      beginDraw: vi.fn(),
      commitTabs,
      styleNewElement: (el) => el,
      pages: withPages,
    }),
  );
  return { hook, commitTabs };
}

const connect = (withPages: readonly LaidOutPage[] | null, toId: string) => {
  const { hook, commitTabs } = setup(withPages);
  act(() => hook.result.current.addArrow());
  act(() => hook.result.current.connectArrowTo(toId));
  return { commitTabs, armed: hook.result.current.connectSourceId };
};

describe('useArrowConnect across pages', () => {
  it('joins two elements on one page', () => {
    expect(connect(pages, 'same').commitTabs).toHaveBeenCalledTimes(1);
  });

  it('draws nothing to an element on another page, and ends the connect', () => {
    const { commitTabs, armed } = connect(pages, 'other');
    expect(commitTabs).not.toHaveBeenCalled();
    expect(armed).toBeNull();
  });

  it('joins any two elements outside Illustrate mode', () => {
    expect(connect(null, 'other').commitTabs).toHaveBeenCalledTimes(1);
  });
});
