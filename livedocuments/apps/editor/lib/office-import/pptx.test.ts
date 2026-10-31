import { describe, expect, it } from 'vitest';
import { OfficeImportError } from './errors';
import { openOfficePackage } from './package';
import { readPptx, type SlideTextItem } from './pptx';
import {
  ap,
  googleSlidesSampleDeck,
  makePptx,
  pic,
  powerPointSampleDeck,
  sp,
  xfrm,
  type DeckOptions,
} from './test-fixtures';

const read = async (opts: DeckOptions) =>
  readPptx(await openOfficePackage(await makePptx(opts), 'powerpoint'));

describe('readPptx, a PowerPoint deck', () => {
  it('reads each slide: placeholders through their layout and master, pictures, groups, notes, hidden', async () => {
    const deck = await readPptx(
      await openOfficePackage(await powerPointSampleDeck(), 'powerpoint'),
    );
    expect(deck.cx).toBe(12192000);
    expect(deck.cy).toBe(6858000);
    expect(deck.slides).toHaveLength(3);

    const [title, sub] = deck.slides[0]!.items as SlideTextItem[];
    // The title slide's placeholders take the title layout's box, size, alignment and anchor.
    expect(title).toMatchObject({
      label: 'Quarterly Review',
      box: { x: 1524000, y: 1122363, cx: 9144000, cy: 2387600 },
      sizePt: 60,
      alignY: 'bottom',
    });
    // The subtitle is a body placeholder whose layout's list style turns bullets off.
    expect(sub).toMatchObject({ label: 'Team update', sizePt: 24 });
    expect(deck.slides[0]!.notes).toBe('Welcome everyone.\nKeep it short.');

    const items = deck.slides[1]!.items;
    expect(items.map((i) => i.kind)).toEqual(['text', 'text', 'picture', 'text']);
    // Layout 2's placeholders have no box: the master's.
    expect(items[0]).toMatchObject({
      label: 'Results',
      box: { x: 838200, y: 365125 },
      sizePt: 44,
      alignY: 'middle',
    });
    expect((items[1] as SlideTextItem).label).toBe(
      '• Revenue up\n  • In every region\n\nNo bullet here',
    );
    expect((items[1] as SlideTextItem).sizePt).toBe(28);
    expect(items[2]).toMatchObject({
      kind: 'picture',
      box: { x: 6096000, y: 1825625, cx: 4000000, cy: 3000000 },
      picture: {
        path: 'ppt/media/image1.png',
        cropped: true,
        alt: 'Sales chart',
        widthPx: 420,
        heightPx: 315,
      },
    });
    // The group's member, mapped through the group's half-size transform.
    expect(items[3]).toMatchObject({
      label: 'In a group',
      box: { x: 1000000, y: 5000000, cx: 2000000, cy: 1000000 },
      bold: true,
      sizePt: 18,
    });
    expect(deck.slides[1]!.notes).toBe('Pause for questions.');

    const hidden = deck.slides[2]!;
    expect(hidden.hidden).toBe(true);
    expect(hidden.items).toHaveLength(1);
    expect(hidden.items[0]).toMatchObject({
      label: '1. First\n2. Second',
      sizePt: 20,
      alignY: 'middle',
    });
    expect(deck.pictures).toHaveLength(1);
    expect(deck.tally).toEqual({ tables: 1, shapes: 1, media: 1 });
  });
});

describe('readPptx, a Google Slides download', () => {
  it('reads its own boxes, explicit bullets and its 16:9 size', async () => {
    const deck = await readPptx(
      await openOfficePackage(await googleSlidesSampleDeck(), 'powerpoint'),
    );
    expect(deck.cx).toBe(9144000);
    expect(deck.cy).toBe(5143500);
    const [title, body] = deck.slides[0]!.items as SlideTextItem[];
    expect(title).toMatchObject({
      label: 'Roadmap',
      alignX: 'center',
      sizePt: 36,
      box: { x: 311700, y: 445025 },
    });
    expect(body).toMatchObject({ label: '• Discover\n• Build', sizePt: 18 });
    expect(deck.slides[0]!.notes).toBe('Talk about timing.');
  });
});

describe('readPptx, the edges', () => {
  it('refuses more slides than a tab holds, naming how many', async () => {
    try {
      await read({ slides: Array.from({ length: 101 }, () => ({ tree: '' })), noMaster: true });
      expect.unreachable();
    } catch (error) {
      expect((error as OfficeImportError).failure).toBe('too-many-slides');
      expect((error as OfficeImportError).count).toBe(101);
    }
  });

  it('counts charts, diagrams, objects, connectors, ink and linked pictures, and opens alternate content', async () => {
    const frame = (uri: string) =>
      `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="3" name="f"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><a:graphic><a:graphicData uri="${uri}"/></a:graphic></p:graphicFrame>`;
    const deck = await read({
      noMaster: true,
      slides: [
        {
          tree: [
            frame('http://schemas.openxmlformats.org/drawingml/2006/chart'),
            frame('http://schemas.openxmlformats.org/drawingml/2006/diagram'),
            frame('http://schemas.openxmlformats.org/presentationml/2006/ole'),
            '<p:contentPart r:id="ink"/>',
            pic('missing', xfrm(0, 0, 10, 10)),
            pic('ext', xfrm(0, 0, 10, 10)),
            pic('rIdImg', ''),
            sp({ box: xfrm(0, 0, 10, 10), paras: '<a:p/>' }),
            sp({ ph: '<p:ph type="body"/>', box: xfrm(0, 0, 10, 10), paras: '<a:p/>' }),
            sp({ ph: '<p:ph type="dt"/>', paras: ap('No box anywhere') }),
            `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="p14">${sp({ box: xfrm(1, 2, 3, 4), paras: ap('chosen', '', ' i="1" u="sng"') })}</mc:Choice><mc:Fallback>${sp({ box: xfrm(1, 2, 3, 4), paras: ap('fallback') })}</mc:Fallback></mc:AlternateContent>`,
          ].join(''),
          rels: [
            { id: 'rIdImg', type: 'image', target: '../media/a.png' },
            { id: 'ext', type: 'image', target: 'https://example.com/a.png', external: true },
          ],
        },
      ],
    });
    const items = deck.slides[0]!.items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      label: 'chosen',
      italic: true,
      underline: true,
      bold: false,
      alignX: 'left',
      alignY: 'top',
    });
    expect(deck.tally).toEqual({ charts: 1, diagrams: 1, embedded: 1, shapes: 2, linkedImages: 2 });
  });

  it('stops at the items a slide takes, and reads a line break, a field and auto-fit', async () => {
    const many = Array.from({ length: 302 }, (_, i) =>
      sp({ id: i + 2, box: xfrm(i, 0, 10, 10), paras: ap(`t${i}`) }),
    ).join('');
    const deck = await read({
      noMaster: true,
      slides: [
        { tree: many },
        {
          tree: sp({
            box: xfrm(0, 0, 10, 10),
            bodyPr: '><a:normAutofit fontScale="50000"/></a:bodyPr><a:bodyPr',
            paras: `<a:p><a:r><a:t>Line</a:t></a:r><a:br/><a:fld type="slidenum"><a:t>7</a:t></a:fld><a:r><a:t></a:t></a:r></a:p>`,
          }),
        },
      ],
    });
    expect(deck.slides[0]!.items).toHaveLength(300);
    expect(deck.tally.crowded).toBe(2);
    expect(deck.slides[1]!.items[0]).toMatchObject({ label: 'Line\n7', sizePt: 9, alignX: 'left' });
  });

  it('defaults the size of a deck that names none, and skips a slide the presentation cannot find', async () => {
    const bytes = await makePptx({
      noMaster: true,
      slides: [{ tree: sp({ box: xfrm(0, 0, 10, 10), paras: ap('x') }) }],
    });
    const pkg = await openOfficePackage(bytes, 'powerpoint');
    const presentation = (await pkg.readXml(pkg.mainPath))!;
    // A presentation with no size and a slide id pointing nowhere.
    presentation.children = presentation.children.filter(
      (c) => typeof c === 'string' || c.name !== 'p:sldSz',
    );
    const list = presentation.children.find(
      (c) => typeof c !== 'string' && c.name === 'p:sldIdLst',
    );
    if (list && typeof list !== 'string')
      list.children.push({ name: 'p:sldId', attrs: { 'r:id': 'nowhere' }, children: [] });
    const deck = await readPptx(pkg);
    expect(deck.cx).toBe(12192000);
    expect(deck.cy).toBe(6858000);
    expect(deck.slides).toHaveLength(1);
  });

  it('matches a layout placeholder by type when it has no index, and numbers restart after other paragraphs', async () => {
    const deck = await read({
      slides: [
        {
          tree: sp({
            ph: '<p:ph type="title"/>',
            paras: [
              ap('a', '<a:buAutoNum type="arabicPeriod"/>'),
              ap('b', '<a:buAutoNum type="arabicPeriod"/>'),
              ap('c', '<a:buChar char="-"/>'),
              ap('d', '<a:buAutoNum type="arabicPeriod"/>'),
              ap('e', ' algn="r"'),
            ].join(''),
          }),
        },
      ],
    });
    expect(deck.slides[0]!.items[0]).toMatchObject({
      label: '1. a\n2. b\n• c\n1. d\ne',
      box: { x: 838200 },
    });
  });
});
