import { describe, expect, it } from 'vitest';
import { bySection } from './section-order';

type Row = { key: string; section?: string; closesSection?: boolean };
const keys = (rows: readonly Row[]) => rows.map((row) => row.key);

describe('bySection', () => {
  it('shows each section once, where its first row came', () => {
    const rows: Row[] = [
      { key: 'a', section: 'One' },
      { key: 'b', section: 'Two' },
      { key: 'c', section: 'One' },
    ];
    expect(keys(bySection(rows))).toEqual(['a', 'c', 'b']);
  });

  it('puts the listed sections in SECTION_ORDER, whichever source brought one first', () => {
    // Common brings Pages (Contents) before livediagram's Draw and livedesign's Logo Pages.
    const rows: Row[] = [
      { key: 'guides', section: 'Canvas' },
      { key: 'pan', section: 'Mouse' },
      { key: 'contents', section: 'Pages' },
      { key: 'dock', section: 'Draw' },
      { key: 'logo', section: 'Logo Pages' },
    ];
    expect(keys(bySection(rows))).toEqual(['guides', 'pan', 'dock', 'contents', 'logo']);
  });

  it('keeps an unlisted section in its place, and leads with the rows with none', () => {
    // Common brings the panels' sections before an editor's own Panel Opacity.
    const rows: Row[] = [
      { key: 'map', section: 'Map' },
      { key: 'own', section: 'Something Else' },
      { key: 'layers', section: 'Layers' },
      { key: 'opacity' },
    ];
    expect(keys(bySection(rows))).toEqual(['opacity', 'layers', 'own', 'map']);
  });

  it('keeps a closing row after the rows the apps add', () => {
    const rows: Row[] = [
      { key: 'comments', section: 'Email' },
      { key: 'tips', section: 'Email', closesSection: true },
      { key: 'milestones', section: 'Email', closesSection: true },
      { key: 'joins', section: 'Email' },
    ];
    expect(keys(bySection(rows))).toEqual(['comments', 'joins', 'tips', 'milestones']);
  });

  it('leaves rows with one section, or none, as they came', () => {
    const rows: Row[] = [{ key: 'b' }, { key: 'a' }];
    expect(keys(bySection(rows))).toEqual(['b', 'a']);
  });
});
