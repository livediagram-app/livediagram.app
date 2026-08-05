import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackMock = vi.fn();
vi.mock('./telemetry', () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

const { reportHelpSearch, resetHelpSearchReports } = await import('./search-telemetry');

describe('reportHelpSearch', () => {
  beforeEach(() => {
    trackMock.mockClear();
    resetHelpSearchReports();
  });

  it('reports a hit as Results', () => {
    reportHelpSearch('opacity', 3);
    expect(trackMock).toHaveBeenCalledExactlyOnceWith('Help', 'Searched', 'Results');
  });

  // The point of the whole event: a query nobody has an article for.
  it('reports a miss as NoResults', () => {
    reportHelpSearch('quantum tunnelling', 0);
    expect(trackMock).toHaveBeenCalledExactlyOnceWith('Help', 'Searched', 'NoResults');
  });

  // spec/22 forbids user-generated content on the wire. The query decides
  // WHICH token is sent and never appears in the payload itself.
  it('never puts the query on the wire', () => {
    reportHelpSearch('my secret project name', 0);
    const args = trackMock.mock.calls[0];
    expect(args).toEqual(['Help', 'Searched', 'NoResults']);
  });

  it('reports one query once, however it is retyped', () => {
    reportHelpSearch('layers', 2);
    reportHelpSearch('Layers', 2);
    reportHelpSearch('  layers  ', 2);
    expect(trackMock).toHaveBeenCalledTimes(1);
  });

  it('reports a different query separately', () => {
    reportHelpSearch('layers', 2);
    reportHelpSearch('themes', 1);
    expect(trackMock).toHaveBeenCalledTimes(2);
  });

  it('ignores an empty query', () => {
    reportHelpSearch('   ', 0);
    expect(trackMock).not.toHaveBeenCalled();
  });
});
