// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "A slot's name": an Editor names a chart's, a metric's or a figure's slot from the
// Name field in its Slot section; Enter or leaving saves the trimmed name, Escape puts it back, emptying it clears it
// (the generated name again), an unchanged name saves nothing; anyone else, and any other slot, gets no field.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardContent, DashboardSlot, Element } from '@liveplanner/project';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { SlotSection } from './SlotSection';
import { generatedSlotName } from './SlotNameField';

afterEach(cleanup);

const view = (id: string, planView: { view: string }): Element =>
  ({ id, type: 'shape', shape: 'plan-view', planView }) as unknown as Element;
const ELEMENTS = new Map<string, Element>([
  ['chart', view('chart', { view: 'workload' })],
  ['metric', view('metric', { view: 'metric:count' })],
  ['board', { id: 'board', type: 'shape', shape: 'plan-board' } as unknown as Element],
]);

const slotOf = (content: DashboardContent): DashboardSlot => ({ id: 's1', span: 6, content });

function show(slot: DashboardSlot, canEdit = true) {
  const setSlotContent = vi.fn();
  const value = {
    tabs: [],
    elements: ELEMENTS,
    canEdit,
    actions: { setSlotContent, placeItem: vi.fn(), removeSlot: vi.fn(), changeDashboard: vi.fn() },
    openTab: vi.fn(),
    tabStatus: () => 'loaded',
    retryTab: vi.fn(),
  } as unknown as DashboardContextValue;
  const ui = (s: DashboardSlot) => (
    <DashboardContext.Provider value={value}>
      <SlotSection
        rowId="r"
        slot={s}
        at={{ slot: 0, row: 0, slots: 2 }}
        open
        onToggle={vi.fn()}
        onClose={vi.fn()}
      />
    </DashboardContext.Provider>
  );
  const view = render(ui(slot));
  return { setSlotContent, rerender: (s: DashboardSlot) => view.rerender(ui(s)) };
}

const field = () => screen.getByLabelText<HTMLInputElement>('Name');

describe('the Name field in the Slot section', () => {
  it('is offered for a chart, a metric and either figure, its placeholder the generated name', () => {
    const cases: [DashboardContent, string][] = [
      [{ type: 'element', elementId: 'chart' }, 'Cards by Field'],
      [{ type: 'element', elementId: 'metric' }, 'Item Count'],
      [{ type: 'sheet-metric', metric: 'figure', sheetId: '' }, 'Sheet Figure'],
      [{ type: 'form-metric', metric: 'responses', formTabId: '' }, 'Responses'],
    ];
    for (const [content, placeholder] of cases) {
      show(slotOf(content));
      expect(field().placeholder).toBe(placeholder);
      cleanup();
    }
  });

  it('is not offered for a tab, a Board, a note, a gone element, nor to anyone who may not edit', () => {
    const none: DashboardContent[] = [
      { type: 'tab', tabId: 't1', of: 'board' },
      { type: 'element', elementId: 'board' },
      { type: 'element', elementId: 'gone' },
      { type: 'note', title: 'A', text: 'B' },
    ];
    for (const content of none) {
      show(slotOf(content));
      expect(screen.queryByLabelText('Name')).toBeNull();
      cleanup();
    }
    show(slotOf({ type: 'element', elementId: 'chart' }), false);
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(generatedSlotName(undefined, undefined)).toBeNull();
  });

  it('saves the trimmed name on Enter, and nothing when it is unchanged', () => {
    const { setSlotContent } = show(slotOf({ type: 'element', elementId: 'chart', name: 'Load' }));
    expect(field().value).toBe('Load');
    fireEvent.change(field(), { target: { value: '  Launch readiness ' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    // Enter blurs; jsdom does not move focus for us.
    fireEvent.blur(field());
    expect(setSlotContent).toHaveBeenCalledWith('s1', {
      type: 'element',
      elementId: 'chart',
      name: 'Launch readiness',
    });
    expect(field().value).toBe('Launch readiness');
    setSlotContent.mockClear();
    fireEvent.change(field(), { target: { value: 'Load ' } });
    cleanup();
    const again = show(slotOf({ type: 'element', elementId: 'chart', name: 'Load' }));
    fireEvent.change(field(), { target: { value: 'Load ' } });
    fireEvent.blur(field());
    expect(again.setSlotContent).not.toHaveBeenCalled();
  });

  it('clears the name when emptied, back to the generated one', () => {
    const { setSlotContent } = show(
      slotOf({ type: 'form-metric', metric: 'responses', formTabId: 'f', name: 'Sign-ups' }),
    );
    fireEvent.change(field(), { target: { value: '   ' } });
    fireEvent.blur(field());
    expect(setSlotContent).toHaveBeenCalledWith('s1', {
      type: 'form-metric',
      metric: 'responses',
      formTabId: 'f',
    });
    expect(field().value).toBe('');
  });

  it('puts the name back on Escape and saves nothing, even as the popover closes', () => {
    const { setSlotContent } = show(slotOf({ type: 'element', elementId: 'metric', name: 'Open' }));
    fireEvent.change(field(), { target: { value: 'Something else' } });
    fireEvent.keyDown(field(), { key: 'Escape' });
    fireEvent.blur(field());
    expect(setSlotContent).not.toHaveBeenCalled();
    expect(field().value).toBe('Open');
    // Typing again after Escape saves as usual.
    fireEvent.change(field(), { target: { value: 'Open work' } });
    fireEvent.blur(field());
    expect(setSlotContent).toHaveBeenCalledWith('s1', {
      type: 'element',
      elementId: 'metric',
      name: 'Open work',
    });
  });

  it('shows a name changed elsewhere (an undo, a collaborator)', () => {
    const { rerender } = show(slotOf({ type: 'element', elementId: 'chart', name: 'Load' }));
    rerender(slotOf({ type: 'element', elementId: 'chart' }));
    expect(field().value).toBe('');
    rerender(slotOf({ type: 'element', elementId: 'chart', name: 'Team' }));
    expect(field().value).toBe('Team');
  });
});
