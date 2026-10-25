// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@liveplanner/project';
import { track } from '@/lib/telemetry';
import { SankeyFlowsDialog } from '@/components/dialogs/SankeyFlowsDialog';
import { sankeyFlowsTourSteps } from './sankey-flows-tour-steps';
import { sankeyFlowsDialog } from '@/lib/sankey-flows-dialog-handle';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// jsdom lays nothing out, so "on screen" is just "in the project" here, and there is nothing to scroll.
vi.mock('@liveworkspace/workbench/components/tour/tour-dom', async (actual) => ({
  ...(await actual<typeof import('@liveworkspace/workbench/components/tour/tour-dom')>()),
  waitForSelector: async (selector: string) => document.querySelector<HTMLElement>(selector),
}));
afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
});

const el = (extra: Partial<ShapeElement> = {}) =>
  ({ ...createShape('sankey', 0, 0), id: 's', ...extra }) as ShapeElement;

function renderDialog(element = el()) {
  const onClose = vi.fn();
  render(<SankeyFlowsDialog element={element} onCommit={vi.fn()} onClose={onClose} />);
  return { onClose };
}

const settle = () => act(async () => new Promise((r) => setTimeout(r, 30)));

const startShowMe = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Show Me' }));
  await settle();
};

const next = async () => {
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  await settle();
};

// docs/specs/009-elements/sankey.md "Show Me".
describe('Sankey Flows dialog Show Me', () => {
  it('walks the nodes, the rows, Add Flow, the balance notes, Text, Import CSV and the preview, then a closing card', () => {
    expect(
      sankeyFlowsTourSteps({ hasNodes: true, hasBalanceNotes: true }).map((s) => s.id),
    ).toEqual(['nodes', 'rows', 'add', 'balance', 'text', 'import', 'preview', 'outro']);
    expect(sankeyFlowsTourSteps({ hasNodes: true, hasBalanceNotes: true }).at(-1)?.card).toBe(
      'outro',
    );
  });

  it('leaves out the nodes with no flows, and the balance notes while everything balances', () => {
    const ids = sankeyFlowsTourSteps({ hasNodes: false, hasBalanceNotes: false }).map((s) => s.id);
    expect(ids).not.toContain('nodes');
    expect(ids).not.toContain('rows');
    expect(ids).not.toContain('balance');
  });

  it('sits in the title row, starts on the nodes and sends its Started event', async () => {
    renderDialog();
    await startShowMe();
    expect(screen.getByRole('dialog', { name: /^Show Me step 1 of 6: Your Nodes/ })).toBeTruthy();
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'SankeyFlowsTour');
  });

  it('starts on Add a Flow when there are no flows yet', async () => {
    renderDialog(el({ sankeyFlows: [] }));
    await startShowMe();
    expect(screen.getByRole('dialog', { name: /^Show Me step 1 of 4: Add a Flow/ })).toBeTruthy();
  });

  it('points at the balance notes while a middle node does not balance', async () => {
    renderDialog(
      el({
        sankeyFlows: [
          { from: 'A', to: 'B', value: 10 },
          { from: 'B', to: 'C', value: 14 },
        ],
      }),
    );
    await startShowMe();
    expect(screen.getByRole('dialog', { name: /^Show Me step 1 of 7:/ })).toBeTruthy();
    await next();
    await next();
    await next();
    expect(
      screen.getByRole('dialog', { name: /^Show Me step 4 of 7: In and Out Differ/ }),
    ).toBeTruthy();
  });

  it('brings the Text tab forward on its step, and the Table back on leaving it', async () => {
    renderDialog(el({ sankeyFlows: [] }));
    await startShowMe();
    await next();
    expect(screen.getByRole('dialog', { name: /^Show Me step 2 of 4: Or Type Them/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Text' }).getAttribute('aria-selected')).toBe('true');
    await next();
    expect(
      screen.getByRole('dialog', { name: /^Show Me step 3 of 4: Import a File/ }),
    ).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Table' }).getAttribute('aria-selected')).toBe('true');
  });

  it('keeps Escape from closing the dialog while it runs', async () => {
    const { onClose } = renderDialog();
    await startShowMe();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('reports a skip when left before its end', async () => {
    renderDialog();
    await startShowMe();
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'SankeyFlowsTourSkipped');
  });
});

// The dialog's handle switches its tabs from outside it (lib/sankey-flows-dialog-handle.ts).
describe('Sankey Flows dialog handle', () => {
  it('switches its tabs while it is open, and nothing once it closes', () => {
    renderDialog();
    act(() => sankeyFlowsDialog.showText());
    expect(screen.getByRole('tab', { name: 'Text' }).getAttribute('aria-selected')).toBe('true');
    act(() => sankeyFlowsDialog.showTable());
    expect(screen.getByRole('tab', { name: 'Table' }).getAttribute('aria-selected')).toBe('true');
    cleanup();
    expect(() => sankeyFlowsDialog.showText()).not.toThrow();
  });
});
