// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dashboardFromPreset,
  setDashboardContent,
  type DashboardLayout,
} from '@livediagram/document';
import type { PlanTabActions } from '@/hooks/plan/usePlanTabActions';
import { track } from '@/lib/telemetry';
import { DashboardSettings } from './DashboardSettings';
import { maximisePlanElement, releasePlanElement } from '@/hooks/plan/maximised-plan';

// docs/specs/026-plan/plan-tabs.md "Dashboard Settings".
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(cleanup);

let n = 0;
const id = () => `id${n++}`;

function show(layout: DashboardLayout, canEdit = true) {
  let current = layout;
  const changeDashboard = vi.fn(
    (change: (l: DashboardLayout) => DashboardLayout, _kind: string, _opts?: unknown) => {
      current = change(current);
    },
  );
  const onRename = vi.fn();
  const canvas = document.createElement('div');
  document.body.appendChild(canvas);
  render(
    <DashboardSettings
      canvas={canvas}
      canEdit={canEdit}
      name="Overview"
      layout={layout}
      actions={{ changeDashboard } as unknown as PlanTabActions}
      onRename={onRename}
    />,
  );
  return { changeDashboard, onRename, now: () => current };
}
const openCog = () => fireEvent.click(screen.getByRole('button', { name: 'Dashboard Settings' }));
const openSection = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('Dashboard Settings', () => {
  it('gives an Editor the cog, and a Participant or Viewer none', () => {
    show(dashboardFromPreset('two-by-two', id), false);
    expect(screen.queryByRole('button', { name: 'Dashboard Settings' })).toBeNull();
    cleanup();
    show(dashboardFromPreset('two-by-two', id));
    openCog();
    expect(track).toHaveBeenCalledWith('Plan', 'Opened', 'DashboardSettings');
  });

  // A board maximised from a slot puts its own cog in this corner: the dashboard's steps aside until it is restored.
  it('steps aside while a slot’s board is maximised over the page', () => {
    show(dashboardFromPreset('two-by-two', id));
    expect(screen.getByRole('button', { name: 'Dashboard Settings' })).toBeTruthy();
    act(() => maximisePlanElement('board-1'));
    expect(screen.queryByRole('button', { name: 'Dashboard Settings' })).toBeNull();
    act(() => releasePlanElement('board-1'));
    expect(screen.getByRole('button', { name: 'Dashboard Settings' })).toBeTruthy();
  });

  it('renames the tab from Name, trimmed, on Enter', () => {
    const { onRename } = show(dashboardFromPreset('two-by-two', id));
    openCog();
    const field = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(field, { target: { value: '  Q4 Review ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('Q4 Review');
  });

  it('follows a rename made elsewhere while untouched, so leaving it renames nothing back', () => {
    const onRename = vi.fn();
    const canvas = document.createElement('div');
    document.body.appendChild(canvas);
    const layout = dashboardFromPreset('two-by-two', id);
    const props = {
      canvas,
      canEdit: true,
      layout,
      actions: { changeDashboard: vi.fn() } as unknown as PlanTabActions,
      onRename,
    };
    const { rerender } = render(<DashboardSettings {...props} name="Overview" />);
    openCog();
    rerender(<DashboardSettings {...props} name="Q4 Review" />);
    const field = screen.getByRole('textbox', { name: 'Name' });
    expect((field as HTMLInputElement).value).toBe('Q4 Review');
    fireEvent.blur(field);
    expect(onRename).not.toHaveBeenCalled();
  });

  it('tints the page behind the slots, as a look change', () => {
    const s = show(dashboardFromPreset('two-by-two', id));
    openCog();
    openSection('Background');
    fireEvent.click(screen.getByRole('radio', { name: /Tinted/ }));
    expect(s.changeDashboard.mock.calls[0]![1]).toBe('DashboardLook');
    expect(s.now().background).toBe('tint');
  });

  it('adds a row, and starts over from a layout at once while every slot is empty', () => {
    const s = show(dashboardFromPreset('two-by-two', id));
    openCog();
    fireEvent.click(screen.getByRole('button', { name: 'Add Row' }));
    expect(s.now().rows).toHaveLength(3);
    // Add Row closes the cog so the page can scroll to the new row (reveal-new-row.ts).
    expect(screen.queryByRole('button', { name: 'Add Row' })).toBeNull();
    openCog();
    openSection('Layouts');
    fireEvent.click(screen.getByRole('button', { name: /^Focus/ }));
    expect(s.now().rows.map((r) => r.slots.map((x) => x.span))).toEqual([[8, 4]]);
    expect(s.changeDashboard.mock.calls[1]![2]).toEqual({ prune: true });
  });

  it('asks before starting over or clearing a dashboard that holds something', () => {
    const base = dashboardFromPreset('two-by-two', id);
    const held = setDashboardContent(base, base.rows[0]!.slots[0]!.id, {
      type: 'note',
      title: 'N',
      text: '',
    });
    const s = show(held);
    openCog();
    openSection('Layouts');
    fireEvent.click(screen.getByRole('button', { name: /^Focus/ }));
    expect(screen.getByText(/Start over as Focus\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    openSection('Dashboard Setup');
    fireEvent.click(screen.getByRole('button', { name: 'Clear Dashboard' }));
    expect(s.changeDashboard).not.toHaveBeenCalled();
    act(() => {
      // The confirmation's own button.
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    });
    expect(s.changeDashboard.mock.calls[0]![1]).toBe('DashboardContent');
    expect(
      s
        .now()
        .rows.flatMap((r) => r.slots)
        .some((x) => x.content),
    ).toBe(false);
  });
});
