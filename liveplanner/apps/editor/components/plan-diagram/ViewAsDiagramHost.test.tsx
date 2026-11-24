// @vitest-environment jsdom
// View As Diagram's host (view-as-diagram.md "Where"): a Board tab's menu opens the dialog for that tab's boards; a
// session that may not draw never listens, so its menus never offer it; a tab with no board opens nothing.
import { act, cleanup, render, screen } from '@testing-library/react';
import { presetSetup } from '@liveplanner/items';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ctx = vi.hoisted(() => ({ value: null as unknown }));
const connect = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/app/project/[id]/EditorContext', () => ({ useOptionalEditorContext: () => ctx.value }));
vi.mock('@/components/plan/PlanContext', () => ({
  usePlan: () => ({ items: new Map(), types: [] }),
}));
vi.mock('@/components/connect/useConnectHost', () => ({ useConnectHost: () => connect.value }));
vi.mock('./ViewAsDiagramDialog', () => ({
  ViewAsDiagramDialog: (p: {
    boards: unknown[];
    planTitle: string;
    connect: unknown;
    me: string;
    onClose: () => void;
  }) => (
    <div role="dialog">
      {p.boards.length}|{p.planTitle}|{p.connect ? 'connect' : 'open'}|{p.me}
      <button type="button" onClick={p.onClose}>
        close
      </button>
    </div>
  ),
}));

import { ViewAsDiagramHost } from './ViewAsDiagramHost';
import { canViewAsDiagram, openViewAsDiagram } from './view-entry';

const boardTab = {
  id: 'b',
  name: 'Board',
  elements: [
    {
      id: 'el',
      type: 'shape',
      shape: 'plan-board',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      planBoard: presetSetup('kanban'),
    },
  ],
};
const plainTab = { id: 'p', name: 'Notes', elements: [] };

afterEach(() => {
  cleanup();
  ctx.value = null;
  connect.value = null;
});

describe('ViewAsDiagramHost', () => {
  it("opens the dialog for the tab whose menu asked, an Editor's with a connected tab", async () => {
    const addConnectedTab = vi.fn();
    connect.value = { grant: vi.fn(), addConnectedTab };
    ctx.value = {
      projectId: 'P',
      projectName: ' ',
      accountUserId: null,
      tabs: [boardTab, plainTab],
    };
    render(<ViewAsDiagramHost enabled />);
    expect(canViewAsDiagram()).toBe(true);
    act(() => openViewAsDiagram('b'));
    expect((await screen.findByRole('dialog')).textContent).toContain('1|Untitled plan|connect|');
    act(() => screen.getByRole('button', { name: 'close' }).click());
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => openViewAsDiagram('p'));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => openViewAsDiagram('gone'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens in a new browser tab for one without connect, named by the plan', async () => {
    ctx.value = { projectId: 'P', projectName: 'Launch', accountUserId: 'u1', tabs: [boardTab] };
    render(<ViewAsDiagramHost enabled />);
    act(() => openViewAsDiagram('b'));
    expect((await screen.findByRole('dialog')).textContent).toContain('1|Launch|open|u1');
  });

  it('never listens in a session that may not draw', () => {
    ctx.value = { projectId: 'P', projectName: 'Launch', tabs: [boardTab] };
    const { unmount } = render(<ViewAsDiagramHost enabled={false} />);
    expect(canViewAsDiagram()).toBe(false);
    act(() => openViewAsDiagram('b'));
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();
  });
});
