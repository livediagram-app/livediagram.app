import { describe, expect, it } from 'vitest';
import {
  EXCALIDRAW_MAX_SCENE_CHARS,
  looksLikeExcalidraw,
  readExcalidrawEnvelope,
} from './excalidraw-envelope';
import { excalidrawBuilder, excalidrawFile, excalidrawText } from './excalidraw-fixtures';

describe('looksLikeExcalidraw', () => {
  it('recognises a clipboard copy, an API copy and an indented saved file', () => {
    const b = excalidrawBuilder();
    const els = [b.rectangle()];
    expect(looksLikeExcalidraw(excalidrawText(els))).toBe(true);
    expect(looksLikeExcalidraw(excalidrawText(els, { type: 'excalidraw-api/clipboard' }))).toBe(
      true,
    );
    expect(looksLikeExcalidraw(excalidrawText(els, { type: 'excalidraw' }))).toBe(true);
    expect(looksLikeExcalidraw(`  \n${excalidrawText(els)}`)).toBe(true);
  });

  it('turns down ordinary text, our own payload and other JSON', () => {
    expect(looksLikeExcalidraw('hello world')).toBe(false);
    expect(looksLikeExcalidraw('{"kind":"livediagram.elements","elements":[]}')).toBe(false);
    expect(looksLikeExcalidraw('{"type":"excalidrawish"}')).toBe(false);
    expect(looksLikeExcalidraw('{"elements":[],"type":"excalidraw"}')).toBe(false);
    expect(looksLikeExcalidraw('')).toBe(false);
  });

  it('reads only the opening characters of a long text', () => {
    const long = `${' '.repeat(300)}{"type":"excalidraw/clipboard","elements":[]}`;
    expect(looksLikeExcalidraw(long)).toBe(false);
  });
});

describe('readExcalidrawEnvelope', () => {
  it('reads a clipboard envelope', () => {
    const b = excalidrawBuilder();
    const r = readExcalidrawEnvelope(excalidrawText([b.rectangle(), b.ellipse()]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envelope.type).toBe('excalidraw/clipboard');
    expect(r.envelope.elements.map((e) => e.type)).toEqual(['rectangle', 'ellipse']);
    expect(r.envelope.files).toEqual({});
    expect(r.envelope.appState).toBeUndefined();
  });

  it('keeps appState only for a saved scene', () => {
    const b = excalidrawBuilder();
    const saved = readExcalidrawEnvelope(
      excalidrawText([b.rectangle()], {
        type: 'excalidraw',
        appState: { viewBackgroundColor: '#fff', gridModeEnabled: true },
      }),
    );
    expect(saved.ok && saved.envelope.appState).toEqual({
      viewBackgroundColor: '#fff',
      gridModeEnabled: true,
    });
    const clip = readExcalidrawEnvelope(
      JSON.stringify({ type: 'excalidraw/clipboard', elements: [], appState: { a: 1 } }),
    );
    expect(clip.ok && clip.envelope.appState).toBeUndefined();
  });

  it('drops deleted elements and non-objects', () => {
    const b = excalidrawBuilder();
    const text = JSON.stringify({
      type: 'excalidraw/clipboard',
      elements: [b.rectangle(), b.ellipse({ isDeleted: true }), null, 7, [], 'x'],
    });
    const r = readExcalidrawEnvelope(text);
    expect(r.ok && r.envelope.elements.map((e) => e.type)).toEqual(['rectangle']);
  });

  it('reads files as given and a malformed files map as empty', () => {
    const b = excalidrawBuilder();
    const withFiles = readExcalidrawEnvelope(
      excalidrawText([b.image('f1')], { files: excalidrawFile('f1') }),
    );
    expect(withFiles.ok && Object.keys(withFiles.envelope.files)).toEqual(['f1']);
    for (const files of [null, [], 'x', 3]) {
      const r = readExcalidrawEnvelope(
        JSON.stringify({ type: 'excalidraw/clipboard', elements: [], files }),
      );
      expect(r.ok && r.envelope.files).toEqual({});
    }
  });

  it.each([
    ['not-json', 'nope', "File isn't valid JSON."],
    ['not-object', '[1,2]', 'Expected a JSON object at the top level.'],
    ['not-object', 'null', 'Expected a JSON object at the top level.'],
    ['not-excalidraw', '{"type":"other","elements":[]}', 'excalidraw'],
    ['no-elements', '{"type":"excalidraw"}', 'Scene is missing its elements array.'],
    ['no-elements', '{"type":"excalidraw/clipboard","elements":{}}', 'elements'],
  ])('rejects %s', (rejection, text, message) => {
    const r = readExcalidrawEnvelope(text);
    expect(r).toMatchObject({ ok: false, rejection });
    if (!r.ok) expect(r.error).toContain(message);
  });

  it('caps scenes at 64 Mi characters', () => {
    expect(EXCALIDRAW_MAX_SCENE_CHARS).toBe(64 * 1024 * 1024);
  });

  it('refuses a text one character over the cap before parsing it, accepts one at it', () => {
    const text = '{"type":"excalidraw/clipboard","elements":[]}';
    expect(readExcalidrawEnvelope(text, text.length).ok).toBe(true);
    expect(readExcalidrawEnvelope(`${text} `, text.length)).toEqual({
      ok: false,
      rejection: 'too-large',
      error: 'This Excalidraw scene is too large to import.',
    });
  });
});
