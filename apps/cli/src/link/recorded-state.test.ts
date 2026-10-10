import { describe, expect, it } from 'vitest';
import type { OverviewView } from '@livediagram/api-schema';
import type { RemoteFact } from './remote';
import { recordedStateOf, type RecordedDocument } from './recorded-state';

// States without mirror files (docs/specs/027-repositories/blueprints/repository-link.md "States without mirror
// files"): from what the local sync state recorded at the document's last sync here. One row per state.

const facts = (id: string, rev: number) => ({
  view: 'overview' as const,
  outOfScope: false as const,
  tab: { id, ref: id, name: id, kind: 'diagram' as const },
  elements: 0,
  counts: { boxes: 0, frames: 0, lanes: 0, arrows: 0 },
  hidden: 0,
  unknown: 0,
  threads: { open: 0, total: 0 },
  rev,
});

const readable = (name: string, revs: [string, number][]): RemoteFact => {
  const overview: OverviewView = {
    document: { id: 'd1', name, savedAt: 0, tabs: revs.length },
    tabs: revs.map(([id, rev]) => facts(id, rev)),
    elision: null,
  };
  return { kind: 'readable', overview, envelope: null };
};

const recorded: RecordedDocument = {
  name: 'Home',
  tabs: { t1: { rev: 3, syncedAt: 1 }, t2: { rev: 1, syncedAt: 1 } },
};

describe('recordedStateOf', () => {
  it('decides every state of the table', () => {
    const now = readable('Home', [
      ['t1', 3],
      ['t2', 1],
    ]);
    const rows: [RemoteFact, boolean | null, RecordedDocument | undefined, string][] = [
      [now, true, undefined, 'new'],
      [now, true, recorded, 'in-step'],
      [now, null, recorded, 'in-step'],
      [
        readable('Home', [
          ['t1', 4],
          ['t2', 1],
        ]),
        true,
        recorded,
        'behind',
      ],
      [readable('Home', [['t1', 3]]), true, recorded, 'behind'],
      [
        readable('Home', [
          ['t1', 3],
          ['t3', 1],
        ]),
        true,
        recorded,
        'behind',
      ],
      [
        readable('Renamed', [
          ['t1', 3],
          ['t2', 1],
        ]),
        true,
        recorded,
        'behind',
      ],
      [now, false, recorded, 'gone'],
      [{ kind: 'trashed' }, true, recorded, 'gone'],
      [{ kind: 'unreadable' }, true, recorded, 'unreadable'],
      [{ kind: 'transient', failure: 'x', exit: 6, reason: '429' }, true, recorded, 'transient'],
    ];
    for (const [remote, covered, record, state] of rows)
      expect(recordedStateOf({ remote, covered, recorded: record }), state).toBe(state);
  });
});
