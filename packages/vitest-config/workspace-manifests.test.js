import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { workspaceManifests } from './workspace-manifests.js';

describe('workspaceManifests', () => {
  const product = () => {
    const root = mkdtempSync(path.join(tmpdir(), 'workspace-manifests-'));
    for (const [dir, name] of [
      ['apps/editor', '@x/editor'],
      ['packages/model', '@x/model'],
    ]) {
      mkdirSync(path.join(root, dir), { recursive: true });
      writeFileSync(path.join(root, dir, 'package.json'), JSON.stringify({ name }));
    }
    // A folder with no manifest is not a workspace.
    mkdirSync(path.join(root, 'packages/notes'));
    return root;
  };

  it('reads every app and package, by path or file URL', () => {
    const root = product();
    expect(workspaceManifests(root).map((m) => m.name)).toEqual(['@x/editor', '@x/model']);
    expect(workspaceManifests(pathToFileURL(root + '/')).map((m) => m.name)).toEqual([
      '@x/editor',
      '@x/model',
    ]);
  });

  it('reads nothing from a folder with no apps or packages', () => {
    expect(workspaceManifests(mkdtempSync(path.join(tmpdir(), 'workspace-empty-')))).toEqual([]);
  });
});
