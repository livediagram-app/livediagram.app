// @vitest-environment jsdom
// The tab-file picker: a file past the caller's limit is refused before it is read (a huge file would hang the tab).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickTabFile } from './import-tab';

afterEach(() => vi.restoreAllMocks());

// Pick `file` in the next file input the picker opens.
function choose(file: File) {
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = create(tag);
    if (tag === 'input') {
      el.click = () => {
        Object.defineProperty(el, 'files', { value: [file] });
        void (el as HTMLInputElement).onchange?.(new Event('change'));
      };
    }
    return el;
  });
}

describe('pickTabFile', () => {
  it('reads a file within the limit', async () => {
    choose(new File(['Title\nA\n'], 'cards.csv', { type: 'text/csv' }));
    await expect(pickTabFile('.csv', { maxBytes: 100 })).resolves.toMatchObject({
      name: 'cards.csv',
      text: 'Title\nA\n',
    });
  });

  it('refuses a file past the limit without reading it', async () => {
    const file = new File(['x'.repeat(101)], 'huge.csv', { type: 'text/csv' });
    const read = vi.spyOn(file, 'text');
    choose(file);
    const picked = await pickTabFile('.csv', { maxBytes: 100 });
    expect(picked).toMatchObject({ name: 'huge.csv', text: '', tooBig: true });
    expect(read).not.toHaveBeenCalled();
  });
});
