// What a connected tab's page shows for each way an open ends (connected-tabs.md "Opening", "How it looks").
import { describe, expect, it } from 'vitest';
import { IndexError } from '@liveworkspace/index-client';
import {
  connectedTabCopy,
  connectedTabViewOf,
  isBrokenState,
  type ConnectedTabState,
} from './connected-tab-view';

describe('connectedTabViewOf', () => {
  it('maps each refusal of the open door to its state', () => {
    expect(connectedTabViewOf(new IndexError(410, 'connection_target_gone'))).toEqual({
      state: 'gone',
    });
    expect(connectedTabViewOf(new IndexError(410, 'connection_link_removed'))).toEqual({
      state: 'link_removed',
    });
    expect(connectedTabViewOf(new IndexError(404, 'not_found'))).toEqual({ state: 'copy' });
  });

  it('reads anything else as a failure to try again', () => {
    expect(connectedTabViewOf(new IndexError(429, 'rate_limited'))).toEqual({ state: 'failed' });
    expect(connectedTabViewOf(new IndexError(500, 'not_found'))).toEqual({ state: 'failed' });
    expect(connectedTabViewOf(new TypeError('Failed to fetch'))).toEqual({ state: 'failed' });
  });
});

describe('isBrokenState', () => {
  it('marks only the states that need mending', () => {
    const broken: ConnectedTabState[] = ['gone', 'link_removed', 'copy'];
    const fine: ConnectedTabState[] = ['opening', 'opened', 'offline', 'failed'];
    for (const s of broken) expect(isBrokenState(s)).toBe(true);
    for (const s of fine) expect(isBrokenState(s)).toBe(false);
  });
});

describe('connectedTabCopy', () => {
  const copy = (state: ConnectedTabState, canEdit = true) =>
    connectedTabCopy(state, 'Launch plan', 'liveplanner', canEdit);

  it('says the spec words for each state', () => {
    expect(copy('ready')).toEqual({ title: 'Launch plan', line: 'A connected liveplanner file.' });
    expect(copy('opening').line).toBe('Opening Launch plan in liveplanner…');
    expect(copy('opened').line).toBe('Launch plan is open in a new tab.');
    expect(copy('gone').title).toBe('This file is no longer there.');
    expect(copy('link_removed').title).toBe('This connection’s link was removed.');
    expect(copy('copy').title).toBe('Connect this copy to Launch plan.');
    expect(copy('offline').title).toBe('Connected files open when you are online.');
    expect(copy('offline').line).toBe('Launch plan is in liveplanner.');
    expect(copy('failed').title).toBe('Launch plan could not be opened just now.');
  });

  it('tells someone who cannot mend it to ask an editor', () => {
    expect(copy('link_removed', false).line).toMatch(/Ask an editor to connect it again\.$/);
    expect(copy('copy', false).line).toMatch(/Ask an editor/);
    expect(copy('link_removed', true).line).not.toMatch(/Ask an editor/);
    expect(copy('gone', true).line).toMatch(/Remove this tab/);
    expect(copy('gone', false).line).not.toMatch(/Remove this tab/);
  });
});
