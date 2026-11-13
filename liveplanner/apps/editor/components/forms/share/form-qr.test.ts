import { describe, expect, it } from 'vitest';
import { encode } from 'uqr';
import { loadQr, QR_BORDER, qrFileName, qrModules, qrPath, qrSvgText } from './form-qr';

// The form link as a QR code (docs/specs/030-forms/forms.md "Publishing and the form link").

const URL_ = 'https://www.liveplanner.app/form/AbCdEfGhIjKlMnOpQrStU1';

describe('form-qr', () => {
  it('loads the encoder on demand, once', async () => {
    const a = loadQr();
    expect(loadQr()).toBe(a);
    expect(await a).toBe(encode);
  });

  it('encodes the link with a four-module quiet zone', () => {
    const m = qrModules(encode, URL_);
    expect(m.dark).toHaveLength(m.size);
    // Versions grow in fours from 21; the border adds four modules a side.
    expect((m.size - 2 * QR_BORDER - 21) % 4).toBe(0);
    for (let i = 0; i < QR_BORDER; i += 1) {
      expect(m.dark[i]!.some(Boolean)).toBe(false);
      expect(m.dark[m.size - 1 - i]!.some(Boolean)).toBe(false);
      expect(m.dark.some((row) => row[i])).toBe(false);
    }
    // The top-left finder: seven dark modules across, from the quiet zone's edge.
    expect(m.dark[QR_BORDER]!.slice(QR_BORDER, QR_BORDER + 7).every(Boolean)).toBe(true);
  });

  it('draws one path of runs, and an SVG file black on white', () => {
    const m = {
      size: 3,
      dark: [
        [false, true, true],
        [true, false, true],
        [false, false, false],
      ],
    };
    expect(qrPath(m)).toBe('M1 0h2v1h-2zM0 1h1v1h-1zM2 1h1v1h-1z');
    const svg = qrSvgText(m);
    expect(svg).toContain('viewBox="0 0 3 3"');
    expect(svg).toContain('<rect width="3" height="3" fill="#fff"/>');
    expect(svg).toContain(`<path d="${qrPath(m)}" fill="#000"/>`);
  });

  it('names a download after the form, safe for a file', () => {
    expect(qrFileName('Bug Report', 'png')).toBe('Bug Report QR Code.png');
    expect(qrFileName('a/b: "c"', 'svg')).toBe('a b c QR Code.svg');
    expect(qrFileName(' ?* ', 'png')).toBe('Form QR Code.png');
  });
});
