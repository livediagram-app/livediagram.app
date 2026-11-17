import { describe, expect, it } from 'vitest';
import { IndexError, kitById, KITS, type KitRun } from '@liveworkspace/index-client';
import { KIT_TELEMETRY_TYPES } from '@liveworkspace/telemetry';
import {
  connectionsLine,
  KIT_TELEMETRY,
  createLabels,
  fallbackLines,
  refusalWords,
  roleLine,
  runOutcome,
} from './kit-words';

// Start a Project's words (liveworkspace/docs/specs/010-site/site.md "Start a Project").
const software = kitById('software-project');
const website = kitById('website-build');

const run = (made: (string | null)[], connections = { made: 0, failed: 0 }): KitRun => ({
  folderId: 'f1',
  parts: software.parts.map((p, i) => ({ slot: p.slot, app: p.app, itemId: made[i] ?? null })),
  connections,
  complete: made.every(Boolean) && connections.failed === 0,
});

describe('the setup’s words', () => {
  it('says what every role lets the others do', () => {
    expect(roleLine('edit')).toBe('Anyone who can open one of these files can edit the others.');
    expect(roleLine('participate')).toBe(
      'Anyone who can open one of these files can take part in the others.',
    );
    expect(roleLine('view')).toBe('Anyone who can open one of these files can view the others.');
  });

  it('says what a part whose app lacks the role gets instead', () => {
    expect(fallbackLines(software, 'edit')).toEqual([]);
    expect(fallbackLines(software, 'view')).toEqual([
      'livehuddle has no Viewer role, so Team Space opens to Participants.',
    ]);
    expect(fallbackLines(website, 'view')).toEqual([]);
  });

  it('names how many files on a phone', () => {
    expect(createLabels(software)).toEqual({ wide: 'Create Project', narrow: 'Create 4 Files' });
    expect(createLabels(website).narrow).toBe('Create 3 Files');
  });
});

describe('the run’s words', () => {
  it('tells ready, partly made and nothing made apart', () => {
    expect(runOutcome(run(['a', 'b', 'c', 'd'], { made: 12, failed: 0 }))).toBe('ready');
    expect(runOutcome(run(['a', null, 'c', 'd'], { made: 6, failed: 0 }))).toBe('partial');
    expect(runOutcome(run([null, null, null, null]))).toBe('none');
  });

  it('counts the connections, or says how many failed', () => {
    expect(connectionsLine(software, 'edit', null)).toEqual({
      text: 'Connecting 4 files…',
      failed: false,
    });
    expect(
      connectionsLine(software, 'view', run(['a', 'b', 'c', 'd'], { made: 3, failed: 0 })),
    ).toEqual({ text: '12 connections, Viewer', failed: false });
    expect(
      connectionsLine(software, 'edit', run(['a', 'b', 'c', 'd'], { made: 9, failed: 3 })),
    ).toEqual({ text: '9 of 12 connections made', failed: true });
    expect(connectionsLine(software, 'edit', run(['a', null, null, null]))).toEqual({
      text: 'Nothing to connect yet',
      failed: true,
    });
    expect(
      connectionsLine(website, 'edit', {
        ...run([]),
        parts: [
          { slot: 'board', app: 'liveplanner', itemId: 'a' },
          { slot: 'brief', app: 'livedocuments', itemId: 'b' },
        ],
        connections: { made: 2, failed: 0 },
      }).text,
    ).toBe('2 connections, Editor');
  });

  it('says why a request was refused', () => {
    expect(refusalWords(new IndexError(403, 'sign_in_required'), 'create')).toBe(
      'Sign in to create a project.',
    );
    expect(refusalWords(new IndexError(404, 'folder_not_found'), 'create')).toBe(
      'That project’s folder is gone. Start a new one.',
    );
    expect(refusalWords(new TypeError('fetch'), 'remove')).toBe(
      'Couldn’t reach liveworkspace. Check your connection and try again.',
    );
    expect(refusalWords(new IndexError(500, 'internal_error'), 'create')).toBe(
      'Couldn’t create your project. Try again in a moment.',
    );
    expect(refusalWords(new IndexError(500, 'internal_error'), 'remove')).toBe(
      'Couldn’t delete those files. Try again in a moment.',
    );
  });
});

describe('the kits’ telemetry tokens', () => {
  it('gives every kit its own token from the service’s closed list', () => {
    const tokens = KITS.map((kit) => KIT_TELEMETRY[kit.id]);
    expect(new Set(tokens).size).toBe(KITS.length);
    expect([...tokens].sort()).toEqual([...KIT_TELEMETRY_TYPES].sort());
  });
});
