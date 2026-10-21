import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLens, parseLens, type LensContext } from '@livediagram/explorer-lens';
import { track } from '@/lib/telemetry';
import { trackLensChange } from './lens-telemetry';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const context: LensContext = { view: 'aggregate', teams: [] };
const lensOf = (input: string) => parseLens(input, context).lens;

describe('trackLensChange', () => {
  beforeEach(() => vi.mocked(track).mockClear());

  it('counts each facet that gained a value, by its closed type', () => {
    trackLensChange(emptyLens(), lensOf('plan template:kanban made-by:ai'));
    expect(vi.mocked(track).mock.calls).toEqual([
      ['Explorer', 'Selected', 'Text'],
      ['Explorer', 'Selected', 'Template'],
      ['Explorer', 'Selected', 'MadeBy'],
    ]);
  });

  it('counts nothing when values are only taken away or words added to words', () => {
    trackLensChange(
      lensOf('plan template:kanban,retrospective'),
      lensOf('plan roadmap template:kanban'),
    );
    expect(track).not.toHaveBeenCalled();
  });
});
