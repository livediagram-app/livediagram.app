import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_ENVELOPE_KIND,
  copyDocumentEnvelope,
  documentToEnvelopeText,
  parseDocumentEnvelope,
  type EnvelopeTab,
} from './document-envelope';

// The `.livehuddle` file's contents (liveworkspace/docs/specs/005-drive/drive.md, "The file").

const tab: EnvelopeTab = { id: 't1', name: 'Tab 1', elements: [], folder: 'Ideas' };

describe('documentToEnvelopeText', () => {
  it('wraps the document, its tabs with folders, and the deck in a livehuddle.document envelope', () => {
    const text = documentToEnvelopeText(
      { id: 'd1', name: 'Plan', presentation: '{"slides":[]}' },
      [tab],
      42,
    );
    expect(JSON.parse(text)).toEqual({
      kind: DOCUMENT_ENVELOPE_KIND,
      schemaVersion: 1,
      exportedAt: 42,
      document: { id: 'd1', name: 'Plan', presentation: '{"slides":[]}', tabs: [tab] },
    });
  });

  it('is byte-identical for identical input, so md5 only moves when content does', () => {
    const a = documentToEnvelopeText({ id: 'd', name: 'n', presentation: null }, [tab], 1);
    const b = documentToEnvelopeText({ id: 'd', name: 'n', presentation: null }, [tab], 1);
    expect(a).toBe(b);
  });
});

describe('parseDocumentEnvelope', () => {
  it('round-trips', () => {
    const text = documentToEnvelopeText({ id: 'd1', name: 'Plan', presentation: null }, [tab], 7);
    const parsed = parseDocumentEnvelope(text);
    expect(parsed).toEqual({ ok: true, envelope: JSON.parse(text) as unknown });
  });

  it('names each failure', () => {
    expect(parseDocumentEnvelope('nope')).toEqual({ ok: false, failure: 'not_json' });
    expect(parseDocumentEnvelope('{"kind":"livehuddle.tab","schemaVersion":1}')).toEqual({
      ok: false,
      failure: 'wrong_kind',
    });
    expect(parseDocumentEnvelope('{"kind":"livehuddle.document","schemaVersion":2}')).toEqual({
      ok: false,
      failure: 'unsupported_version',
    });
    expect(
      parseDocumentEnvelope(
        '{"kind":"livehuddle.document","schemaVersion":1,"document":{"id":"d","name":"n","tabs":[{"id":1}]}}',
      ),
    ).toEqual({ ok: false, failure: 'malformed' });
    expect(parseDocumentEnvelope('null')).toEqual({ ok: false, failure: 'malformed' });
  });

  it('reads a missing deck as none', () => {
    const parsed = parseDocumentEnvelope(
      '{"kind":"livehuddle.document","schemaVersion":1,"exportedAt":1,"document":{"id":"d","name":"n","tabs":[]}}',
    );
    expect(parsed.ok && parsed.envelope.document.presentation).toBeNull();
  });
});

describe('copyDocumentEnvelope', () => {
  it('gives every tab a fresh id, with tab links and the deck following them', () => {
    const parsed = parseDocumentEnvelope(
      documentToEnvelopeText(
        {
          id: 'd',
          name: 'n',
          presentation: JSON.stringify({
            decks: [{ id: 'k', slides: [{ id: 's', tabId: 't2' }] }],
          }),
        },
        [
          {
            id: 't1',
            name: 'One',
            elements: [
              {
                id: 'a',
                type: 'shape',
                shape: 'square',
                x: 0,
                y: 0,
                width: 1,
                height: 1,
                link: { kind: 'tab', tabId: 't2' },
              },
            ],
          },
          { id: 't2', name: 'Two', elements: [], folder: 'Ideas' },
        ],
        1,
      ),
    );
    if (!parsed.ok) throw new Error(parsed.failure);
    const { tabs, presentation } = copyDocumentEnvelope(parsed.envelope);
    const [one, two] = tabs;
    expect([one!.id, two!.id]).not.toContain('t1');
    expect(two!.id).not.toBe('t2');
    expect(two!.folder).toBe('Ideas');
    expect((one!.elements[0] as { link?: { tabId: string } }).link?.tabId).toBe(two!.id);
    expect(presentation).toContain(`"tabId":"${two!.id}"`);
  });

  it('drops a deck it cannot read', () => {
    const { presentation } = copyDocumentEnvelope({
      kind: DOCUMENT_ENVELOPE_KIND,
      schemaVersion: 1,
      exportedAt: 0,
      document: { id: 'd', name: 'n', presentation: '{nope', tabs: [] },
    });
    expect(presentation).toBeNull();
  });
});
