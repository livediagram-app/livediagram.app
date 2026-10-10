// Writes every static copy of the brand mark from its one source, the Living
// Prism module in @livediagram/ui (docs/specs/004-interface-design/brand-mark.md):
//   - apps/*/app/icon.svg: the compact mark, light/dark by prefers-color-scheme
//   - marketing/media/logo/: the full mark and the lockup, light and dark
//   - marketing/media/icons/: transparent PNGs at Google Drive's sizes, and
//     white-tile PNGs (also copied to apps/marketing/public/ for the manifest)
// Run via `pnpm icons:brand` from the repo root. apps/marketing/lib/brand-icon.test.ts
// fails when a committed SVG drifts from the module.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../../../', import.meta.url));

// The module is TypeScript importing other workspace TypeScript, so bundle it
// to one ESM file in memory and import that.
const bundle = await build({
  stdin: {
    contents:
      "export { brandMarkSvg } from './packages/ui/src/brand-mark-geometry';" +
      "export { brandLogoSvg } from './packages/ui/src/brand-logo-svg';",
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  write: false,
});
const { brandMarkSvg, brandLogoSvg } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

const write = (path, text) => {
  mkdirSync(`${root}${path.slice(0, path.lastIndexOf('/'))}`, { recursive: true });
  writeFileSync(`${root}${path}`, text);
  console.log(`brand-icons: ${path}`);
};

const favicon = brandMarkSvg({ variant: 'compact', scheme: 'auto' });
for (const app of ['marketing', 'live', 'help', 'telemetry', 'community']) {
  write(`apps/${app}/app/icon.svg`, `${favicon}\n`);
}
for (const scheme of ['light', 'dark']) {
  write(
    `marketing/media/logo/livediagram-mark-${scheme}.svg`,
    `${brandMarkSvg({ variant: 'full', scheme })}\n`,
  );
  write(`marketing/media/logo/livediagram-logo-${scheme}.svg`, `${brandLogoSvg(scheme)}\n`);
}

// Below 48px the compact drawing; from 48px the full one (the spec's split).
const markFor = (size) =>
  brandMarkSvg({ variant: size >= 48 ? 'full' : 'compact', scheme: 'light' });
// The share of a white tile the mark fills, as on the Apple icon (132 of 180).
const TILE_FILL = 132 / 180;

const browser = await chromium.launch();
const shoot = async (size, background, path) => {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const markSize = background ? Math.round(size * TILE_FILL) : size;
  const src = `data:image/svg+xml;base64,${Buffer.from(markFor(markSize)).toString('base64')}`;
  await page.setContent(
    `<html style="margin:0;background:${background ?? 'transparent'}"><body style="margin:0;` +
      `display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">` +
      `<img src="${src}" width="${markSize}" height="${markSize}" style="display:block"></body></html>`,
  );
  await page.locator('img').evaluate((img) => img.decode());
  await page.screenshot({ path: `${root}${path}`, omitBackground: !background });
  await page.close();
  console.log(`brand-icons: ${size}x${size} -> ${path}`);
};
for (const size of [16, 32, 64, 128, 256, 512]) {
  await shoot(size, null, `marketing/media/icons/livediagram-icon-transparent-${size}.png`);
}
for (const size of [256, 512, 1024]) {
  await shoot(size, '#ffffff', `marketing/media/icons/livediagram-icon-${size}.png`);
}
for (const size of [256, 512]) {
  await shoot(size, '#ffffff', `apps/marketing/public/livediagram-icon-${size}.png`);
}
await browser.close();
