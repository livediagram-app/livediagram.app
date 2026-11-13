import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TEMPLATES } from './templates';

// docs/specs/009-elements/avatar-pad.md "Where a Space's pad stands": the arrival table names where everyone arrives in
// every Space, so a new template that lands without its row fails here (Work Tracker 738: the Games Rooms, the Homes
// and the Music Hall shipped without theirs).
const SPEC = fileURLToPath(
  new URL('../../../docs/specs/009-elements/avatar-pad.md', import.meta.url),
);

/** The first cell of each row of the arrival table, read line by line (no regex over the whole file). */
function arrivalRows(markdown: string): string[] {
  const lines = markdown.split('\n');
  const head = lines.findIndex(
    (line) => line.startsWith('| Space ') && line.includes('Where everyone arrives'),
  );
  const rows: string[] = [];
  for (let i = head + 2; head >= 0 && i < lines.length && lines[i].startsWith('|'); i++) {
    rows.push(lines[i].split('|')[1].trim());
  }
  return rows;
}

describe('the avatar-pad.md arrival table', () => {
  const rows = arrivalRows(readFileSync(SPEC, 'utf8'));

  it('has a row for every Space in the catalogue, and none for a Space it lacks', () => {
    const spaces = TEMPLATES.filter((t) => t.kind !== 'blank-session').map((t) => t.title);
    expect([...rows].sort()).toEqual([...spaces].sort());
  });

  it('includes the Games Rooms, the Homes and the Music Hall', () => {
    for (const title of [
      'Arcade Lounge',
      'Games Night Den',
      'Sports Bar',
      'Family House',
      'City Townhouse',
      'Country Cottage',
      'Music Hall',
    ]) {
      expect(rows).toContain(title);
    }
  });
});
