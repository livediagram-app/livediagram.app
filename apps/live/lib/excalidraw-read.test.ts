import { describe, expect, it } from 'vitest';
import { readExcalidrawFile, sceneFromExcalidrawText } from './excalidraw-read';
import { excalidrawBuilder, excalidrawText } from './excalidraw-fixtures';

const copy = () => excalidrawText([excalidrawBuilder().rectangle()]);

describe('sceneFromExcalidrawText', () => {
  it('reads a copy into a scene', () => {
    const r = sceneFromExcalidrawText(copy());
    expect(r.ok && r.scene.items.map((i) => i.kind)).toEqual(['shape']);
  });

  it('names the rejection of a broken copy', () => {
    expect(sceneFromExcalidrawText('{"type":"excalidraw/clipboard","elements":[')).toEqual({
      ok: false,
      error: "File isn't valid JSON.",
    });
  });
});

describe('readExcalidrawFile', () => {
  const file = (body: BlobPart, name: string, type = '') => new File([body], name, { type });

  it('reads a .excalidraw file to a scene', async () => {
    const r = await readExcalidrawFile(
      file(excalidrawText([excalidrawBuilder().ellipse()], { type: 'excalidraw' }), 'b.excalidraw'),
    );
    expect(r).toMatchObject({ kind: 'scene', container: 'json' });
    expect(r.kind === 'scene' && r.scene.items.map((i) => i.kind)).toEqual(['shape']);
  });

  it('is not-excalidraw for a PNG without a scene, so the image paste goes on', async () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 73, 69, 78, 68, 0, 0, 0, 0,
    ]);
    expect(await readExcalidrawFile(file(png, 'shot.png', 'image/png'))).toEqual({
      kind: 'not-excalidraw',
    });
  });

  it('is not-excalidraw for a plain SVG', async () => {
    expect(
      await readExcalidrawFile(
        file('<svg xmlns="http://www.w3.org/2000/svg"/>', 'a.svg', 'image/svg+xml'),
      ),
    ).toEqual({ kind: 'not-excalidraw' });
  });

  it('is an error for a broken .excalidraw file', async () => {
    expect(await readExcalidrawFile(file('nope', 'b.excalidraw'))).toEqual({
      kind: 'error',
      error: "File isn't valid JSON.",
    });
  });
});
