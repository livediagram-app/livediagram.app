// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChipField } from './ChipField';

// The shared chip field (Community tags, Plan labels).

afterEach(cleanup);

function Harness({ initial = [] as string[], readOnly = false }) {
  const [chips, setChips] = useState(initial);
  const [draft, setDraft] = useState('');
  return (
    <>
      <ChipField
        chips={chips}
        removeLabel={(c) => `Remove ${c}`}
        draft={draft}
        onDraftChange={setDraft}
        onCommit={() => {
          if (draft.trim()) setChips([...chips, draft.trim()]);
          setDraft('');
        }}
        onRemove={(c) => setChips(chips.filter((x) => x !== c))}
        readOnly={readOnly}
        emptyText="None"
        ariaLabel="Chips"
      />
      <output data-testid="chips">{chips.join(' ')}</output>
    </>
  );
}

const field = () => screen.getByLabelText('Chips') as HTMLInputElement;
const chips = () => screen.getByTestId('chips').textContent;

describe('ChipField', () => {
  it('adds the draft on Enter', () => {
    render(<Harness />);
    fireEvent.change(field(), { target: { value: 'alpha' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(chips()).toBe('alpha');
    expect(field().value).toBe('');
  });

  it('takes the last chip back on Backspace in an empty field', () => {
    render(<Harness initial={['a', 'b']} />);
    fireEvent.keyDown(field(), { key: 'Backspace' });
    expect(chips()).toBe('a');
  });

  it('removes a chip by its button and puts focus back in the field', () => {
    render(<Harness initial={['a', 'b']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove a' }));
    expect(chips()).toBe('b');
    expect(document.activeElement).toBe(field());
  });

  it('shows only the chips, or the empty text, when read-only', () => {
    render(<Harness readOnly />);
    expect(screen.getByText('None')).toBeTruthy();
    expect(screen.queryByLabelText('Chips')).toBeNull();
    cleanup();
    render(<Harness readOnly initial={['a']} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('None')).toBeNull();
  });
});
