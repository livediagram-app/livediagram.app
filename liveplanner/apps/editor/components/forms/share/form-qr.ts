// The form link as a QR code (docs/specs/030-forms/forms.md "Publishing and the form link", blueprint §12): made in the
// browser, nothing sent anywhere. The encoder (`uqr`, MIT) loads only when the QR Code panel first opens, so it never
// joins the editor's first load. Drawn from the module grid as one SVG path, and onto a canvas for the PNG, black on
// white in both halves so every camera reads it.
import type { encode as Encode } from 'uqr';

// Error correction M (15%) and the standard's four-module quiet zone (blueprint DEFAULTS D19).
const QR_ECC = 'M';
export const QR_BORDER = 4;
// The PNG's smallest side: each module a whole number of pixels, so its edges stay sharp.
export const QR_PNG_MIN_PX = 1024;

export type QrModules = { size: number; dark: readonly (readonly boolean[])[] };

let loading: Promise<typeof Encode> | null = null;
export function loadQr(): Promise<typeof Encode> {
  loading ??= import('uqr').then((m) => m.encode);
  // A failed load (offline) tries again next time.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

export function qrModules(encode: typeof Encode, text: string): QrModules {
  const r = encode(text, { ecc: QR_ECC, border: QR_BORDER });
  return { size: r.size, dark: r.data };
}

// Each row's runs of dark modules, as [x, y, length].
function runs(m: QrModules): [number, number, number][] {
  const out: [number, number, number][] = [];
  m.dark.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x += 1;
      out.push([start, y, x - start]);
    }
  });
  return out;
}

// The dark modules as one path in module units (a viewBox of `0 0 size size`).
export function qrPath(m: QrModules): string {
  return runs(m)
    .map(([x, y, w]) => `M${x} ${y}h${w}v1h-${w}z`)
    .join('');
}

export function qrSvgText(m: QrModules): string {
  const n = m.size;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * 8}" height="${n * 8}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${qrPath(m)}" fill="#000"/></svg>`;
}

export function qrPngBlob(m: QrModules, minPx = QR_PNG_MIN_PX): Promise<Blob | null> {
  const scale = Math.ceil(minPx / m.size);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = m.size * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  for (const [x, y, w] of runs(m)) ctx.fillRect(x * scale, y * scale, w * scale, scale);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

// A download's name from the form's heading: characters files refuse dropped, "Form" when nothing is left.
export function qrFileName(heading: string, ext: 'png' | 'svg'): string {
  const name = heading
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${name || 'Form'} QR Code.${ext}`;
}
