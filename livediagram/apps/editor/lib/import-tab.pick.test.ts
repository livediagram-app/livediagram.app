// @vitest-environment jsdom
// The tab-file picker: a file past the caller's limit is refused before it is read (a huge file would hang the tab).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickTabFile, pickTabFiles } from './import-tab';

afterEach(() => vi.restoreAllMocks());

// Pick `file` (or several) in the next file input the picker opens.
function choose(file: File | File[], seen?: (input: HTMLInputElement) => void) {
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = create(tag);
    if (tag === 'input') {
      el.click = () => {
        seen?.(el as HTMLInputElement);
        Object.defineProperty(el, 'files', { value: Array.isArray(file) ? file : [file] });
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

  it('settles null when the file cannot be read', async () => {
    const file = new File(['x'], 'a.csv');
    vi.spyOn(file, 'text').mockRejectedValue(new Error('gone'));
    choose(file);
    await expect(pickTabFile('.csv')).resolves.toBeNull();
  });
});

describe('pickTabFiles', () => {
  it('offers several files and reads each, refusing one past the limit unread', async () => {
    let multiple = false;
    const big = new File(['x'.repeat(101)], 'big.tf');
    const read = vi.spyOn(big, 'text');
    choose([new File(['name = "a"'], 'wrangler.toml'), big], (input) => {
      multiple = input.multiple;
    });
    const picked = await pickTabFiles('.toml,.tf', { maxBytes: 100 });
    expect(multiple).toBe(true);
    expect(picked).toMatchObject([
      { name: 'wrangler.toml', text: 'name = "a"' },
      { name: 'big.tf', text: '', tooBig: true },
    ]);
    expect(read).not.toHaveBeenCalled();
  });

  it('drops a file that cannot be read, and settles null when none could be', async () => {
    const broken = new File(['x'], 'a.tf');
    vi.spyOn(broken, 'text').mockRejectedValue(new Error('gone'));
    choose([broken, new File(['b'], 'b.tf')]);
    await expect(pickTabFiles('.tf')).resolves.toMatchObject([{ name: 'b.tf' }]);
    vi.restoreAllMocks();
    const alone = new File(['x'], 'a.tf');
    vi.spyOn(alone, 'text').mockRejectedValue(new Error('gone'));
    choose(alone);
    await expect(pickTabFiles('.tf')).resolves.toBeNull();
  });

  it('settles null when nothing was chosen', async () => {
    choose([]);
    await expect(pickTabFiles('.tf')).resolves.toBeNull();
  });
});
