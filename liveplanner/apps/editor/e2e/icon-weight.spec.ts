import { expect, expectNoPageErrors, startBlankProject, test } from './fixtures';

// The chrome's glyph weight (docs/specs/004-interface-design/iconography.md). (The canvas icons' Weight row went
// with the diagram shapes: Plan draws no line-art icon elements.)

test.describe('Chrome glyph weight', () => {
  test('draws the house weight in on-screen px, whatever CSS does to the size', async ({
    page,
    pageErrors,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await startBlankProject(page);
    // A chrome button's glyph: the status bar's Search.
    const glyph = page
      .getByRole('button', { name: 'Search', exact: true })
      .locator('svg.lvd-glyph')
      .first();
    await expect(glyph).toHaveAttribute('stroke-width', '1.25');
    const child = glyph.locator('> *').first();
    await expect
      .poll(() => child.evaluate((el) => getComputedStyle(el).getPropertyValue('vector-effect')))
      .toBe('non-scaling-stroke');
    await expect
      .poll(() =>
        glyph.evaluate((el) => (el as SVGSVGElement).style.getPropertyValue('--glyph-ink-l')),
      )
      .not.toBe('');
    expectNoPageErrors(pageErrors);
  });
});
