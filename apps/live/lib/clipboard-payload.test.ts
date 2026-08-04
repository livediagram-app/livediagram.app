import { describe, expect, it } from 'vitest';
import type { Element, ShapeElement } from '@livediagram/diagram';

import {
  CLIPBOARD_KIND,
  CLIPBOARD_SCHEMA_VERSION,
  MAX_CLIPBOARD_BYTES,
  MAX_CLIPBOARD_ELEMENTS,
  parseElementsPayload,
  serialiseElements,
} from './clipboard-payload';

// The clipboard payload is the one thing in the editor that parses a string
// the editor did not write: on every Cmd+V, whatever the OS clipboard happens
// to hold. So the tests care mostly about what it REFUSES.

const shape = (id: string, over: Partial<ShapeElement> = {}): ShapeElement =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 120,
    height: 120,
    ...over,
  }) as ShapeElement;

describe('serialiseElements', () => {
  it('round-trips a selection', () => {
    const elements = [shape('a'), shape('b', { x: 40 })];
    const back = parseElementsPayload(serialiseElements(elements));
    expect(back?.map((el) => el.id)).toEqual(['a', 'b']);
    expect((back?.[1] as ShapeElement).x).toBe(40);
  });

  it('writes the envelope the reader discriminates on', () => {
    const env = JSON.parse(serialiseElements([shape('a')]));
    expect(env.kind).toBe(CLIPBOARD_KIND);
    expect(env.schemaVersion).toBe(CLIPBOARD_SCHEMA_VERSION);
  });

  // A copy can travel to another diagram, another account, another person.
  // Nothing that says WHO does anything should ride along.
  it('strips comment threads and per-participant responses', () => {
    const withIdentity = shape('a', {
      commentThread: {
        resolved: false,
        comments: [
          {
            id: 'c1',
            text: 'ship it',
            authorId: 'someone-else',
            authorName: 'Someone Else',
            authorColor: '#f00',
            createdAt: 1,
          },
        ],
      },
      responses: [{ participantId: 'p1', value: 'done', at: 1 }],
    } as Partial<ShapeElement>);
    const text = serialiseElements([withIdentity]);
    expect(text).not.toContain('Someone Else');
    expect(text).not.toContain('p1');
    const back = parseElementsPayload(text)![0] as ShapeElement & { responses?: unknown };
    expect(back.commentThread).toBeUndefined();
    expect(back.responses).toBeUndefined();
  });

  it('leaves the source element untouched', () => {
    const el = shape('a', {
      commentThread: { comments: [], resolved: false },
    } as Partial<ShapeElement>);
    serialiseElements([el]);
    expect(el.commentThread).toBeDefined();
  });
});

describe('parseElementsPayload refuses', () => {
  it('ordinary copied text', () => {
    expect(parseElementsPayload('just some words')).toBeNull();
    expect(parseElementsPayload('')).toBeNull();
    expect(parseElementsPayload(null)).toBeNull();
    expect(parseElementsPayload(undefined)).toBeNull();
  });

  it('another application’s JSON', () => {
    expect(parseElementsPayload('{"kind":"figma.paste","elements":[]}')).toBeNull();
    expect(parseElementsPayload('[1,2,3]')).toBeNull();
    expect(parseElementsPayload('null')).toBeNull();
  });

  it('a truncated payload, without throwing', () => {
    const text = serialiseElements([shape('a')]);
    expect(parseElementsPayload(text.slice(0, text.length - 8))).toBeNull();
  });

  it('a schema version from the future', () => {
    const env = JSON.parse(serialiseElements([shape('a')]));
    env.schemaVersion = CLIPBOARD_SCHEMA_VERSION + 1;
    expect(parseElementsPayload(JSON.stringify(env))).toBeNull();
  });

  it('a payload past the byte cap, before parsing it', () => {
    // The cap has to bite on the RAW string: the point is not to hand
    // JSON.parse several megabytes on a keystroke.
    const huge = `{"kind":"${CLIPBOARD_KIND}",` + 'x'.repeat(MAX_CLIPBOARD_BYTES);
    expect(parseElementsPayload(huge)).toBeNull();
  });

  it('a payload whose elements are all invalid', () => {
    const env = {
      kind: CLIPBOARD_KIND,
      schemaVersion: CLIPBOARD_SCHEMA_VERSION,
      copiedAt: 1,
      elements: [{ id: 'x' }, { nope: true }],
    };
    expect(parseElementsPayload(JSON.stringify(env))).toBeNull();
  });
});

describe('parseElementsPayload salvages', () => {
  it('the readable elements, dropping only the broken ones', () => {
    const env = {
      kind: CLIPBOARD_KIND,
      schemaVersion: CLIPBOARD_SCHEMA_VERSION,
      copiedAt: 1,
      elements: [shape('good'), { id: 'bad', type: 'nonsense' }, shape('alsogood')],
    };
    const back = parseElementsPayload(JSON.stringify(env));
    expect(back?.map((el) => el.id)).toEqual(['good', 'alsogood']);
  });

  it('deduplicates ids, keeping the first', () => {
    const env = {
      kind: CLIPBOARD_KIND,
      schemaVersion: CLIPBOARD_SCHEMA_VERSION,
      copiedAt: 1,
      elements: [shape('a', { x: 1 }), shape('a', { x: 2 })],
    };
    const back = parseElementsPayload(JSON.stringify(env));
    expect(back).toHaveLength(1);
    expect((back![0] as ShapeElement).x).toBe(1);
  });

  it('caps how many elements one paste can carry', () => {
    const elements: Element[] = Array.from({ length: MAX_CLIPBOARD_ELEMENTS + 50 }, (_, i) =>
      shape(`e${i}`),
    );
    const back = parseElementsPayload(serialiseElements(elements));
    expect(back).toHaveLength(MAX_CLIPBOARD_ELEMENTS);
  });
});
