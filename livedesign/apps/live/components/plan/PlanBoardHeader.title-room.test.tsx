// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, presetSetup, projectBoard } from '@livepages/items';
import { PlanBoardHeader } from './PlanBoardHeader';
import { planPalette } from './plan-palette';

// docs/specs/026-plan/plan-board.md "On a phone": the header has no widgets, so the title takes the room there is
// rather than keeping to the 40% it leaves the widgets beside it ("Workstreams" read "Workstrea…" on a phone).
afterEach(cleanup);

const header = (opts: { showWidgets: boolean; canEdit: boolean; widgets: [] | ['progress'] }) => {
  const setup = { ...presetSetup('kanban'), title: 'Workstreams', widgets: opts.widgets };
  render(
    <PlanBoardHeader
      setup={setup}
      projection={projectBoard(setup, new Map(), undefined, ITEM_TYPES)}
      items={[]}
      types={ITEM_TYPES}
      palette={planPalette('light', {})}
      quick={{}}
      onQuick={vi.fn()}
      canFilterMine={null}
      canEdit={opts.canEdit}
      showWidgets={opts.showWidgets}
      loadFailed={false}
      onWidgets={vi.fn()}
      onSetup={vi.fn()}
      onOpenItem={vi.fn()}
      onRetry={vi.fn()}
      onReveal={vi.fn()}
      onMoveUnplaced={vi.fn()}
    />,
  );
  return screen.getByText('Workstreams').className;
};

describe('a board title’s room in its header', () => {
  it('keeps to 40% beside the widgets', () => {
    expect(header({ showWidgets: true, canEdit: true, widgets: ['progress'] })).toContain(
      'max-w-[40%]',
    );
  });

  it('keeps to 40% beside an editor’s empty zone, which offers to add a widget', () => {
    expect(header({ showWidgets: true, canEdit: true, widgets: [] })).toContain('max-w-[40%]');
  });

  it('takes the room on a phone, whose header has no widgets', () => {
    expect(header({ showWidgets: false, canEdit: true, widgets: ['progress'] })).not.toContain(
      'max-w-[40%]',
    );
  });

  it('takes the room when there is no widget and nobody to add one', () => {
    expect(header({ showWidgets: true, canEdit: false, widgets: [] })).not.toContain('max-w-[40%]');
  });
});
