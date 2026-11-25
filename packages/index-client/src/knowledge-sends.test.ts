import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  KNOWLEDGE_SEND_ITEMS_MAX,
  KNOWLEDGE_SEND_LINKS_MAX,
  KNOWLEDGE_SEND_PICTURE_BASE64_MAX,
  KNOWLEDGE_SEND_TEXT_MAX,
  knowledgeSelectionText,
  knowledgeSendDoorPath,
  knowledgeSendFallback,
  knowledgeSentFromLine,
  readAgentKnowledgeSend,
  readKnowledgeSendAsk,
  readKnowledgeSendDoorCall,
  readKnowledgeSendSelection,
  type KnowledgeSendSelection,
} from './knowledge-sends';

const selection: KnowledgeSendSelection = {
  items: [
    { id: 'f', kind: 'frame', label: 'Checkout' },
    { id: 'a', kind: 'rectangle', label: 'Cart', in: 'f' },
    { id: 'b', kind: 'sticky', label: 'Charge card', note: 'Stripe, retries twice', in: 'f' },
  ],
  links: [
    { from: 'a', to: 'b', label: 'pay' },
    { from: 'b', to: null },
  ],
};

describe('readKnowledgeSendSelection', () => {
  it('reads a selection and keeps frames, notes and arrows', () => {
    expect(readKnowledgeSendSelection(selection)).toEqual(selection);
  });

  it('refuses a selection with no item', () => {
    expect(readKnowledgeSendSelection({ items: [], links: [] })).toBeNull();
    expect(readKnowledgeSendSelection(null)).toBeNull();
    expect(readKnowledgeSendSelection({ items: [{ label: 'no id' }] })).toBeNull();
  });

  it('keeps a repeated id once, squashes whitespace and drops an unknown frame', () => {
    const read = readKnowledgeSendSelection({
      items: [
        { id: 'a', kind: 'sticky', label: '  two\n\nlines  ', in: 'gone' },
        { id: 'a', kind: 'sticky', label: 'again' },
        'not an item',
      ],
    });
    expect(read).toEqual({ items: [{ id: 'a', kind: 'sticky', label: 'two lines' }], links: [] });
  });

  it('reads an arrow end that names no item as outside, and drops an arrow with neither end', () => {
    const read = readKnowledgeSendSelection({
      items: [{ id: 'a', kind: 'shape', label: 'A' }],
      links: [{ from: 'a', to: 'secret-shape', label: 'x' }, { from: 'q', to: 'r' }, 'nope'],
    });
    expect(read?.links).toEqual([{ from: 'a', to: null, label: 'x' }]);
  });

  it('cuts to the item, arrow and character caps and says so', () => {
    const items = Array.from({ length: KNOWLEDGE_SEND_ITEMS_MAX + 5 }, (_, i) => ({
      id: `e${i}`,
      kind: 'shape',
      label: `Box ${i}`,
    }));
    const links = Array.from({ length: KNOWLEDGE_SEND_LINKS_MAX + 5 }, () => ({
      from: 'e0',
      to: 'e1',
    }));
    const read = readKnowledgeSendSelection({ items, links })!;
    expect(read.items).toHaveLength(KNOWLEDGE_SEND_ITEMS_MAX);
    expect(read.links).toHaveLength(KNOWLEDGE_SEND_LINKS_MAX);
    expect(read.cut).toBe(true);
    const long = Array.from({ length: 60 }, (_, i) => ({
      id: `n${i}`,
      kind: 'sticky',
      label: 'x'.repeat(300),
    }));
    const text = readKnowledgeSendSelection({ items: long })!;
    const total = text.items.reduce((n, i) => n + i.label.length + i.kind.length, 0);
    expect(total).toBeLessThanOrEqual(KNOWLEDGE_SEND_TEXT_MAX);
    expect(text.cut).toBe(true);
  });

  it('reads a huge label in linear time', () => {
    const label = ' a'.repeat(200_000);
    expect(
      cpuMsOf(() => readKnowledgeSendSelection({ items: [{ id: 'a', kind: 'k', label }] })),
    ).toBeLessThan(200);
  });
});

describe('knowledgeSelectionText', () => {
  it('numbers items, names frames and arrows, and never names an outside end', () => {
    expect(knowledgeSelectionText(selection)).toBe(
      [
        'Items:',
        '[1] frame "Checkout"',
        '[2] rectangle "Cart" inside [1]',
        '[3] sticky "Charge card" (note: "Stripe, retries twice") inside [1]',
        '',
        'Arrows:',
        '[2] -> [3] "pay"',
        '[3] -> something outside the selection',
      ].join('\n'),
    );
  });

  it('leaves out the arrows heading when there are none, and quotes a label with quotes', () => {
    expect(
      knowledgeSelectionText({ items: [{ id: 'a', kind: 'text', label: 'say "hi"' }], links: [] }),
    ).toBe('Items:\n[1] text "say \'hi\'"');
  });
});

describe('knowledgeSendFallback', () => {
  it('lists labels, nests a frame, escapes Markdown and counts arrows', () => {
    expect(
      knowledgeSendFallback({
        items: [
          ...selection.items,
          { id: 'c', kind: 'arrow', label: '' },
          { id: 'd', kind: 'text', label: '# not [a] heading' },
        ],
        links: selection.links,
      }),
    ).toBe(
      [
        '- Checkout',
        '  - Cart',
        '  - Charge card: Stripe, retries twice',
        '- An arrow',
        '- \\# not \\[a\\] heading',
        '',
        '2 arrows connect them.',
      ].join('\n'),
    );
  });

  it('says one arrow, and nothing when there are none', () => {
    expect(
      knowledgeSendFallback({
        items: [{ id: 'a', kind: 'shape', label: 'A' }],
        links: [{ from: 'a', to: null }],
      }),
    ).toBe('- A\n\n1 arrow connects them.');
    expect(
      knowledgeSendFallback({ items: [{ id: 'a', kind: 'shape', label: '' }], links: [] }),
    ).toBe('- A shape');
  });
});

const source = { app: 'livediagram', itemId: 'doc1', tabId: 't1', elementIds: ['a', 'b', 'a'] };

describe('readKnowledgeSendAsk', () => {
  const ask = {
    knowledgebase: 'kb1',
    place: { page: 'p1', after: 'h1' },
    heading: '  Checkout  ',
    markdown: 'Words',
    picture: { png: 'iVBOR', width: 10, height: 20 },
    source,
  };

  it('reads an ask to an existing page under a heading', () => {
    expect(readKnowledgeSendAsk(ask)).toEqual({
      ...ask,
      heading: 'Checkout',
      source: { ...source, elementIds: ['a', 'b'] },
    });
  });

  it('reads a new page and no picture', () => {
    const read = readKnowledgeSendAsk({
      ...ask,
      place: { newPage: { title: 'Payments', parent: null } },
      picture: undefined,
    });
    expect(read?.place).toEqual({ newPage: { title: 'Payments', parent: null } });
    expect(read?.picture).toBeUndefined();
  });

  it('refuses what does not read', () => {
    expect(readKnowledgeSendAsk(null)).toBeNull();
    expect(readKnowledgeSendAsk({ ...ask, markdown: '  ' })).toBeNull();
    expect(readKnowledgeSendAsk({ ...ask, markdown: 'x'.repeat(20_000) })).toBeNull();
    expect(readKnowledgeSendAsk({ ...ask, place: { newPage: { title: '' } } })).toBeNull();
    expect(readKnowledgeSendAsk({ ...ask, place: { page: 'p', after: 5 } })).toBeNull();
    expect(readKnowledgeSendAsk({ ...ask, place: {} })).toBeNull();
    expect(readKnowledgeSendAsk({ ...ask, source: { ...source, app: 'nope' } })).toBeNull();
    expect(readKnowledgeSendAsk({ ...ask, source: { ...source, elementIds: [] } })).toBeNull();
    expect(readKnowledgeSendAsk({ ...ask, source: { ...source, elementIds: 'a' } })).toBeNull();
    expect(
      readKnowledgeSendAsk({
        ...ask,
        picture: { png: 'x'.repeat(KNOWLEDGE_SEND_PICTURE_BASE64_MAX + 1), width: 1, height: 1 },
      }),
    ).toBeNull();
    expect(readKnowledgeSendAsk({ ...ask, picture: { png: 'x', width: 0, height: 1 } })).toBeNull();
    expect(readKnowledgeSendAsk({ ...ask, picture: 'x' })).toBeNull();
  });
});

describe('readKnowledgeSendDoorCall', () => {
  const sentFrom = {
    app: 'livediagram',
    title: 'Payments',
    link: 'https://livediagram.app/d/1#t=t',
  };

  it('reads an outline and a write', () => {
    expect(readKnowledgeSendDoorCall({ op: 'outline', person: 'user_1', page: 'p1' })).toEqual({
      op: 'outline',
      person: 'user_1',
      page: 'p1',
    });
    expect(
      readKnowledgeSendDoorCall({
        op: 'write',
        person: 'user_1',
        place: { page: 'p1' },
        heading: '',
        markdown: 'Hi',
        sentFrom,
      }),
    ).toEqual({
      op: 'write',
      person: 'user_1',
      place: { page: 'p1' },
      heading: '',
      markdown: 'Hi',
      sentFrom,
    });
  });

  it('refuses a call that does not read', () => {
    expect(readKnowledgeSendDoorCall({ op: 'outline', page: 'p1' })).toBeNull();
    expect(readKnowledgeSendDoorCall({ op: 'outline', person: 'u' })).toBeNull();
    expect(readKnowledgeSendDoorCall({ op: 'other', person: 'u' })).toBeNull();
    expect(readKnowledgeSendDoorCall('x')).toBeNull();
    const write = { op: 'write', person: 'u', place: { page: 'p' }, markdown: 'm', sentFrom };
    expect(
      readKnowledgeSendDoorCall({
        ...write,
        sentFrom: { ...sentFrom, link: 'javascript:alert(1)' },
      }),
    ).toBeNull();
    expect(readKnowledgeSendDoorCall({ ...write, sentFrom: null })).toBeNull();
    expect(readKnowledgeSendDoorCall({ ...write, markdown: '' })).toBeNull();
  });

  it('names its door', () => {
    expect(knowledgeSendDoorPath('kb 1')).toBe('/api/internal/items/kb%201/knowledge-send');
  });
});

describe('readAgentKnowledgeSend', () => {
  it('reads an agent send with or without a tab and elements', () => {
    expect(
      readAgentKnowledgeSend({
        person: 'user_1',
        source: { app: 'livediagram', itemId: 'd' },
        page: { id: 'p', title: 'Page' },
      }),
    ).toEqual({
      person: 'user_1',
      source: { app: 'livediagram', itemId: 'd', tabId: null, elementIds: [] },
      page: { id: 'p', title: 'Page' },
    });
    expect(
      readAgentKnowledgeSend({ person: 'u', source: { ...source }, page: { id: 'p' } })?.source
        .elementIds,
    ).toEqual(['a', 'b']);
  });

  it('refuses what does not read', () => {
    expect(
      readAgentKnowledgeSend({ person: 'u', source: { app: 'x', itemId: 'd' }, page: { id: 'p' } }),
    ).toBeNull();
    expect(
      readAgentKnowledgeSend({ person: 'u', source: { app: 'livediagram' }, page: { id: 'p' } }),
    ).toBeNull();
    expect(readAgentKnowledgeSend({ person: 'u', source: {}, page: {} })).toBeNull();
    expect(readAgentKnowledgeSend(null)).toBeNull();
  });
});

describe('knowledgeSentFromLine', () => {
  it('links the title back and escapes it', () => {
    expect(
      knowledgeSentFromLine({
        app: 'livediagram',
        title: 'Pay [v2]',
        link: 'https://x.app/d/1#t=a&el=b',
      }),
    ).toBe('Sent from [Pay \\[v2\\]](https://x.app/d/1#t=a&el=b) in livediagram');
  });
});
