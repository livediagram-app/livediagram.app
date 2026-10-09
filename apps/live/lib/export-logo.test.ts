import { describe, expect, it } from 'vitest';
import { layOutIllustratePages, newLogoPage } from '@livediagram/document';
import { pageExportFrame } from './export-page';
import {
  LOGO_ICO_SIZES,
  LOGO_KIT_PNG_SIZES,
  logoKitFileName,
  logoKitFileNames,
} from './export-logo-kit';

// docs/specs/007-editor/logo-pages.md "Export".
describe('logo page export', () => {
  const [plain] = layOutIllustratePages([newLogoPage('l')]);
  const [painted] = layOutIllustratePages([
    { ...newLogoPage('p'), background: { fill: { kind: 'solid', color: '#123456' } } },
  ]);
  const [a4] = layOutIllustratePages([{ id: 'a', orientation: 'portrait' }]);

  it('leaves a logo page’s plain paper out when asked, keeping a fill', () => {
    const see = pageExportFrame(plain!, { transparentPaper: true });
    expect(see.transparent).toBe(true);
    expect(see.backgroundSvg).toBe('');
    const filled = pageExportFrame(painted!, { transparentPaper: true });
    expect(filled.transparent).toBe(false);
    expect(filled.backgroundSvg).toContain('#123456');
  });

  it('keeps the paper on a PDF (not asked) and on every other kind of page', () => {
    expect(pageExportFrame(plain!).backgroundSvg).toContain('<rect');
    expect(pageExportFrame(a4!, { transparentPaper: true }).transparent).toBe(false);
  });

  it('names the kit and lists its files', () => {
    expect(logoKitFileNames()).toEqual([
      'logo.svg',
      ...LOGO_KIT_PNG_SIZES.map((s) => `logo-${s}.png`),
      'favicon.ico',
    ]);
    expect(LOGO_ICO_SIZES).toEqual([16, 32, 48]);
    expect(logoKitFileName('Acme', { ...plain!, name: 'Mark' }, 2)).toBe(
      'Acme - Mark - Logo Kit.zip',
    );
    expect(logoKitFileName('Acme', plain!, 3)).toBe('Acme - Page 1 - Logo Kit.zip');
    expect(logoKitFileName('', plain!, 1)).toBe('document - Logo Kit.zip');
  });
});
