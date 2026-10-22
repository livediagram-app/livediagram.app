import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { paintedBaseline } from './optical-snap';

// The snap guard (docs/specs/004-interface-design/optical-alignment.md, "Guards"): the ink audit takes
// the baseline snap a shape inherits out of its caps readings, which is only right while the browser
// paints text baselines where `paintedBaseline` says, before any transform moves them. Flat capitals end
// exactly on the baseline, so the last inked device-pixel row shows where it was painted.

test.use({ colorScheme: 'dark', deviceScaleFactor: 4 });

const DPR = 4;
// The UI's system stack, so the face is the one the audit reads.
const FACE = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif`;
// Whole, quarter, odd sixteenth and three-quarter positions: every rounding direction.
const TOPS = [20, 20.25, 20.5625, 20.75];
const LAID_OUT_AT = 20;

// Renders flat capitals and returns their layout baseline and the bottom edge of their ink, in CSS px.
async function paint(page: Page, wrapper: string, trim: boolean) {
  await page.setContent(
    `<body style="margin:0;background:#000"><div style="position:absolute;left:8px;${wrapper}">
      <span id="glyph" style="display:inline-block;line-height:1;font:600 11px ${FACE};color:#fff;${trim ? 'text-box:trim-both cap alphabetic' : ''}">HH</span>
    </div></body>`,
  );
  // A freshly set document may not have presented a frame yet, and a capture before one fails.
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  const baseline = await page.evaluate(() => {
    const host = document.getElementById('glyph')!;
    const marker = document.createElement('span');
    marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    host.appendChild(marker);
    const y = marker.getBoundingClientRect().bottom;
    marker.remove();
    return y;
  });
  const clip = { x: 0, y: 0, width: 48, height: 48 };
  const ink = await page.screenshot({ clip });
  await page.addStyleTag({ content: '#glyph { -webkit-text-fill-color: transparent }' });
  const bare = await page.screenshot({ clip });
  const lastInkRow = await page.evaluate(
    async ([a, b]) => {
      const read = async (b64: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = new OffscreenCanvas(img.width, img.height);
        const x = c.getContext('2d')!;
        x.drawImage(img, 0, 0);
        return x.getImageData(0, 0, img.width, img.height);
      };
      const [da, db] = await Promise.all([read(a), read(b)]);
      let last = -1;
      for (let i = 0; i < da.data.length; i += 4)
        if (Math.abs(da.data[i]! - db.data[i]!) > 0) last = Math.floor(i / 4 / da.width);
      return last;
    },
    [ink.toString('base64'), bare.toString('base64')] as const,
  );
  return { baseline, painted: (lastInkRow + 1) / DPR };
}

test('the browser paints text baselines on the nearest whole CSS pixel', async ({ page }) => {
  const misses: string[] = [];
  for (const trim of [true, false])
    for (const top of TOPS) {
      const { baseline, painted } = await paint(page, `top:${top}px`, trim);
      if (painted !== paintedBaseline(baseline))
        misses.push(
          `top ${top}${trim ? ', trimmed' : ''}: laid out at ${baseline}, painted at ${painted}, expected ${paintedBaseline(baseline)}`,
        );
    }
  expect(misses).toEqual([]);
});

test('a transform moves a baseline after the snap', async ({ page }) => {
  const misses: string[] = [];
  for (const trim of [true, false])
    for (const top of TOPS) {
      const shift = top - LAID_OUT_AT;
      const { baseline, painted } = await paint(
        page,
        `top:${LAID_OUT_AT}px;translate:0 ${shift}px`,
        trim,
      );
      // Snapped where layout put it, then moved; the move itself lands on the device-pixel grid.
      const expected = paintedBaseline(baseline - shift) + shift;
      if (Math.abs(painted - expected) >= 1 / DPR)
        misses.push(
          `translated ${shift}${trim ? ', trimmed' : ''}: laid out at ${baseline - shift}, painted at ${painted}, expected ${expected}`,
        );
    }
  expect(misses).toEqual([]);
});
