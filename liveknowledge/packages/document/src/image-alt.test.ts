import { describe, expect, it } from 'vitest';
import { createImage, createShape } from './factories';
import {
  cleanImageAlt,
  cleanImageAlts,
  IMAGE_ALT_MAX,
  imageAltTextOf,
  withCleanImageAlt,
} from './image-alt';
import { migrateIncomingElements } from './stored-tab';
import type { Element } from './index';

// docs/specs/009-elements/images.md "Alt text": one line, no bidi controls, trimmed, at most IMAGE_ALT_MAX
// characters cut between whole characters; '' means none.

const picture = (id: string, alt?: unknown): Element =>
  ({
    ...createImage(0, 0),
    id,
    imageId: `img-${id}`,
    ...(alt === undefined ? {} : { alt }),
  }) as Element;

describe('cleanImageAlt', () => {
  it('keeps plain words as they are', () => {
    expect(cleanImageAlt('A red bicycle against a wall')).toBe('A red bicycle against a wall');
  });

  it('makes one line: every white-space run, line breaks and tabs included, is one space', () => {
    expect(cleanImageAlt('A chart\n\nof sales\t by   quarter\r\n')).toBe(
      'A chart of sales by quarter',
    );
  });

  it('removes bidi embeddings, overrides and isolates', () => {
    expect(cleanImageAlt('‮evil‬ photo ⁦x⁩')).toBe('evil photo x');
  });

  it('trims spaces and invisible characters at either end', () => {
    expect(cleanImageAlt('​  A cat ﻿')).toBe('A cat');
  });

  it('is empty when nothing but spaces and invisible characters was typed', () => {
    expect(cleanImageAlt('  \n​‮ ')).toBe('');
  });

  it(`clips to ${IMAGE_ALT_MAX} characters between whole characters`, () => {
    expect(cleanImageAlt('a'.repeat(IMAGE_ALT_MAX + 50))).toHaveLength(IMAGE_ALT_MAX);
    // An emoji straddling the cap is left out whole, never cut in half.
    const straddling = `${'a'.repeat(IMAGE_ALT_MAX - 1)}😀`;
    expect(cleanImageAlt(straddling)).toBe('a'.repeat(IMAGE_ALT_MAX - 1));
  });

  it('keeps right-to-left letters, which need no controls', () => {
    expect(cleanImageAlt('صورة قطة')).toBe('صورة قطة');
  });
});

describe('withCleanImageAlt', () => {
  it('hands back the same element when there is nothing to clean', () => {
    const clean = picture('a', 'A cat');
    expect(withCleanImageAlt(clean)).toBe(clean);
    const none = picture('b');
    expect(withCleanImageAlt(none)).toBe(none);
    const shape = { ...createShape('square', 0, 0), alt: '  not an image  ' } as unknown as Element;
    expect(withCleanImageAlt(shape)).toBe(shape);
    const absent = { ...picture('c'), alt: undefined } as Element;
    expect(withCleanImageAlt(absent)).toBe(absent);
  });

  it('cleans a dirty alt, and drops one that cleans to nothing or is not text', () => {
    expect(withCleanImageAlt(picture('a', '  A\ncat '))).toMatchObject({ alt: 'A cat' });
    expect('alt' in withCleanImageAlt(picture('b', '   '))).toBe(false);
    expect('alt' in withCleanImageAlt(picture('c', 42))).toBe(false);
  });
});

describe('cleanImageAlts', () => {
  it('hands back the same list when every alt is clean', () => {
    const list = [picture('a', 'A cat'), createShape('square', 0, 0), picture('b')];
    expect(cleanImageAlts(list)).toBe(list);
  });

  it('cleans only the images that need it, leaving the rest the same objects', () => {
    const keep = picture('a', 'Fine');
    const list = [keep, picture('b', ' x‮ ')];
    const next = cleanImageAlts(list);
    expect(next).not.toBe(list);
    expect(next[0]).toBe(keep);
    expect(next[1]).toMatchObject({ alt: 'x' });
  });

  // Every path that writes an element to the server migrates it first: an Editor's op, a save, an agent's change, an
  // import.
  it('runs in the stored-element migrations every incoming element passes', () => {
    const [el] = migrateIncomingElements([picture('a', `${'b'.repeat(400)}\n`)]);
    expect((el as { alt?: string }).alt).toHaveLength(IMAGE_ALT_MAX);
  });
});

describe('imageAltTextOf', () => {
  it('joins the alt texts of the chosen pictures in paint order, skipping those with none', () => {
    const elements = [
      picture('a', 'First'),
      picture('b'),
      createShape('square', 0, 0),
      picture('c', '  Third '),
      picture('d', 'Not chosen'),
      picture('e', '   '),
    ];
    const ids = new Set(['a', 'b', 'c', 'e', elements[2]!.id]);
    expect(imageAltTextOf(elements, ids)).toBe('First; Third');
    expect(imageAltTextOf(elements, new Set(['b']))).toBe('');
  });
});
