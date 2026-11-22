import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_ENVELOPE_KIND,
  copyDocumentEnvelope,
  documentToEnvelopeText,
  parseDocumentEnvelope,
  type EnvelopeTab,
} from './document-envelope';

// The `.liveknowledge` file's contents.

const tab: EnvelopeTab = { id: 't1', name: 'Tab 1', elements: [], folder: 'Ideas' };

describe('documentToEnvelopeText', () => {
  it('wraps the document, its tabs with folders, and the deck in a liveknowledge.document envelope', () => {
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
    expect(parseDocumentEnvelope('{"kind":"liveknowledge.tab","schemaVersion":1}')).toEqual({
      ok: false,
      failure: 'wrong_kind',
    });
    expect(parseDocumentEnvelope('{"kind":"liveknowledge.document","schemaVersion":2}')).toEqual({
      ok: false,
      failure: 'unsupported_version',
    });
    expect(
      parseDocumentEnvelope(
        '{"kind":"liveknowledge.document","schemaVersion":1,"document":{"id":"d","name":"n","tabs":[{"id":1}]}}',
      ),
    ).toEqual({ ok: false, failure: 'malformed' });
    expect(parseDocumentEnvelope('null')).toEqual({ ok: false, failure: 'malformed' });
  });

  it('reads a missing deck as none', () => {
    const parsed = parseDocumentEnvelope(
      '{"kind":"liveknowledge.document","schemaVersion":1,"exportedAt":1,"document":{"id":"d","name":"n","tabs":[]}}',
    );
    expect(parsed.ok && parsed.envelope.document.presentation).toBeNull();
  });
});

describe("the knowledgebase's settings in the file", () => {
  const text = (knowledgeSettings?: unknown) =>
    documentToEnvelopeText(
      { id: 'd1', name: 'Plan', presentation: null, knowledgeSettings: knowledgeSettings as never },
      [tab],
      42,
    );
  const written = (settings?: unknown) =>
    JSON.parse(text(settings)) as { document: Record<string, unknown> };
  const read = (file: string) => {
    const parsed = parseDocumentEnvelope(file);
    if (!parsed.ok) throw new Error(parsed.failure);
    return parsed.envelope;
  };

  it('carries a Review Period that is not the default, through a write, a read and a copy', () => {
    for (const reviewEvery of [30, 180, 365, 'never'] as const) {
      const envelope = read(text({ reviewEvery }));
      expect(envelope.document.knowledgeSettings).toEqual({ reviewEvery });
      expect(copyDocumentEnvelope(envelope).knowledgeSettings).toEqual({ reviewEvery });
    }
  });

  it('leaves the default and anything unknown out, so an old file reads as every 90 days', () => {
    for (const settings of [undefined, { reviewEvery: 90 }, { reviewEvery: 45 }, 'never', null]) {
      expect(written(settings).document).not.toHaveProperty('knowledgeSettings');
    }
    const old = written();
    old.document.knowledgeSettings = { reviewEvery: 'monthly' };
    const envelope = read(JSON.stringify(old));
    expect(envelope.document).not.toHaveProperty('knowledgeSettings');
    expect(copyDocumentEnvelope(envelope)).not.toHaveProperty('knowledgeSettings');
  });
});

// The knowledgebase's Automations rules ride its file (docs/specs/013-workspace/automations.md "Files and copies"):
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
