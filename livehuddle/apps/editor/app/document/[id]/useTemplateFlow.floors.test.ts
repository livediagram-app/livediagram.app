// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livehuddle/document';
import type { TemplateKind } from '@livehuddle/templates';
import { useTemplateFlow } from './useTemplateFlow';

// docs/specs/007-editor/templates-by-mode.md "A template with floors": picked on Start a Space, a building lands on the
// empty tab and its other floors arrive as new tabs straight after it, each marked loaded, in one commit.

async function pick(kind: TemplateKind, start: Tab[]) {
  let tabs = start;
  const commits = vi.fn();
  const markTabLoaded = vi.fn();
  const { result } = renderHook(() =>
    useTemplateFlow({
      activeId: 't1',
      tabs,
      selfParticipant: { id: 'me', name: 'Me', color: '#000' } as never,
      documentName: 'Board',
      nameDocument: vi.fn(),
      getViewportCenter: () => ({ x: 0, y: 0 }),
      commitTabs: (update) => {
        commits();
        tabs = update(tabs);
      },
      confirmName: vi.fn(),
      setSelectedId: vi.fn(),
      setEditingId: vi.fn(),
      setSelfParticipant: vi.fn(),
      setIdentityPromptOpen: vi.fn(),
      requestFit: vi.fn(),
      putToolDown: vi.fn(),
      markTabLoaded,
    }),
  );
  await act(async () => {
    await result.current.chooseTemplate(kind);
  });
  return { tabs, commits, markTabLoaded };
}

const empty = (id: string, name: string): Tab => ({ id, name, elements: [] });

describe('chooseTemplate and a template with floors', () => {
  it('adds the Hotel and Suites floors after the picked tab, named and loaded, in one commit', async () => {
    const { tabs, commits, markTabLoaded } = await pick('hotel-and-suites', [
      empty('t1', 'Tab 1'),
      empty('t2', 'Notes'),
    ]);
    expect(tabs.map((t) => t.name)).toEqual(['Lobby', 'Suites', 'Rooftop', 'Notes']);
    expect(tabs[1]!.backgroundPattern).toBe('carpet');
    expect(tabs[2]!.backgroundPattern).toBe('deck');
    expect(tabs.every((t, i) => i === 3 || t.elements.length > 0)).toBe(true);
    expect(commits).toHaveBeenCalledOnce();
    expect(markTabLoaded.mock.calls.map((call) => String(call[0]))).toEqual([
      tabs[1]!.id,
      tabs[2]!.id,
    ]);
  });

  it('adds no tab for a template on one tab', async () => {
    const { tabs, markTabLoaded } = await pick('team-pod', [empty('t1', 'Tab 1')]);
    expect(tabs).toHaveLength(1);
    expect(markTabLoaded).not.toHaveBeenCalled();
  });

  it('adds no floor when the tab gained work before the builders loaded', async () => {
    const busy: Tab = {
      id: 't1',
      name: 'Tab 1',
      elements: [
        { id: 'x', type: 'text', x: 0, y: 0, width: 10, height: 10, label: 'hi' } as never,
      ],
    };
    const { tabs } = await pick('coworking-tower', [busy]);
    expect(tabs).toEqual([busy]);
  });
});
