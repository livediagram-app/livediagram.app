// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADJUSTMENTS, histogramOf } from '@livedesign/photo-engine';
import { takeNeutral } from '@/lib/photo-editor/neutral-pick';
import { solid } from '@/lib/photo-editor/photo-test-utils';
import { AdjustmentEditor } from './AdjustmentEditor';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/031-photo/photo-adjustments.md "The adjustments": Levels' Auto and histogram, White Balance's
// picker.
afterEach(cleanup);

describe('the adjustment settings', () => {
  it('give Levels an Auto from the histogram, drawn under the settings', () => {
    const onChange = vi.fn();
    const r = solid(4, 1, [100, 100, 100, 255]);
    r.data.set([180, 180, 180, 255], 4);
    render(
      <AdjustmentEditor
        id="levels"
        params={structuredClone(ADJUSTMENTS.levels.defaults)}
        onChange={onChange}
        histogram={histogramOf(r, 1)}
      />,
    );
    expect(screen.getByRole('img', { name: 'Histogram' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
    expect(onChange.mock.calls[0]![0]).toMatchObject({ red: { inBlack: 100, inWhite: 180 } });
  });

  it('offer no Auto before the histogram is in', () => {
    render(
      <AdjustmentEditor
        id="curves"
        params={structuredClone(ADJUSTMENTS.curves.defaults)}
        onChange={() => {}}
        histogram={null}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Auto' })).toBeNull();
  });

  it('pick White Balance’s neutral from the next press on the photo, or let it go with Escape', () => {
    const onChange = vi.fn<(p: Record<string, unknown>) => void>();
    render(
      <AdjustmentEditor
        id="white-balance"
        params={structuredClone(ADJUSTMENTS['white-balance'].defaults)}
        onChange={onChange}
        canPickNeutral
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pick Neutral' }));
    expect(screen.getByRole('button', { name: 'Press Something Grey' })).toBeTruthy();
    act(() => {
      takeNeutral([200, 180, 150]);
    });
    expect(onChange.mock.calls[0]![0].temperature).toBeLessThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Pick Neutral' }));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.getByRole('button', { name: 'Pick Neutral' })).toBeTruthy();
  });
});
