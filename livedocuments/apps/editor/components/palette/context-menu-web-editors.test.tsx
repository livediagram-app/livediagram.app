// @vitest-environment jsdom

// The web components' menu row editors (docs/specs/009-elements/web-components-and-no-groups.md): add / remove / reorder,
// bounded by each kind's minimum and maximum.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createShape,
  type Element,
  type ShapeElement,
  NAV_LINKS_MAX,
  PROCESS_MIN_STEPS,
  STATS_MIN,
  type WebRows,
} from '@livedocuments/document';

import {
  ConceptRowsEditor,
  hasWebRowsSection,
  TextRowsEditor,
  WebRowsMenuSection,
} from './context-menu-web-editors';

afterEach(cleanup);

const open = () => ({ open: true, onToggle: () => {}, flush: true });

function renderSection(shape: Parameters<typeof createShape>[0], patch: object = {}) {
  const onSetRows = vi.fn<(rows: WebRows) => void>();
  render(
    <WebRowsMenuSection
      target={{ ...createShape(shape, 0, 0), ...patch }}
      sectionProps={open}
      onSetRows={onSetRows}
    />,
  );
  return onSetRows;
}

describe('WebRowsMenuSection (docs/specs/009-elements/web-components-and-no-groups.md)', () => {
  it('only the row-carrying kinds get a section', () => {
    expect(hasWebRowsSection(createShape('stat-row', 0, 0))).toBe(true);
    expect(hasWebRowsSection(createShape('process', 0, 0))).toBe(true);
    expect(hasWebRowsSection(createShape('site-header', 0, 0))).toBe(true);
    expect(hasWebRowsSection(createShape('banner', 0, 0))).toBe(false);
    expect(hasWebRowsSection(createShape('square', 0, 0))).toBe(false);
    // docs/specs/009-elements/concept-graphics.md "Editing": chevrons edit their stages on the canvas instead.
    expect(hasWebRowsSection(createShape('cycle', 0, 0))).toBe(true);
    expect(hasWebRowsSection(createShape('chevrons', 0, 0))).toBe(false);
  });

  it('adds a step and removes one', () => {
    const onSetRows = renderSection('process');
    fireEvent.click(screen.getByRole('button', { name: 'Add Step' }));
    expect(onSetRows).toHaveBeenLastCalledWith({
      processSteps: ['Plan', 'Build', 'Ship', 'Step 4'],
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove step' })[0]!);
    expect(onSetRows).toHaveBeenLastCalledWith({ processSteps: ['Build', 'Ship'] });
  });

  it('reorders a link, and disables moves past either end', () => {
    const onSetRows = renderSection('site-header');
    fireEvent.click(screen.getAllByRole('button', { name: 'Move link down' })[0]!);
    expect(onSetRows).toHaveBeenLastCalledWith({ navLinks: ['About', 'Home', 'Contact'] });
    expect(
      (screen.getAllByRole('button', { name: 'Move link up' })[0] as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('will not remove below the minimum or add above the maximum', () => {
    renderSection('process', { processSteps: Array(PROCESS_MIN_STEPS).fill('s') });
    for (const b of screen.getAllByRole('button', { name: 'Remove step' })) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
    cleanup();
    renderSection('stat-row', { stats: [{ value: '1', caption: 'a' }].slice(0, STATS_MIN) });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Remove stat' }).disabled).toBe(
      true,
    );
    cleanup();
    renderSection('site-header', { navLinks: Array(NAV_LINKS_MAX).fill('l') });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Add Link' }).disabled).toBe(true);
  });

  it('commits a retyped stat on blur', () => {
    const onSetRows = renderSection('stat-row');
    const input = screen.getByRole('textbox', { name: 'Stat 1 caption' });
    fireEvent.change(input, { target: { value: 'Customers' } });
    fireEvent.blur(input);
    expect(onSetRows).toHaveBeenLastCalledWith({
      stats: [
        { value: '1.2k', caption: 'Customers' },
        { value: '98%', caption: 'Uptime' },
        { value: '4.7', caption: 'Rating' },
      ],
    });
  });

  // docs/specs/009-elements/stat-row.md: the change line and the count-up switch.
  it('types a change into a stat', () => {
    const onSetRows = renderSection('stat-row');
    const input = screen.getByRole('textbox', { name: 'Stat 2 change' });
    fireEvent.change(input, { target: { value: '▲ 0.4 pts' } });
    fireEvent.blur(input);
    expect(onSetRows.mock.calls.at(-1)![0].stats![1]).toEqual({
      value: '98%',
      caption: 'Uptime',
      change: '▲ 0.4 pts',
    });
  });

  it('switches Count Up When Presented off, stored as false, and back on as nothing', () => {
    type ElementMap = (el: Element) => Element;
    const commit = vi.fn<(map: ElementMap, type: string) => void>();
    const ops = { preview: vi.fn(), end: vi.fn(), commit, burst: vi.fn(), commitTab: vi.fn() };
    const target = createShape('stat-row', 0, 0);
    render(
      <WebRowsMenuSection target={target} sectionProps={open} onSetRows={vi.fn()} ops={ops} />,
    );
    const toggle = screen.getByRole('button', { name: /Count Up When Presented/ });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(commit).toHaveBeenCalledWith(expect.any(Function), 'StatCountUp');
    const off = commit.mock.calls[0]![0](target) as ShapeElement;
    expect(off.statCountUp).toBe(false);
    cleanup();
    const commitOn = vi.fn<(map: ElementMap, type: string) => void>();
    render(
      <WebRowsMenuSection
        target={off}
        sectionProps={open}
        onSetRows={vi.fn()}
        ops={{ ...ops, commit: commitOn }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Count Up When Presented/ }));
    expect('statCountUp' in commitOn.mock.calls[0]![0](off)).toBe(false);
    // Not a stat row: left alone.
    const card = createShape('card', 0, 0);
    expect(commitOn.mock.calls[0]![0](card)).toBe(card);
  });
});

// docs/specs/009-elements/concept-graphics.md: a concept graphic's rows, a label each and a note where its kind
// draws one.
describe('ConceptRowsEditor', () => {
  const rows = [{ label: 'Plan', note: 'Q1' }, { label: 'Build' }];

  it('edits a label and a note, committing on blur, and adds a numbered row', () => {
    const onChange = vi.fn();
    render(
      <ConceptRowsEditor rows={rows} min={1} max={3} noun="Layer" notes onChange={onChange} />,
    );
    const note = screen.getByRole('textbox', { name: 'Layer 2 note' });
    fireEvent.change(note, { target: { value: '9' } });
    fireEvent.blur(note);
    expect(onChange).toHaveBeenLastCalledWith([
      { label: 'Plan', note: 'Q1' },
      { label: 'Build', note: '9' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Add Layer' }));
    // The draft keeps the edit, so the add and the move carry it.
    const edited = [rows[0], { label: 'Build', note: '9' }];
    expect(onChange).toHaveBeenLastCalledWith([...edited, { label: 'Layer 3' }]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Move layer down' })[0]!);
    expect(onChange).toHaveBeenLastCalledWith([edited[1], edited[0]]);
  });

  it('shows no note where the kind draws none, and stops at its bounds', () => {
    render(
      <ConceptRowsEditor
        rows={rows}
        min={2}
        max={2}
        noun="Tier"
        notes={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole('textbox', { name: 'Tier 1 note' })).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Add Tier' }).disabled).toBe(true);
    expect(
      (screen.getAllByRole('button', { name: 'Remove tier' })[0] as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('TextRowsEditor', () => {
  it('commits a retyped row on blur and names a new one from its count', () => {
    const onChange = vi.fn();
    render(
      <TextRowsEditor
        rows={['Home', 'Docs']}
        min={1}
        max={5}
        noun="Link"
        addLabel="Add Link"
        nextRow={(n) => `Link ${n + 1}`}
        onChange={onChange}
      />,
    );
    const first = screen.getByRole('textbox', { name: 'Link 1' });
    fireEvent.change(first, { target: { value: 'Start' } });
    fireEvent.blur(first);
    expect(onChange).toHaveBeenLastCalledWith(['Start', 'Docs']);
    fireEvent.click(screen.getByRole('button', { name: 'Add Link' }));
    expect(onChange).toHaveBeenLastCalledWith(['Start', 'Docs', 'Link 3']);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove link' })[0]!);
    expect(onChange).toHaveBeenLastCalledWith(['Docs']);
  });
});
