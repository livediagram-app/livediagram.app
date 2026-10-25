// An item's tabs alone: the route it answers, what a reader may see of them, and the answer's shape.
import { describe, expect, it } from 'vitest';
import { itemTabsOf, itemTabsRequest, itemTabsResponse } from './tabs';

const rows = [
  { id: 't1', name: 'Board', kind: 'board' },
  { id: 't2', name: 'Budget', kind: 'sheet' },
  { id: 't3', name: null, kind: undefined },
  { id: 't4', name: 'Old', kind: 7 },
];

describe('an item’s tabs', () => {
  it('answers GET /api/<items>/:id/tabs and nothing else', () => {
    expect(itemTabsRequest('GET', ['api', 'projects', 'p1', 'tabs'], 'projects')).toBe('p1');
    expect(itemTabsRequest('POST', ['api', 'projects', 'p1', 'tabs'], 'projects')).toBeNull();
    expect(itemTabsRequest('GET', ['api', 'projects', 'p1', 'tabs', 't1'], 'projects')).toBeNull();
    expect(itemTabsRequest('GET', ['api', 'documents', 'p1', 'tabs'], 'projects')).toBeNull();
    expect(itemTabsRequest('GET', ['api', 'projects', '', 'tabs'], 'projects')).toBeNull();
  });

  it('names every tab in order, or for a one-tab grant that tab alone', () => {
    expect(itemTabsOf(rows)).toEqual([
      { id: 't1', name: 'Board', kind: 'board' },
      { id: 't2', name: 'Budget', kind: 'sheet' },
      { id: 't3', name: '', kind: null },
      { id: 't4', name: 'Old', kind: null },
    ]);
    expect(itemTabsOf(rows, 't2')).toEqual([{ id: 't2', name: 'Budget', kind: 'sheet' }]);
    expect(itemTabsOf(rows, 'gone')).toEqual([]);
  });

  it('answers { tabs } as private JSON that is never kept, with the app’s headers', async () => {
    const res = itemTabsResponse(itemTabsOf(rows.slice(0, 1)), {
      'Access-Control-Allow-Origin': '*',
    });
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await res.json()).toEqual({ tabs: [{ id: 't1', name: 'Board', kind: 'board' }] });
  });
});
