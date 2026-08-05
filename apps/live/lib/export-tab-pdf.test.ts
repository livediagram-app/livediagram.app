import { describe, expect, it, vi } from 'vitest';

// The PDF is hand-rolled, so its object table and xref have to agree byte for
// byte: a reader handed one wrong offset rejects the whole document rather
// than one page of it. That is what these check, on the multi-page path a
// slide deck takes (spec/31).
//
// The canvas is stubbed — jsdom has no 2d context, and none of what is under
// test is the rendering. What matters is the container.
vi.mock('./export-tab', () => ({
  renderTabToCanvas: (_tab: unknown, _o: unknown) => {
    const data = new Uint8ClampedArray(4 * 4 * 4).fill(255);
    return Promise.resolve({
      width: 4,
      height: 4,
      getContext: () => ({ getImageData: () => ({ data }) }),
    });
  },
}));

const { exportTabsAsPdf, exportTabAsPdf } = await import('./export-tab-pdf');

const tab = (id: string) => ({ id, name: id, elements: [] }) as never;
const text = async (blob: Blob) => new TextDecoder('latin1').decode(await blob.arrayBuffer());

describe('exportTabsAsPdf', () => {
  it('writes one page object per tab and says so in the page tree', async () => {
    const pdf = await text(await exportTabsAsPdf([tab('a'), tab('b'), tab('c')]));
    expect(pdf).toContain('/Count 3');
    expect(pdf).toContain('/Kids [3 0 R 6 0 R 9 0 R]');
    expect(pdf.match(/\/Type \/Page[^s]/g) ?? []).toHaveLength(3);
  });

  it('gives every object an xref entry, and the count in the trailer agrees', async () => {
    const pdf = await text(await exportTabsAsPdf([tab('a'), tab('b')]));
    // 2 fixed objects + 3 per page = 8, and the table carries the free entry.
    expect(pdf).toContain('xref\n0 9');
    expect(pdf).toContain('/Size 9');
    const entries = pdf.slice(pdf.indexOf('xref')).match(/^\d{10} \d{5} [nf] $/gm) ?? [];
    expect(entries).toHaveLength(9);
  });

  it('points each xref offset at the object that lives there', async () => {
    // The failure this catches is an off-by-one in the object numbering: every
    // recorded offset must land exactly on "<n> 0 obj".
    const pdf = await text(await exportTabsAsPdf([tab('a'), tab('b')]));
    const table = pdf.slice(pdf.indexOf('xref\n'));
    const offsets = [...table.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(8);
    offsets.forEach((off, i) => {
      expect(pdf.slice(off, off + 10)).toMatch(new RegExp(`^${i + 1} 0 obj`));
    });
  });

  it('starts with the header and ends with the marker a reader looks for', async () => {
    const pdf = await text(await exportTabsAsPdf([tab('a')]));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    // startxref must point at the xref keyword itself.
    const declared = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    expect(pdf.slice(declared, declared + 4)).toBe('xref');
  });

  it('refuses an empty deck rather than writing a pageless document', async () => {
    await expect(exportTabsAsPdf([])).rejects.toThrow(/at least one page/);
  });

  it('still exports a single tab as a one-page document', async () => {
    const pdf = await text(await exportTabAsPdf(tab('a')));
    expect(pdf).toContain('/Count 1');
    expect(pdf).toContain('/Kids [3 0 R]');
  });
});
