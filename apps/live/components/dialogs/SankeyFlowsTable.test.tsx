// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { SankeyFlowsTable } from './SankeyFlowsTable';
import { withSankeyNodeLeftover, type SankeyNodeStyle } from '@liveplanner/document';
import { rowsFromFlows, withTrailingBlank, type SankeyDraftRow } from '@/lib/sankey-flow-rows';

// The Flows table (docs/specs/009-elements/sankey.md "The Flows dialog"): levels, groups, keyboard, reasons, paste.
function Harness({
  initial,
  stored,
  leftoverName,
}: {
  initial: SankeyDraftRow[];
  stored: SankeyDraftRow[][];
  leftoverName?: string;
}) {
  const [rows, setDraft] = useState(() => withTrailingBlank(initial));
  const [nodes, setNodes] = useState<SankeyNodeStyle[] | undefined>(undefined);
  const setRows = (next: SankeyDraftRow[]) => setDraft(withTrailingBlank(next));
  return (
    <div>
      <SankeyFlowsTable
        rows={rows}
        nodes={nodes}
        leftoverName={leftoverName}
        onSetLeftover={(name, on) => setNodes((n) => withSankeyNodeLeftover(n, name, on))}
        onRows={setRows}
        onCommit={(next) => {
          stored.push(next);
          setRows(next);
        }}
      />
      <button type="button">Outside</button>
    </div>
  );
}

const budget = () =>
  rowsFromFlows([
    { from: 'Salary', to: 'Budget', value: 3200 },
    { from: 'Freelance', to: 'Budget', value: 800 },
    { from: 'Budget', to: 'Needs', value: 2000 },
    { from: 'Budget', to: 'Savings', value: 2000 },
  ]);
const start = () => rowsFromFlows([{ from: 'Salary', to: 'Budget', value: 3200 }]);

const headings = () => screen.getAllByRole('heading').map((h) => h.textContent);
const group = (name: string) => screen.getByRole('group', { name: `Flows from ${name}` });

describe('SankeyFlowsTable', () => {
  it('groups flows by the node they leave, in a level per step of the diagram', () => {
    render(<Harness initial={budget()} stored={[]} />);
    expect(headings()).toEqual(['Step 1', 'Step 2', 'Add a Flow']);
    expect(within(group('Salary')).getByLabelText<HTMLInputElement>('Flow 1 to').value).toBe(
      'Budget',
    );
    expect(within(group('Budget')).getAllByRole('listitem')).toHaveLength(2);
    expect(within(group('Budget')).getByText('In 4,000 · Out 4,000')).toBeTruthy();
    // A group's rows take its From: there is no From cell to retype.
    expect(screen.queryByLabelText('Flow 1 from')).toBeNull();
  });

  it('offers a + on a row whose To sends nothing on yet, to carry on from it', () => {
    const stored: SankeyDraftRow[][] = [];
    render(<Harness initial={budget()} stored={stored} />);
    expect(screen.queryByRole('button', { name: 'Send on from Budget' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Send on from Needs' }));
    expect(stored.at(-1)!.map((r) => `${r.from}>${r.to}`)).toEqual([
      'Salary>Budget',
      'Freelance>Budget',
      'Budget>Needs',
      'Budget>Savings',
      'Needs>',
      '>',
    ]);
    expect(document.activeElement).toBe(within(group('Needs')).getByLabelText('Flow 5 to'));
    expect(headings()).toEqual(['Step 1', 'Step 2', 'Step 3', 'Add a Flow']);
  });

  it('adds a flow to a group after that node’s last flow, cursor in its To', () => {
    const stored: SankeyDraftRow[][] = [];
    render(<Harness initial={budget()} stored={stored} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a Flow From Salary' }));
    expect(stored.at(-1)!.map((r) => r.from)).toEqual([
      'Salary',
      'Salary',
      'Freelance',
      'Budget',
      'Budget',
      '',
    ]);
    expect(document.activeElement).toBe(screen.getByLabelText('Flow 2 to'));
  });

  it('moves To → Amount → the next row with Enter, and on into the Add a Flow line', () => {
    render(<Harness initial={budget()} stored={[]} />);
    fireEvent.keyDown(screen.getByLabelText('Flow 1 to'), { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByLabelText('Flow 1 amount'));
    fireEvent.keyDown(screen.getByLabelText('Flow 1 amount'), { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByLabelText('Flow 2 to'));
    fireEvent.keyDown(screen.getByLabelText('Flow 4 amount'), { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByLabelText('Flow 5 from'));
  });

  it('always keeps a blank line in the Add a Flow area, and files a new flow under its node once the cursor leaves', () => {
    render(<Harness initial={start()} stored={[]} />);
    const area = () => screen.getByRole('region', { name: 'Add a Flow' });
    expect(within(area()).getByLabelText<HTMLInputElement>('Flow 2 from').value).toBe('');
    expect(within(area()).queryByRole('button', { name: /Remove/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Flow 2 from'), { target: { value: 'Bonus' } });
    // Filling the blank line opens another under it, and the row being written holds its place.
    expect(within(area()).getByLabelText<HTMLInputElement>('Flow 3 from').value).toBe('');
    fireEvent.change(screen.getByLabelText('Flow 2 to'), { target: { value: 'Budget' } });
    expect(within(area()).getByLabelText<HTMLInputElement>('Flow 2 from').value).toBe('Bonus');
    fireEvent.blur(screen.getByLabelText('Flow 2 to'), {
      relatedTarget: screen.getByRole('button', { name: 'Outside' }),
    });
    expect(within(group('Bonus')).getByLabelText<HTMLInputElement>('Flow 2 to').value).toBe(
      'Budget',
    );
    expect(within(area()).getAllByRole('listitem')).toHaveLength(1);
  });

  it('starts with only the Add a Flow area when there are no flows', () => {
    render(<Harness initial={[]} stored={[]} />);
    expect(screen.queryByRole('heading', { name: /^Step/ })).toBeNull();
    expect(screen.getByText(/Write the first flow/)).toBeTruthy();
    expect(screen.getByText('0 of 200')).toBeTruthy();
  });

  it('names why a row cannot be drawn', () => {
    render(
      <Harness
        initial={rowsFromFlows([
          { from: 'A', to: 'B', value: 1 },
          { from: 'B', to: 'A', value: 1 },
        ])}
        stored={[]}
      />,
    );
    expect(screen.getByText('Loops back to an earlier node, so it is hidden')).toBeTruthy();
    expect(screen.getByLabelText('Flow 2 amount').getAttribute('aria-invalid')).toBe('true');
  });

  it('turns pasted spreadsheet rows into flows', () => {
    const stored: SankeyDraftRow[][] = [];
    render(<Harness initial={start()} stored={stored} />);
    fireEvent.paste(screen.getByLabelText('Flow 1 to'), {
      clipboardData: { getData: () => 'Budget\tRent\t1400\nBudget\tFood\t600' },
    });
    expect(stored.at(-1)!.map((r) => `${r.from}>${r.to}`)).toEqual([
      'Salary>Budget',
      'Budget>Rent',
      'Budget>Food',
      '>',
    ]);
    expect(within(group('Budget')).getAllByRole('listitem')).toHaveLength(2);
  });

  it('moves the cursor to the next row shown when a row is removed', () => {
    render(<Harness initial={budget()} stored={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove flow 3' }));
    expect(document.activeElement).toBe(screen.getByLabelText('Flow 3 to'));
  });

  it('shows what a node keeps as its automatic leftover, and flags it amber only when hidden', () => {
    const leaky = () =>
      rowsFromFlows([
        { from: 'Income', to: 'Budget', value: 1000 },
        { from: 'Budget', to: 'Rent', value: 800 },
      ]);
    const { unmount } = render(<Harness initial={leaky()} stored={[]} leftoverName="Leftover" />);
    const on = within(group('Budget')).getByRole('switch', {
      name: 'Draw 200 not sent on from Budget as Leftover',
    });
    expect(on.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(on);
    expect(
      within(group('Budget'))
        .getByRole('switch', { name: /from Budget/ })
        .getAttribute('aria-checked'),
    ).toBe('false');
    expect(within(group('Budget')).getByText('In 1,000 · Out 800').className).not.toContain(
      'amber',
    );
    unmount();
    render(<Harness initial={leaky()} stored={[]} />);
    expect(within(group('Budget')).queryByRole('switch')).toBeNull();
    expect(within(group('Budget')).getByText('In 1,000 · Out 800').className).toContain('amber');
  });
});
