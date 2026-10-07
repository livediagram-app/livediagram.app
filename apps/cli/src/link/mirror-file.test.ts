import { describe, expect, it } from 'vitest';
import { parseDocumentEnvelope } from '@livediagram/document';
import { parsePullFile } from '../sync/pull-file';
import { hasConflictMarkers, mirrorFileText, type MirrorFile } from './mirror-file';

// The mirror file (docs/specs/027-repositories/blueprints/repository-link.md "The mirror file"): the pull file with
// no time, every key sorted, one element per line.

const mirror = (): MirrorFile => ({
  kind: 'livediagram.document',
  schemaVersion: 1,
  document: {
    id: 'doc-1',
    name: 'Home screen',
    presentation: null,
    tabs: [
      {
        rev: 17,
        name: 'Flow',
        id: 'tab-1',
        elements: [
          {
            y: 0,
            x: 0,
            width: 160,
            height: 60,
            type: 'shape',
            shape: 'square',
            label: 'Play button',
            id: 'play',
          },
          {
            type: 'arrow',
            id: 'a1',
            from: { kind: 'free', x: 0, y: 0 },
            to: { kind: 'free', x: 10, y: 0 },
          },
        ],
      } as never,
      { id: 'tab-2', name: 'Empty', elements: [], folder: 'Later' },
    ],
  },
  livediagramSync: {
    tabs: {
      'tab-1': { settingsHash: 's1', rev: 17, hash: 'h1' },
      'tab-2': { rev: 2, hash: 'h2', settingsHash: 's2' },
    },
    host: 'https://livediagram.app',
  },
});

const GOLDEN = `{
  "document": {
    "id": "doc-1",
    "name": "Home screen",
    "presentation": null,
    "tabs": [
      {
        "elements": [
          {"height":60,"id":"play","label":"Play button","shape":"square","type":"shape","width":160,"x":0,"y":0},
          {"from":{"kind":"free","x":0,"y":0},"id":"a1","to":{"kind":"free","x":10,"y":0},"type":"arrow"}
        ],
        "id": "tab-1",
        "name": "Flow",
        "rev": 17
      },
      {
        "elements": [],
        "folder": "Later",
        "id": "tab-2",
        "name": "Empty"
      }
    ]
  },
  "kind": "livediagram.document",
  "livediagramSync": {
    "host": "https://livediagram.app",
    "tabs": {
      "tab-1": {
        "hash": "h1",
        "rev": 17,
        "settingsHash": "s1"
      },
      "tab-2": {
        "hash": "h2",
        "rev": 2,
        "settingsHash": "s2"
      }
    }
  },
  "schemaVersion": 1
}
`;

describe('mirrorFileText', () => {
  it('writes every key sorted, one element a line, no time, byte for byte', () => {
    expect(mirrorFileText(mirror())).toBe(GOLDEN);
    expect(mirrorFileText(mirror())).toBe(mirrorFileText(mirror()));
    expect(mirrorFileText(mirror())).not.toMatch(/pulledAt|exportedAt/);
  });

  it('is read by the editor’s import and by the CLI as a pull file', () => {
    const envelope = parseDocumentEnvelope(GOLDEN);
    expect(envelope).toMatchObject({ ok: true, envelope: { exportedAt: 0 } });
    const pulled = parsePullFile(GOLDEN);
    expect(pulled).toMatchObject({
      ok: true,
      file: { livediagramSync: { tabs: { 'tab-1': { rev: 17 } } } },
    });
    expect(pulled.ok && 'pulledAt' in pulled.file.livediagramSync).toBe(false);
  });
});

describe('hasConflictMarkers', () => {
  it('finds git’s markers on a line of their own, and nothing else', () => {
    expect(hasConflictMarkers('{\n<<<<<<< HEAD\n"a"\n=======\n"b"\n>>>>>>> main\n}')).toBe(true);
    expect(hasConflictMarkers('a\n=======\r\nb')).toBe(true);
    expect(hasConflictMarkers('>>>>>>> theirs')).toBe(true);
    expect(hasConflictMarkers('{"label":"<<<<<<< not a marker"}')).toBe(false);
    expect(hasConflictMarkers('========\n<<<<<<<\n')).toBe(false);
  });
});

describe('a document with no tabs (E24)', () => {
  it('writes empty tabs and an empty record', () => {
    const empty: MirrorFile = {
      ...mirror(),
      document: { id: 'd', name: 'Empty', presentation: null, tabs: [] },
      livediagramSync: { host: 'https://livediagram.app', tabs: {} },
    };
    expect(mirrorFileText(empty)).toContain('"tabs": []');
    expect(mirrorFileText(empty)).toContain('"tabs": {}');
  });
});
