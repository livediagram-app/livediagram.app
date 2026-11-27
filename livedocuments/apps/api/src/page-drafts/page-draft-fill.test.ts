import { describe, expect, it } from 'vitest';
import { draftCatalogue, HEADING_MAX, SLOT_TEXT_MAX, type CatalogueEntry } from './page-draft-asks';
import { fillLayoutRequest, readLayoutFill } from './page-draft-fill';

// docs/specs/007-editor/describe-a-page.md "Every kind" and "Cards written whole": the words for a laid-out page, each
// loose slot by its name and each card as one object, read back as data into the layout's own slots.
const userText = (r: { messages: { content: unknown }[] }) => String(r.messages[0]!.content);
const entry = (kind: 'slide' | 'infographic', id: string): CatalogueEntry =>
  draftCatalogue(kind).find((l) => l.id === id)!;
const agenda = () => entry('slide', 'agenda');
const facts = () => entry('infographic', 'facts-grid');
const keyStats = () => entry('slide', 'key-stats');
const kpi = () => entry('slide', 'kpi-dashboard');
const tabled = () =>
  draftCatalogue('infographic').find((l) => l.samples.some((s) => s.slot === 'table'))!;

describe('the ask', () => {
  it('lists a layout’s slots with their roles and samples, and the shape to answer in', () => {
    const r = fillLayoutRequest('slide', agenda(), 'Offsite agenda');
    const text = userText(r);
    for (const s of agenda().samples) expect(text).toContain(`${s.slot}`);
    expect(r.system).toContain(`"${agenda().label}"`);
    expect(r.system).toContain('whatever its name');
    expect(text).toContain('"title": "..."');
    // No cards on an agenda: none asked for.
    expect(text).not.toContain('<cards>');
    expect(r.system).not.toContain('cards are listed apart');
  });

  it('names a table by its header row and asks for its rows', () => {
    const text = userText(fillLayoutRequest('infographic', tabled(), 'Pricing'));
    expect(text).toContain('table (its header row): "');
    expect(text).toContain('"table": [[');
  });

  it('asks for a card layout’s cards as objects, never their slots one by one', () => {
    const r = fillLayoutRequest('infographic', facts(), 'Bees');
    const text = userText(r);
    expect(text).toContain("body[0] (the page's heading, at the top");
    expect(text).toContain('Up to 6, in reading order');
    expect(text).toContain(
      '{&quot;figure&quot;:&quot;12k&quot;,&quot;caption&quot;:&quot;People reached&quot;}',
    );
    expect(text).toContain('"cards": [{...}, ...]');
    // A card's own slots are not listed alone.
    expect(text).not.toContain('figures[0] (');
    expect(text).not.toContain('subtitle (');
    expect(r.system).toContain('Each card shows a different number');
    // A KPI's card: its label, value and change.
    expect(userText(fillLayoutRequest('slide', kpi(), 'Q3 against Q2'))).toContain(
      '{&quot;label&quot;:&quot;Revenue&quot;,&quot;value&quot;:&quot;£2.4M&quot;,&quot;delta&quot;:&quot;+18%&quot;}',
    );
  });
});

describe('the reply', () => {
  it('writes only the slots the layout has, cut and with no stray link', () => {
    const layout = agenda();
    const bodies = layout.slots.filter((s) => s.slot?.startsWith('body[')).length;
    const reply = JSON.stringify({
      title: `  The\nOffsite  ${'x'.repeat(HEADING_MAX)}`,
      subtitle: 'See https://evil.example/now and https://ok.example',
      'body[0]': 'Welcome',
      bullets: ['not on this layout'],
      table: [['a']],
      extra: 'dropped',
    });
    const out = readLayoutFill(layout, reply, 'Use https://ok.example')!.text;
    expect(out.title!.startsWith('The Offsite x')).toBe(true);
    expect(out.title!.length).toBe(HEADING_MAX);
    expect(out.title!.endsWith('…')).toBe(true);
    expect(out.subtitle).toBe('See and https://ok.example');
    expect(out.body).toHaveLength(bodies);
    expect(out.body![0]).toBe('Welcome');
    expect(out).not.toHaveProperty('bullets');
    expect(out).not.toHaveProperty('table');
    expect(out).not.toHaveProperty('extra');
  });

  it('reads a reply written in lists into the loose slots in their order', () => {
    const layout = agenda();
    const bodies = layout.slots.filter((s) => s.slot?.startsWith('body[')).length;
    const out = readLayoutFill(
      layout,
      JSON.stringify({
        title: 'Offsite',
        body: Array.from({ length: bodies + 3 }, (_, i) => `Item ${i}`),
      }),
      'p',
    )!.text;
    expect(out.body).toEqual(Array.from({ length: bodies }, (_, i) => `Item ${i}`));
  });

  it('keeps a table’s rows on a layout with one, each cell cut to size, and leaves a bad one out', () => {
    const out = readLayoutFill(
      tabled(),
      JSON.stringify({
        title: 'Plans',
        table: [
          ['Plan', 'Price'],
          ['Pro', 'y'.repeat(SLOT_TEXT_MAX + 10)],
        ],
      }),
      'p',
    )!.text;
    expect(out.table![0]).toEqual(['Plan', 'Price']);
    expect(out.table![1]![1]!.length).toBe(SLOT_TEXT_MAX);
    const bad = readLayoutFill(tabled(), JSON.stringify({ title: 'Plans', table: 'rows' }), 'p')!;
    expect(bad.text).not.toHaveProperty('table');
  });

  it('answers null for no JSON, a slot of the wrong shape, or nothing usable', () => {
    expect(readLayoutFill(agenda(), 'no json', 'p')).toBeNull();
    expect(readLayoutFill(agenda(), '{"title": 4}', 'p')).toBeNull();
    expect(readLayoutFill(agenda(), '{"title": "  ", "body": [""]}', 'p')).toBeNull();
    expect(readLayoutFill(agenda(), '{"nothing": "here"}', 'p')).toBeNull();
  });
});

describe('cards written whole', () => {
  it('maps each card’s figure and caption back to that card’s slots, on a facts grid', () => {
    const read = readLayoutFill(
      facts(),
      JSON.stringify({
        'body[0]': 'Honey Bees',
        'body[1]': 'Small, busy, vital',
        cards: [
          { figure: '20,000', caption: 'Bee species' },
          { figure: '50k', caption: 'Bees in a hive' },
          { figure: '6 weeks', caption: 'A worker’s life' },
          { figure: '1/3', caption: 'Of food needs pollinators' },
        ],
      }),
      'bees',
    )!;
    // Card 3's figure and caption are the layout's title and subtitle slots.
    expect(read.text.figures).toEqual(['20,000', '50k', '1/3', '', '']);
    expect(read.text.title).toBe('6 weeks');
    expect(read.text.subtitle).toBe('A worker’s life');
    expect(read.text.body).toEqual([
      'Honey Bees',
      'Small, busy, vital',
      'Bee species',
      'Bees in a hive',
      'Of food needs pollinators',
      '',
      '',
    ]);
    // Named by its heading, never a card's number.
    expect(read.name).toBe('Honey Bees');
    expect(read.duplicates).toBe(0);
  });

  it('drops a card with an empty half and a card repeating a figure, counting the repeat', () => {
    const read = readLayoutFill(
      facts(),
      JSON.stringify({
        'body[0]': 'Bees',
        cards: [
          { figure: '50k', caption: 'Bees in a hive' },
          { figure: '20,000', caption: '' },
          { figure: '', caption: 'Flowers a day' },
          { figure: '50 K', caption: 'Same number again' },
          { figure: 'N/A', caption: 'Hives lost' },
          { figure: '6 weeks', caption: 'A worker’s life' },
          'not a card',
          ['nor this'],
        ],
      }),
      'bees',
    )!;
    expect(read.text.figures).toEqual(['50k', '6 weeks', '', '', '']);
    expect(read.text.body!.slice(2)).toEqual(['Bees in a hive', 'A worker’s life', '', '', '']);
    expect(read.text.title).toBe('');
    expect(read.duplicates).toBe(1);
    expect(read.placeholders).toBe(1);
    // No heading written: no name, never a card's number.
    expect(
      readLayoutFill(facts(), JSON.stringify({ cards: [{ figure: '9', caption: 'x' }] }), 'p')!
        .name,
    ).toBeNull();
  });

  it('fills a KPI card’s label, value and change, a missing change left for the page to drop', () => {
    const read = readLayoutFill(
      kpi(),
      JSON.stringify({
        title: 'Q3',
        cards: [
          { label: 'Revenue', value: '£3.1M', delta: '+12%' },
          { label: 'Users', figure: '91k' },
          { value: '4%', delta: '+1' },
        ],
      }),
      'Q3 against Q2',
    )!.text;
    expect(read.body!.slice(0, 2)).toEqual(['Revenue', 'Users']);
    expect(read.figures!.slice(0, 4)).toEqual(['£3.1M', '+12%', '91k', '']);
    // The third card had no label: dropped with the fourth.
    expect(read.figures!.slice(4)).toEqual(['', '', '']);
  });

  it('spreads four stats evenly over a layout’s two stat rows', () => {
    const read = readLayoutFill(
      keyStats(),
      JSON.stringify({
        title: 'Our Year',
        cards: [
          { figure: '12k', caption: 'Customers' },
          { figure: '94%', caption: 'Would recommend' },
          { figure: '48', caption: 'Countries' },
          { figure: '1.4M', caption: 'Orders' },
        ],
      }),
      'p',
    )!.text;
    expect(read.figures).toEqual(['12k', '94%', '', '48', '1.4M', '']);
    expect(read.body!.slice(0, 6)).toEqual([
      'Customers',
      'Would recommend',
      '',
      'Countries',
      'Orders',
      '',
    ]);
  });

  it('drops bracket placeholders, N/A and TBD in the loose slots and the cards, and counts them', () => {
    const out = readLayoutFill(
      keyStats(),
      JSON.stringify({
        title: 'Key Metric: [Insert number here]',
        subtitle: 'TBD',
        cards: [
          { figure: '12k', caption: 'Customers' },
          { figure: 'XX%', caption: 'Lorem ipsum dolor' },
        ],
      }),
      'p',
    )!;
    expect(out.text.title).toBe('');
    expect(out.text.subtitle).toBe('');
    expect(out.text.figures![0]).toBe('12k');
    expect(out.placeholders).toBe(4);
    // Nothing but a title: the title names the page.
    expect(readLayoutFill(keyStats(), JSON.stringify({ title: 'Our Year' }), 'p')!.name).toBe(
      'Our Year',
    );
  });
});
