// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { OverviewStyle } from '@liveplanner/api-schema';
import {
  NO_PROJECT_DETAILS,
  withDetailsChange,
  type ProjectDetails,
} from '@/app/project/[id]/editor-persistence';
import type { ItemUndoStep } from '@/hooks/plan/item-undo-journal';
import { withTabTextSize } from '@/lib/tab-style-transforms';
import { OVERVIEW_STYLE_SAVE_MS } from './overview-style';
import { useOverviewEdits } from './useOverviewEdits';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/026-plan/plan-overview.md "Editing in place" (Undo) and "Style": every Overview write is one step in the
// editor's undo timeline, and a run of style picks saves once.
let steps: ItemUndoStep[];
let errors: string[];
let saveDescription: Mock<(scope: unknown, description: string) => Promise<string>>;
let saveStyle: Mock<(scope: unknown, style: OverviewStyle | null) => Promise<OverviewStyle | null>>;

function setup(initial: Partial<ProjectDetails> = {}) {
  return renderHook(() => {
    const [name, setName] = useState('Plan');
    const [details, setDetails] = useState<ProjectDetails>({ ...NO_PROJECT_DETAILS, ...initial });
    const edits = useOverviewEdits({
      projectId: 'p1',
      ownerId: 'me',
      shareCode: null,
      projectName: name,
      nameProject: setName,
      details,
      setProjectDetails: setDetails,
      look: details.overviewStyle ?? { theme: 'brand' },
      pushUndo: (step) => steps.push(step),
      toastError: (m) => errors.push(m),
      save: { description: saveDescription, style: saveStyle },
    });
    return { edits, name, details };
  });
}

beforeEach(() => {
  steps = [];
  errors = [];
  saveDescription = vi.fn(async (_s: unknown, d: string) => d);
  saveStyle = vi.fn(async (_s: unknown, st: OverviewStyle | null) => st);
});
afterEach(() => vi.useRealTimers());

describe('undo of the Overview’s name', () => {
  it('is one step that names the plan back, and forward again', () => {
    const { result } = setup();
    act(() => result.current.edits.rename('  Launch  '));
    expect(result.current.name).toBe('Launch');
    expect(steps).toHaveLength(1);
    act(() => steps[0]!.undo());
    expect(result.current.name).toBe('Plan');
    act(() => steps[0]!.redo());
    expect(result.current.name).toBe('Launch');
  });

  it('records nothing for an unchanged or empty name', () => {
    const { result } = setup();
    act(() => result.current.edits.rename('Plan'));
    act(() => result.current.edits.rename('   '));
    expect(steps).toHaveLength(0);
  });
});

describe('undo of the Overview’s description', () => {
  it('is one step whose undo saves the earlier description, and redo the later', async () => {
    const { result } = setup({ description: 'Old' });
    await act(async () => result.current.edits.describe('New'));
    expect(result.current.details.description).toBe('New');
    await act(async () => steps[0]!.undo());
    expect(result.current.details.description).toBe('Old');
    expect(saveDescription).toHaveBeenLastCalledWith(expect.anything(), 'Old');
    await act(async () => steps[0]!.redo());
    expect(saveDescription).toHaveBeenLastCalledWith(expect.anything(), 'New');
    expect(result.current.details.description).toBe('New');
  });

  it('toasts an undo that cannot be saved and keeps the description', async () => {
    const { result } = setup({ description: 'Old' });
    await act(async () => result.current.edits.describe('New'));
    saveDescription.mockRejectedValueOnce(new Error('offline'));
    await act(async () => steps[0]!.undo());
    expect(result.current.details.description).toBe('New');
    expect(errors).toEqual(['Couldn’t save the description']);
  });
});

describe('the Overview’s style', () => {
  it('shows each pick at once, saves a run once, and undoes the run in one step', async () => {
    vi.useFakeTimers();
    const { result } = setup();
    act(() => result.current.edits.restyle((t) => withTabTextSize(t, 'sm')));
    act(() => result.current.edits.restyle((t) => withTabTextSize(t, 'lg')));
    expect(result.current.details.overviewStyle).toEqual({ theme: 'brand', defaultTextSize: 'lg' });
    expect(saveStyle).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(OVERVIEW_STYLE_SAVE_MS));
    expect(saveStyle).toHaveBeenCalledTimes(1);
    expect(steps).toHaveLength(1);
    // Undo goes back to none of its own (the first tab's), as before the run.
    await act(async () => steps[0]!.undo());
    expect(result.current.details.overviewStyle).toBeNull();
    expect(saveStyle).toHaveBeenLastCalledWith(expect.anything(), null);
  });

  it('puts back the saved style and toasts when a save is refused', async () => {
    vi.useFakeTimers();
    saveStyle.mockRejectedValueOnce(new Error('403'));
    const { result } = setup();
    act(() => result.current.edits.restyle((t) => withTabTextSize(t, 'sm')));
    await act(async () => vi.advanceTimersByTime(OVERVIEW_STYLE_SAVE_MS));
    expect(result.current.details.overviewStyle).toBeNull();
    expect(errors).toEqual(['Couldn’t save the Overview’s style']);
  });

  it('saves a run still waiting when the Overview closes', async () => {
    vi.useFakeTimers();
    const { result, unmount } = setup();
    act(() => result.current.edits.restyle((t) => withTabTextSize(t, 'sm')));
    unmount();
    expect(saveStyle).toHaveBeenCalledTimes(1);
  });
});

describe('a details change heard from the room', () => {
  it('changes only what it carries, and keeps the same details for an echo', () => {
    const d: ProjectDetails = {
      ...NO_PROJECT_DETAILS,
      description: 'A',
      overviewStyle: { theme: 'brand' },
    };
    expect(withDetailsChange(d, { overviewStyle: { theme: 'brand' } })).toBe(d);
    expect(withDetailsChange(d, { description: 'B' })).toEqual({ ...d, description: 'B' });
    expect(withDetailsChange(d, { overviewStyle: null }).overviewStyle).toBeNull();
  });
});
