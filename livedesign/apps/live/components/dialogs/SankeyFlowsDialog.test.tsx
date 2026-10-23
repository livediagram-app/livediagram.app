// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livedesign/design';
import { SankeyFlowsDialog } from './SankeyFlowsDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(cleanup);

// docs/specs/009-elements/sankey.md "Leftovers": the per-node switch stores at once, both ways.
const leaky = (extra: Partial<ShapeElement> = {}) =>
  ({
    ...createShape('sankey', 0, 0),
    id: 's',
    sankeyFlows: [
      { from: 'Income', to: 'Budget', value: 1000 },
      { from: 'Budget', to: 'Rent', value: 800 },
    ],
    ...extra,
  }) as ShapeElement;

const leftoverSwitch = () => screen.getByRole('switch', { name: /not sent on from Budget/ });

describe('SankeyFlowsDialog leftover switch', () => {
  it('stores a node’s leftover switched off', () => {
    const onCommit = vi.fn();
    render(<SankeyFlowsDialog element={leaky()} onCommit={onCommit} onClose={vi.fn()} />);
    fireEvent.click(leftoverSwitch());
    expect(onCommit).toHaveBeenLastCalledWith(expect.any(Array), [
      { name: 'Budget', leftover: false },
    ]);
  });

  it('stores it switched back on, clearing the node’s only setting', () => {
    const onCommit = vi.fn();
    render(
      <SankeyFlowsDialog
        element={leaky({ sankeyNodes: [{ name: 'Budget', leftover: false }] })}
        onCommit={onCommit}
        onClose={vi.fn()}
      />,
    );
    expect(leftoverSwitch().getAttribute('aria-checked')).toBe('false');
    fireEvent.click(leftoverSwitch());
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenLastCalledWith(expect.any(Array), undefined);
    expect(leftoverSwitch().getAttribute('aria-checked')).toBe('true');
  });
});

// Escape closes without blurring the focused field, so the close itself stores what was typed.
describe('SankeyFlowsDialog close', () => {
  it('stores a typed amount when Escape closes the dialog mid-edit', () => {
    const onCommit = vi.fn();
    const onClose = vi.fn();
    render(<SankeyFlowsDialog element={leaky()} onCommit={onCommit} onClose={onClose} />);
    const amount = screen.getAllByDisplayValue('800')[0]!;
    fireEvent.change(amount, { target: { value: '900' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenLastCalledWith(
      [
        { from: 'Income', to: 'Budget', value: 1000 },
        { from: 'Budget', to: 'Rent', value: 900 },
      ],
      undefined,
    );
  });

  it('stores nothing on a close with no change', () => {
    const onCommit = vi.fn();
    render(<SankeyFlowsDialog element={leaky()} onCommit={onCommit} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onCommit).not.toHaveBeenCalled();
  });
});
