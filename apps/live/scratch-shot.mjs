import { chromium } from '@playwright/test';
const [,, file, out, w, h] = process.argv;
const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: +w, height: +h } });
await p.goto('file://' + file); await p.screenshot({ path: out }); await b.close();
