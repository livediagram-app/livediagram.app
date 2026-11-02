import { describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livedesign/design';

// The rasteriser is WASM; what reaches it is under test.
vi.mock('@liveworkspace/mcp-kit/render', () => ({ svgToPngBase64: async () => 'cG5n' }));

// The design's mains, or a failure, as the components route answers.
let answer: () => Response = () => Response.json({ components: [] });
const fetched: string[] = [];
vi.mock('./api', () => ({
  apiFetch: async (_env: unknown, _token: string, path: string) => {
    fetched.push(path);
    return answer();
  },
}));

const { withMains } = await import('./image-result');

const BAR = { id: 'bar', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 40 };
const MAIN = { id: 'nav', name: 'Nav', width: 100, height: 40, updatedAt: 1, elements: [BAR] };
const INSTANCE = {
  id: 'i1',
  type: 'shape',
  shape: 'instance',
  componentId: 'nav',
  x: 0,
  y: 0,
  width: 200,
  height: 80,
} as Element;
const tabOf = (elements: Element[]): Tab => ({ id: 't', name: 'T', elements });
const auth = { env: {} as never, token: 'tok', designId: 'd1' };

// docs/specs/015-api/mcp-server.md §4.9e "Previews": an instance draws as its main.
describe('withMains', () => {
  it('expands every instance with the design’s mains, read once', async () => {
    fetched.length = 0;
    answer = () => Response.json({ components: [MAIN, { id: 'broken' }] });
    const tab = tabOf([INSTANCE]);
    const out = await withMains(tab, auth);
    expect(out).not.toBe(tab);
    expect(fetched).toEqual(['/designs/d1/components']);
  });

  it('reads nothing for a tab without instances, or without a design', async () => {
    fetched.length = 0;
    const plain = tabOf([BAR as Element]);
    expect(await withMains(plain, auth)).toBe(plain);
    const tab = tabOf([INSTANCE]);
    expect(await withMains(tab, { env: auth.env, token: 'tok' })).toBe(tab);
    expect(await withMains(tab)).toBe(tab);
    expect(fetched).toEqual([]);
  });

  it('draws the tab as it is when the mains cannot be read', async () => {
    const tab = tabOf([INSTANCE]);
    answer = () => Response.json({ error: 'forbidden' }, { status: 403 });
    expect(await withMains(tab, auth)).toBe(tab);
    answer = () => new Response('not json');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await withMains(tab, auth)).toBe(tab);
    expect(warn).toHaveBeenCalledWith('[mcp] preview mains unavailable', expect.anything());
    warn.mockRestore();
  });
});
