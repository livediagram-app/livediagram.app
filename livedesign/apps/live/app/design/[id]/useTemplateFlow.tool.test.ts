// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/design';
import type { TemplateKind } from '@livedesign/templates';
import { photoEditSampleAsked } from '@/lib/photo-template/photo-edit-sample-apply';
import { newDesignContent } from '@/lib/new-design-content';
import { useTemplateFlow } from './useTemplateFlow';

// A tab with content opens on Select. A template that lands content makes the tab one, so the tool picked up for the
// empty tab is put down; Blank lands nothing and leaves it.

async function pick(kind: TemplateKind): Promise<ReturnType<typeof vi.fn>> {
  let tabs: Tab[] = [{ id: 't1', name: '', elements: [] }];
  const putToolDown = vi.fn();
  const { result } = renderHook(() =>
    useTemplateFlow({
      activeId: 't1',
      tabs,
      selfParticipant: { id: 'me', name: 'Me', color: '#000' } as never,
      designName: 'Board',
      nameDesign: vi.fn(),
      getViewportCenter: () => ({ x: 0, y: 0 }),
      commitTabs: (update) => {
        tabs = update(tabs);
      },
      confirmName: vi.fn(),
      setSelectedId: vi.fn(),
      setEditingId: vi.fn(),
      setSelfParticipant: vi.fn(),
      setIdentityPromptOpen: vi.fn(),
      requestFit: vi.fn(),
      putToolDown,
      markTabLoaded: vi.fn(),
    }),
  );
  await act(async () => {
    await result.current.chooseTemplate(kind);
  });
  return putToolDown;
}

describe('chooseTemplate and the tool in hand', () => {
  it('puts the tool down when a template lands its content', async () => {
    expect(await pick('logo-design')).toHaveBeenCalledOnce();
  });

  it('leaves the tool in hand on Blank, which lands nothing', async () => {
    expect(await pick('blank')).not.toHaveBeenCalled();
  });
});

// docs/specs/031-photo/photo-pages.md "The Photo Edit template": picking Photo Edit, on a start or by /new, asks
// the editor for its sample on the tab it made, and no other template does.
describe('the Photo Edit sample asked for', () => {
  it('by a start pick of Photo Edit, for its tab alone', async () => {
    await pick('logo-design');
    expect(photoEditSampleAsked('t1')).toBe(false);
    await pick('photo-edit');
    expect(photoEditSampleAsked('t1')).toBe(true);
  });

  it('by /new for Photo Edit, for the tab it makes', async () => {
    await newDesignContent({ templateKind: 'blank-logo', themeId: 'brand', tabId: 'n1' });
    expect(photoEditSampleAsked('n1')).toBe(false);
    await newDesignContent({ templateKind: 'photo-edit', themeId: 'brand', tabId: 'n2' });
    expect(photoEditSampleAsked('n2')).toBe(true);
  });
});
