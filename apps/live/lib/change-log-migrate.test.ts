import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChangeLogEntry } from '@livediagram/api-schema';
import { migrateChangeLogEntry } from './change-log-migrate';

// docs/specs/006-document/stroke-points.md "Migration of stored strokes": a change-log entry
// written before packed points still holds `{ nx, ny }` strokes, and Revert applies them.

const legacyStroke = {
  id: 'f1',
  type: 'freehand',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  closed: false,
  points: [
    { nx: 0, ny: 0 },
    { nx: 1, ny: 1 },
  ],
};

const entry = (over: Partial<ChangeLogEntry> = {}): ChangeLogEntry => ({
  id: 'e1',
  tabId: 't1',
  participantId: 'p',
  participantName: 'P',
  participantColor: '#000',
  kind: 'edit',
  summary: 'Moved 1 element',
  elementIds: ['f1'],
  beforeState: { f1: legacyStroke },
  afterState: { f1: null },
  createdAt: 1,
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('migrateChangeLogEntry', () => {
  it('packs former-shape strokes on both sides of an entry', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const out = migrateChangeLogEntry(entry({ afterState: { f1: { ...legacyStroke, x: 5 } } }));
    for (const side of [out.beforeState, out.afterState]) {
      const el = side.f1 as Record<string, unknown>;
      expect(typeof el.packedPoints).toBe('string');
      expect(el).not.toHaveProperty('points');
    }
  });

  it('keeps nulls and returns the same entry when nothing is legacy', () => {
    const current = entry({
      beforeState: { s: { id: 's', type: 'text' } },
      afterState: { s: null },
    });
    expect(migrateChangeLogEntry(current)).toBe(current);
  });
});
