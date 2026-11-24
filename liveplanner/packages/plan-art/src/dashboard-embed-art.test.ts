import { describe, expect, it } from 'vitest';
import { planPalette } from '@liveplanner/project';
import { embedArt } from './dashboard-card-art';

// docs/specs/013-workspace/embeds.md "Embed File on a Dashboard": an export draws the slot's snapshot under the file's
// name, never the live file.
const r = { x: 0, y: 0, width: 400, height: 300 };
const p = planPalette('light');

describe('an Embed File’s picture', () => {
  it('says no file is chosen yet when the slot is empty', () => {
    expect(embedArt({}, r, p)).toContain('No file chosen yet');
  });

  it('draws the name over the snapshot', () => {
    const svg = embedArt({ liveName: 'Roadmap', livePoster: 'data:image/png;base64,AAAA' }, r, p);
    expect(svg).toContain('Roadmap');
    expect(svg).toContain('<image href="data:image/png;base64,AAAA"');
    expect(svg).toContain('y="24"');
  });

  it('draws the name alone when there is no snapshot', () => {
    const svg = embedArt({ liveName: 'Roadmap' }, r, p);
    expect(svg).toContain('Roadmap');
    expect(svg).not.toContain('<image');
  });

  it('escapes a poster that is not a plain data URL', () => {
    expect(embedArt({ liveName: 'x', livePoster: 'a"b' }, r, p)).not.toContain('a"b');
  });
});
