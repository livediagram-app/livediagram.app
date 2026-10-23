// A library shape drawn by its app's API: one request a library version, an <img> of a data URL per shape, and a
// plain tile until (or unless) its drawing arrives.
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appLibraryHosts } from './http';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="2"/></svg>';

afterEach(() => vi.unstubAllGlobals());

function stubApi(previews: Record<string, string>, status = 200) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes('/previews'))
        return json(status === 200 ? { previews } : { error: 'x' }, status);
      return json({
        libraries: [
          {
            id: 'L1',
            name: 'Net',
            updatedAt: 7,
            items: [
              { id: 's1', title: 'A', width: 40, height: 20, elements: [] },
              { id: 's2', title: 'B', width: 20, height: 40, elements: [] },
            ],
          },
        ],
      });
    }),
  );
  return calls;
}

// A host of its own each time (a fresh token reader), so no drawing is shared between tests.
const host = () =>
  appLibraryHosts('livediagram', { token: async () => 'tok', origin: 'http://app.test' })
    .shapeLibraries!;

describe("a library shape drawn by its app's API", () => {
  it('draws every shape of a library from one request, keyed to its version', async () => {
    const calls = stubApi({ s1: SVG, s2: SVG });
    const shapes = host();
    const [library] = await shapes.list();
    const { container } = render(
      <>
        {library!.items.map((s) => (
          <span key={s.id}>{shapes.renderShape!(s)}</span>
        ))}
      </>,
    );
    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2));
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`,
    );
    expect(img.getAttribute('alt')).toBe('');
    expect(calls.filter((u) => u.includes('/previews'))).toEqual([
      'http://app.test/api/shape-libraries/L1/previews?v=7',
    ]);
  });

  it('keeps a plain tile for a shape the app did not draw, and when the drawing fails', async () => {
    stubApi({ s1: SVG });
    const shapes = host();
    const [library] = await shapes.list();
    const { container } = render(<>{shapes.renderShape!(library!.items[1]!)}</>);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[aria-hidden]')).not.toBeNull();

    stubApi({}, 500);
    const failing = host();
    const [again] = await failing.list();
    const second = render(<>{failing.renderShape!(again!.items[0]!)}</>);
    await new Promise((r) => setTimeout(r, 0));
    expect(second.container.querySelector('img')).toBeNull();
  });

  it('draws nothing for a shape it never listed', async () => {
    const calls = stubApi({ s1: SVG });
    const { container } = render(
      <>{host().renderShape!({ id: 's1', title: 'A', width: 1, height: 1 })}</>,
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('img')).toBeNull();
    expect(calls).toEqual([]);
  });
});
