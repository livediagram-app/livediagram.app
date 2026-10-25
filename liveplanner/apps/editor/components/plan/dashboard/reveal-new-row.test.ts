// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Dashboard Settings": Add Row scrolls the new row into view.
import { afterEach, describe, expect, it, vi } from 'vitest';

const reduced = vi.hoisted(() => ({ on: false }));
vi.mock('@liveworkspace/workbench/lib/motion-preference', () => ({
  prefersReducedMotion: () => reduced.on,
}));

const { dashboardRowCount, revealNewRow } = await import('./reveal-new-row');

const page = (rows: number) => {
  const root = document.createElement('div');
  for (let i = 0; i < rows; i++) {
    const row = document.createElement('div');
    row.setAttribute('data-dashboard-row', `r${i}`);
    row.scrollIntoView = vi.fn();
    root.appendChild(row);
  }
  document.body.appendChild(root);
  return root;
};

afterEach(() => {
  document.body.innerHTML = '';
  reduced.on = false;
});

describe('revealing a new Dashboard row', () => {
  it('scrolls the last row into view smoothly once it has drawn', async () => {
    const root = page(2);
    revealNewRow(dashboardRowCount(root), root);
    const added = document.createElement('div');
    added.setAttribute('data-dashboard-row', 'new');
    added.scrollIntoView = vi.fn();
    root.appendChild(added);
    await vi.waitFor(() => expect(added.scrollIntoView).toHaveBeenCalled());
    expect(added.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
  });

  it('jumps without motion under reduced motion', async () => {
    reduced.on = true;
    const root = page(1);
    revealNewRow(0, root);
    const row = root.querySelector<HTMLElement>('[data-dashboard-row]')!;
    await vi.waitFor(() => expect(row.scrollIntoView).toHaveBeenCalled());
    expect(row.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'nearest' });
  });

  it('gives up quietly when no row appears', async () => {
    const root = page(1);
    const row = root.querySelector<HTMLElement>('[data-dashboard-row]')!;
    revealNewRow(1, root);
    await new Promise((r) => setTimeout(r, 700));
    expect(row.scrollIntoView).not.toHaveBeenCalled();
  });
});
