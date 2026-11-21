import { describe, expect, it } from 'vitest';
import {
  copyDesignEnvelope,
  DESIGN_ENVELOPE_KIND,
  designToEnvelopeText,
  parseDesignEnvelope,
  type EnvelopeTab,
} from './design-envelope';

// The `.livedesign` file's contents.

const tab: EnvelopeTab = { id: 't1', name: 'Tab 1', elements: [], folder: 'Ideas' };

describe('designToEnvelopeText', () => {
  it('wraps the design and its tabs with folders in a livedesign.design envelope', () => {
    const text = designToEnvelopeText({ id: 'd1', name: 'Plan' }, [tab], 42);
    expect(JSON.parse(text)).toEqual({
      kind: DESIGN_ENVELOPE_KIND,
      schemaVersion: 1,
      exportedAt: 42,
      design: { id: 'd1', name: 'Plan', tabs: [tab] },
    });
  });

  it('is byte-identical for identical input, so md5 only moves when content does', () => {
    const a = designToEnvelopeText({ id: 'd', name: 'n' }, [tab], 1);
    const b = designToEnvelopeText({ id: 'd', name: 'n' }, [tab], 1);
    expect(a).toBe(b);
  });
});

describe('parseDesignEnvelope', () => {
  it('round-trips', () => {
    const text = designToEnvelopeText({ id: 'd1', name: 'Plan' }, [tab], 7);
    const parsed = parseDesignEnvelope(text);
    expect(parsed).toEqual({ ok: true, envelope: JSON.parse(text) as unknown });
  });

  it('names each failure', () => {
    expect(parseDesignEnvelope('nope')).toEqual({ ok: false, failure: 'not_json' });
    expect(parseDesignEnvelope('{"kind":"livedesign.tab","schemaVersion":1}')).toEqual({
      ok: false,
      failure: 'wrong_kind',
    });
    expect(parseDesignEnvelope('{"kind":"livedesign.design","schemaVersion":2}')).toEqual({
      ok: false,
      failure: 'unsupported_version',
    });
    expect(
      parseDesignEnvelope(
        '{"kind":"livedesign.design","schemaVersion":1,"design":{"id":"d","name":"n","tabs":[{"id":1}]}}',
      ),
    ).toEqual({ ok: false, failure: 'malformed' });
    expect(parseDesignEnvelope('null')).toEqual({ ok: false, failure: 'malformed' });
  });

  // docs/specs/012-collaboration/presentation-mode.md "Saved data": a file written while livedesign had slide
  // decks still reads, its deck left behind.
  it('reads an older file that carries a slide deck, without the deck', () => {
    const older = {
      kind: DESIGN_ENVELOPE_KIND,
      schemaVersion: 1,
      exportedAt: 1,
      design: { id: 'd', name: 'n', presentation: '{"decks":[{"slides":[]}]}', tabs: [tab] },
    };
    expect(parseDesignEnvelope(JSON.stringify(older))).toEqual({
      ok: true,
      envelope: { ...older, design: { id: 'd', name: 'n', tabs: [tab] } },
    });
  });
});

describe('copyDesignEnvelope', () => {
  it('mints fresh tab ids and re-points tab links at them', () => {
    const text = designToEnvelopeText(
      { id: 'D', name: 'Logo' },
      [
        {
          id: 't1',
          name: 'One',
          elements: [
            {
              id: 'b',
              type: 'shape',
              shape: 'square',
              x: 0,
              y: 0,
              width: 1,
              height: 1,
              link: { kind: 'tab', tabId: 't2' },
            },
          ] as EnvelopeTab['elements'],
        },
        { id: 't2', name: 'Two', elements: [] },
      ],
      1,
    );
    const parsed = parseDesignEnvelope(text);
    if (!parsed.ok) throw new Error(parsed.failure);
    const { tabs, tabIds } = copyDesignEnvelope(parsed.envelope);
    expect(tabs.map((t) => t.id)).not.toContain('t1');
    const second = tabs[1]!.id;
    expect((tabs[0]!.elements[0] as { link?: { tabId: string } }).link?.tabId).toBe(second);
    // Each file id to its copy's, for what else names a tab (the file's rules).
    expect([...tabIds]).toEqual([
      ['t1', tabs[0]!.id],
      ['t2', second],
    ]);
  });

  // docs/specs/012-collaboration/presentation-mode.md "Saved data": an older file's deck stays behind.
  it('copies an older file that carries a slide deck without the deck', () => {
    const older = JSON.stringify({
      kind: DESIGN_ENVELOPE_KIND,
      schemaVersion: 1,
      exportedAt: 1,
      design: { id: 'D', name: 'L', presentation: '{"decks":[]}', tabs: [tab] },
    });
    const parsed = parseDesignEnvelope(older);
    if (!parsed.ok) throw new Error(parsed.failure);
    expect(copyDesignEnvelope(parsed.envelope)).not.toHaveProperty('presentation');
  });
});

// docs/specs/009-elements/components.md: the library rides beside the tabs, so an import draws the instances.
describe('the component library in the file', () => {
  const main = {
    id: 'cmp-1',
    name: 'Header',
    width: 100,
    height: 40,
    elements: [],
    updatedAt: 5,
  };

  it('writes it only when the design has one, and reads it back', () => {
    const without = JSON.parse(designToEnvelopeText({ id: 'd', name: 'n' }, [tab], 1)) as {
      design: object;
    };
    expect(without.design).not.toHaveProperty('components');
    const text = designToEnvelopeText({ id: 'd', name: 'n' }, [tab], 1, [main]);
    const parsed = parseDesignEnvelope(text);
    if (!parsed.ok) throw new Error(parsed.failure);
    expect(parsed.envelope.design.components).toEqual([main]);
    expect(copyDesignEnvelope(parsed.envelope).components).toEqual([main]);
  });

  it('leaves a malformed main behind and reads the rest', () => {
    const text = JSON.stringify({
      kind: DESIGN_ENVELOPE_KIND,
      schemaVersion: 1,
      exportedAt: 1,
      design: { id: 'd', name: 'n', tabs: [tab], components: [{ id: 'bad' }] },
    });
    const parsed = parseDesignEnvelope(text);
    if (!parsed.ok) throw new Error(parsed.failure);
    expect(parsed.envelope.design).not.toHaveProperty('components');
    expect(copyDesignEnvelope(parsed.envelope).components).toEqual([]);
  });
});

// docs/specs/013-workspace/automations.md: the design's rules ride its file, opaque here.
describe('the rules in the file', () => {
  const rules = [{ name: 'Weekly', enabled: true }];

  it('writes them only when the design has some, and reads them back as they are', () => {
    const none = JSON.parse(
      designToEnvelopeText({ id: 'd', name: 'n', automations: [] }, [tab], 1),
    ) as { design: object };
    expect(none.design).not.toHaveProperty('automations');
    const text = designToEnvelopeText({ id: 'd', name: 'n', automations: rules }, [tab], 1);
    const parsed = parseDesignEnvelope(text);
    if (!parsed.ok) throw new Error(parsed.failure);
    expect(parsed.envelope.design.automations).toEqual(rules);
  });

  it('reads anything but a list as no rules', () => {
    const odd = JSON.stringify({
      kind: DESIGN_ENVELOPE_KIND,
      schemaVersion: 1,
      exportedAt: 1,
      design: { id: 'd', name: 'n', tabs: [tab], automations: 'nope' },
    });
    const parsed = parseDesignEnvelope(odd);
    if (!parsed.ok) throw new Error(parsed.failure);
    expect(parsed.envelope.design).not.toHaveProperty('automations');
  });
});
