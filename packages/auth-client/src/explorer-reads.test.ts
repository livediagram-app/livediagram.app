import { describe, expect, it } from 'vitest';

import { appApiResources, audiencesFor, isExplorerRead } from './explorer-reads';

const get = (path: string, method = 'GET') =>
  new Request(`https://www.livediagram.app${path}`, { method });

describe('appApiResources', () => {
  it('gives every app’s production API for a production resource', () => {
    expect(appApiResources('https://livediagram.app/api')).toEqual([
      'https://livediagram.app/api',
      'https://liveplanner.app/api',
      'https://livedocuments.app/api',
      'https://livedesign.app/api',
    ]);
  });

  it('stays in staging for a staging resource', () => {
    expect(appApiResources('https://staging.liveplanner.app/api')).toEqual([
      'https://staging.livediagram.app/api',
      'https://staging.liveplanner.app/api',
      'https://staging.livedocuments.app/api',
      'https://staging.livedesign.app/api',
    ]);
  });

  it('keeps any other resource alone: local development’s, or a stranger’s', () => {
    expect(appApiResources('http://localhost/api')).toEqual(['http://localhost/api']);
    expect(appApiResources('https://evil.example/api')).toEqual(['https://evil.example/api']);
    expect(appApiResources('https://www.livediagram.app.evil.example/api')).toEqual([
      'https://www.livediagram.app.evil.example/api',
    ]);
    expect(appApiResources('not a url')).toEqual(['not a url']);
  });
});

describe('isExplorerRead', () => {
  it('is an item’s preview or tabs, read', () => {
    expect(isExplorerRead(get('/api/documents/abc/thumbnail'), 'documents')).toBe(true);
    expect(isExplorerRead(get('/api/documents/abc/tabs?x=1'), 'documents')).toBe(true);
  });

  it('is nothing else: another method, another route, another app’s segment, the item itself', () => {
    expect(isExplorerRead(get('/api/documents/abc/thumbnail', 'PUT'), 'documents')).toBe(false);
    expect(isExplorerRead(get('/api/documents/abc'), 'documents')).toBe(false);
    expect(isExplorerRead(get('/api/documents/abc/comments'), 'documents')).toBe(false);
    expect(isExplorerRead(get('/api/documents//tabs'), 'documents')).toBe(false);
    expect(isExplorerRead(get('/api/projects/abc/tabs'), 'documents')).toBe(false);
    expect(isExplorerRead(get('/api/documents/abc/tabs/extra'), 'documents')).toBe(false);
  });
});

describe('audiencesFor', () => {
  it('widens the audience for the Explorer’s reads only', () => {
    const resource = 'https://livediagram.app/api';
    expect(audiencesFor(get('/api/documents/abc/thumbnail'), resource, 'documents')).toHaveLength(
      4,
    );
    expect(audiencesFor(get('/api/documents/abc'), resource, 'documents')).toBe(resource);
  });
});
