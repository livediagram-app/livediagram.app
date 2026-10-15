// @vitest-environment jsdom
// docs/specs/029-sheets/sheet.md "Who may do what": a Participant writes cells' values, never their formats.
import { act, cleanup } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makeSheet, renderSheet, stubResizeObserver } from './sheet-ui-test-utils';

beforeAll(() => stubResizeObserver());
afterEach(cleanup);

async function open(canShape: boolean) {
  const h = await makeSheet({ rows: 6, cols: 3, cells: { A1: 'Hello' } });
  let acts: Parameters<Parameters<typeof renderSheet>[1]>[0]['actions'] | null = null;
  renderSheet(
    h,
    ({ actions }) => {
      acts = actions;
      return null;
    },
    { canShape },
  );
  act(() => h.select('A1'));
  return { h, actions: () => acts! };
}

describe('formats on a Sheet', () => {
  it("are refused from a Participant, who is told they are an editor's", async () => {
    const { h, actions } = await open(false);
    act(() => actions().toggle('b'));
    expect(h.cell('A1')?.format?.b).toBeUndefined();
    expect(h.toast).toHaveBeenCalledWith("Only an editor can format a Sheet's cells.");
    expect(h.cell('A1')?.input).toBeDefined();
  });

  it('land from an Editor', async () => {
    const { h, actions } = await open(true);
    act(() => actions().toggle('b'));
    expect(h.cell('A1')?.format?.b).toBe(true);
  });
});
