import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ES_NOTE_SIZE_PX, EVENT_STORMING_NOTES } from '@livediagram/diagram';
import { buildPhotoNotesPrompt, photoNotesSchema } from './ai-photo-prompt';

// Colour IS the notation (spec/139), so the prompt's legend must be DERIVED
// from the catalogue rather than typed out beside it. These read the prompt's
// own source the way spec/25's element-vocabulary test does, because a second
// hand-written copy is exactly what drifts.

const SOURCE = readFileSync(new URL('./ai-photo-prompt.ts', import.meta.url), 'utf8');

describe('buildPhotoNotesPrompt', () => {
  it('teaches every note kind, with its catalogue colour', () => {
    const prompt = buildPhotoNotesPrompt('Wall');
    for (const note of EVENT_STORMING_NOTES) {
      expect(prompt, note.kind).toContain(note.kind);
      expect(prompt, note.fill).toContain(note.fill);
      expect(prompt).toContain(note.label);
    }
  });

  it('carries no hand-written hex of its own', () => {
    // Every colour in the prompt's SOURCE must come from the catalogue: a
    // literal here is the drift this test exists to stop.
    expect(SOURCE).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it('names the silhouettes and their real pixel sizes', () => {
    const prompt = buildPhotoNotesPrompt('');
    for (const [size, px] of Object.entries(ES_NOTE_SIZE_PX)) {
      expect(prompt, size).toContain(`${size} (${px.width}x${px.height})`);
    }
  });

  it('asks for the text VERBATIM, and forbids improving it', () => {
    const prompt = buildPhotoNotesPrompt('');
    expect(prompt).toContain('VERBATIM');
    expect(prompt.toLowerCase()).toContain('do not correct');
  });

  it('asks for partly covered notes rather than only clean ones', () => {
    expect(buildPhotoNotesPrompt('').toLowerCase()).toContain('partly covered');
  });

  it('asks for normalised geometry, so the answer survives a downscale', () => {
    expect(buildPhotoNotesPrompt('')).toContain('NORMALISED');
  });

  it('never asks the model about the board — only about the photo', () => {
    const prompt = buildPhotoNotesPrompt('Wall').toLowerCase();
    expect(prompt).not.toContain('already on the board');
    expect(prompt).not.toContain('duplicate');
    expect(prompt).not.toContain('existing note');
  });

  it('gives the board’s name only when there is one', () => {
    expect(buildPhotoNotesPrompt('Order flow')).toContain('"Order flow"');
    expect(buildPhotoNotesPrompt('')).not.toContain('is called');
  });
});

describe('photoNotesSchema', () => {
  it('accepts exactly the catalogue kinds, plus unknown', () => {
    const schema = photoNotesSchema() as {
      properties: { notes: { items: { properties: { kind: { enum: string[] } } } } };
    };
    expect(new Set(schema.properties.notes.items.properties.kind.enum)).toEqual(
      new Set([...EVENT_STORMING_NOTES.map((n) => n.kind), 'unknown']),
    );
  });

  it('requires every field the wire contract declares', () => {
    const schema = photoNotesSchema() as {
      properties: { notes: { items: { required: string[] } } };
    };
    expect(new Set(schema.properties.notes.items.required)).toEqual(
      new Set([
        'id',
        'text',
        'kind',
        'colour',
        'size',
        'cx',
        'cy',
        'w',
        'h',
        'row',
        'order',
        'confidence',
      ]),
    );
  });

  it('closes every object, as strict structured outputs demands', () => {
    const json = JSON.stringify(photoNotesSchema());
    expect(json).not.toContain('"additionalProperties":true');
    expect((json.match(/"additionalProperties":false/g) ?? []).length).toBe(2);
  });
});
