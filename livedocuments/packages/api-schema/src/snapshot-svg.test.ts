import { describe, expect, it } from 'vitest';
import { scalableSnapshotSvg, svgBackgroundColor } from './snapshot-svg';

describe('svgBackgroundColor', () => {
  it('reads a snapshot background colour', () => {
    expect(svgBackgroundColor('<svg><rect x="0" fill="#fafafa"/></svg>')).toBe('#fafafa');
    expect(svgBackgroundColor('<svg></svg>')).toBeNull();
  });
});

describe('scalableSnapshotSvg', () => {
  it('drops the fixed size and keeps the viewBox', () => {
    expect(scalableSnapshotSvg('<svg viewBox="0 0 4 2" width="400" height="200"><g/></svg>')).toBe(
      '<svg viewBox="0 0 4 2"><g/></svg>',
    );
  });

  it('leaves the size of anything but the root svg alone', () => {
    const svg = '<svg width="4" height="2"><rect width="1" height="1"/></svg>';
    expect(scalableSnapshotSvg(svg)).toBe('<svg><rect width="1" height="1"/></svg>');
  });

  it('stays fast on hostile markup', () => {
    const t = performance.now();
    scalableSnapshotSvg('<svg' + ' '.repeat(100_000));
    svgBackgroundColor('<rect'.repeat(50_000));
    expect(performance.now() - t).toBeLessThan(200);
  });
});
