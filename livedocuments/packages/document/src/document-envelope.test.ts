import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_ENVELOPE_KIND,
  copyDocumentEnvelope,
  documentToEnvelopeText,
  parseDocumentEnvelope,
  type EnvelopeTab,
} from './document-envelope';

// The `.livedocuments` file's contents.

const tab: EnvelopeTab = { id: 't1', name: 'Tab 1', elements: [], folder: 'Ideas' };

describe('documentToEnvelopeText', () => {
  it('wraps the document, its tabs with folders, and the deck in a livedocuments.document envelope', () => {
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
    expect(parseDocumentEnvelope('{"kind":"livedocuments.tab","schemaVersion":1}')).toEqual({
      ok: false,
      failure: 'wrong_kind',
    });
    expect(parseDocumentEnvelope('{"kind":"livedocuments.document","schemaVersion":2}')).toEqual({
      ok: false,
      failure: 'unsupported_version',
    });
    expect(
      parseDocumentEnvelope(
        '{"kind":"livedocuments.document","schemaVersion":1,"document":{"id":"d","name":"n","tabs":[{"id":1}]}}',
      ),
    ).toEqual({ ok: false, failure: 'malformed' });
    expect(parseDocumentEnvelope('null')).toEqual({ ok: false, failure: 'malformed' });
  });

  it('reads a missing deck as none', () => {
    const parsed = parseDocumentEnvelope(
      '{"kind":"livedocuments.document","schemaVersion":1,"exportedAt":1,"document":{"id":"d","name":"n","tabs":[]}}',
    );
    expect(parsed.ok && parsed.envelope.document.presentation).toBeNull();
  });
});

// The document's Automations rules ride its file (docs/specs/013-workspace/automations.md "Files and copies"):
// opaque here, read back through the rules' own check by whoever lands them.
describe('the rules in the file', () => {
  const liveDoc = { id: 'd1', name: 'Launch', presentation: null };
  const rules = [{ name: 'Friday Snapshot', enabled: true, trigger: { kind: 'manual' } }];
  const fileOf = (text: string) => JSON.parse(text) as { document: { automations?: unknown } };

  it('are written when there are some, and left out when there are none', () => {
    const withRules = documentToEnvelopeText({ ...liveDoc, automations: rules }, [tab], 5);
    expect(fileOf(withRules).document.automations).toEqual(rules);
    const none = documentToEnvelopeText({ ...liveDoc, automations: [] }, [tab], 5);
    expect(none).toBe(documentToEnvelopeText(liveDoc, [tab], 5));
    expect(none).not.toContain('automations');
  });

  it('are read back as written, and anything but a list reads as none', () => {
    const text = documentToEnvelopeText({ ...liveDoc, automations: rules }, [tab], 5);
    const parsed = parseDocumentEnvelope(text);
    expect(parsed.ok && parsed.envelope.document.automations).toEqual(rules);
    const odd = fileOf(text);
    odd.document.automations = 'not a list';
    const read = parseDocumentEnvelope(JSON.stringify(odd));
    expect(read.ok && 'automations' in read.envelope.document).toBe(false);
  });

  it('a copy answers each tab’s id in the file to its id in the copy, for the rules that name tabs', () => {
    const parsed = parseDocumentEnvelope(documentToEnvelopeText(liveDoc, [tab], 5));
    if (!parsed.ok) throw new Error(parsed.failure);
    const copy = copyDocumentEnvelope(parsed.envelope);
    expect([...copy.tabIds.keys()]).toEqual(['t1']);
    expect(copy.tabIds.get('t1')).toBe(copy.tabs[0]!.id);
  });
});
