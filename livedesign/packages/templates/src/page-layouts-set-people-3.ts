// People and Ideas layouts, part two (docs/specs/007-editor/pages-mode.md "Layouts"): values,
// an idea board, a user persona and shout-outs. Pure builders on the shared kit, laid out in
// proportions of the page's content box so each fits every size and orientation.
import type { Element } from '@livedesign/document';
import { heading, kit, type Kit, type LayoutBox } from './page-layout-kit';
import { CROSS_ROSE, iconDisc, iconRow, TICK_GREEN } from './page-layout-parts';
import { avatar, card, clamp, eyebrow, rule, sticky } from './page-layouts-set-people-parts';

const VALUES = [
  ['heart', 'Care first', 'We ask how someone is before we ask for the update.'],
  ['eye', 'Say it plainly', 'Clear beats clever, in code, copy and conversation.'],
  ['users', 'Win together', 'Credit is shared. So are the hard days.'],
  ['zap', 'Ship and learn', 'Small steps in front of real people, every week.'],
  ['shield', 'Own it', 'If you see it, it is yours until it finds a home.'],
  ['smile', 'Make room for joy', 'Good work and a good laugh are not opposites.'],
] as const;

function values(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'What we stand for', 'Six promises we make to each other.');
  // Three across unless the page is much taller than wide (a square and a 4:5 post take three).
  const cols = H < W * 1.3 ? 3 : 2;
  const rows = VALUES.length / cols;
  const gapX = u * 6;
  const gapY = u * 4;
  const cellW = (W - gapX * (cols - 1)) / cols;
  const cellH = (H - head.top - gapY * (rows - 1)) / rows;
  const textH = u * 20;
  const d = clamp(cellH - textH - u * 3, u * 9, Math.min(u * 20, cellW * 0.4));
  const centred = { textAlignX: 'center' } as const;
  return [
    ...head.els,
    ...VALUES.flatMap(([iconId, name, line], i) => {
      const x = (i % cols) * (cellW + gapX);
      // Each value as one block, centred down its cell.
      const blockH = d + u * 3 + textH;
      const y =
        head.top + Math.floor(i / cols) * (cellH + gapY) + Math.max(0, (cellH - blockH) / 2);
      const nameY = y + d + u * 3;
      return [
        ...iconDisc(k, x + (cellW - d) / 2, y, d, iconId).els,
        k.text(x, nameY, cellW, u * 6, name, { textSize: 'lg', textBold: true, ...centred }),
        rule(k, x + (cellW - u * 8) / 2, nameY + u * 7, u * 8, u * 0.8),
        k.text(x + u, nameY + u * 9.5, cellW - u * 2, u * 10.5, line, centred),
      ];
    }),
  ];
}

const IDEAS = [
  ['No meetings before 10am', 12],
  ['Walking one-to-ones', 9],
  ['A shared playlist for the office', 7],
  ['Demo one small thing every week', 6],
  ['Breakfast on the first Monday', 4],
  ['Write the week’s goal on the wall', 3],
] as const;
// The slight turn each note is stuck on at, so the board reads as hand-made.
const TILTS = [-2.5, 1.5, -1, 2, -1.5, 1] as const;
// A note's widest, as a share of its height.
const NOTE_ASPECT = 1.35;

function ideaBoard(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'How might we fix Mondays?', 'Team brainstorm, 14 October: 41 votes.');
  const nextH = u * 18;
  const cols = W >= H * 0.9 ? 3 : 2;
  const rows = IDEAS.length / cols;
  const cellW = W / cols;
  const cellH = (H - head.top - nextH - u * 4) / rows;
  // Each note square, inset in its cell so a turned corner stays on the page.
  // Each note a little wider than tall at most, inset in its cell so a turned corner stays on the
  // page and the vote disc on its corner clears the next.
  const h = cellH - u * 6;
  const vote = clamp(h * 0.3, u * 8, u * 12);
  const w = Math.min(cellW - u * 4 - vote * 0.6, h * NOTE_ASPECT);
  return [
    ...head.els,
    ...IDEAS.flatMap(([idea, votes], i) => {
      const x = (i % cols) * cellW + (cellW - w) / 2;
      const y = head.top + Math.floor(i / cols) * cellH + (cellH - h) / 2;
      return [
        sticky(k, x, y, w, h, idea, {
          rotation: TILTS[i],
          textSize: h > u * 28 && w > u * 34 ? 'lg' : 'md',
          textAlignX: 'center',
          textAlignY: 'middle',
          textBold: i === 0,
        }),
        // The votes it drew, in a disc stuck over its bottom corner.
        k.shape('circle', x + w - vote * 0.7, y + h - vote * 0.7, vote, vote, {
          label: `${votes}`,
          textBold: true,
          textSize: 'lg',
        }),
      ];
    }),
    k.callout(0, H - nextH, W, nextH, {
      pageTitle: 'Next step',
      label: 'Trial the top two for a month, then vote again on 14 November.',
      textSize: 'md',
    }),
  ];
}

const GOALS = [
  'See the whole week at a glance',
  'Share plans without chasing replies',
  'Spend Fridays on real work, not admin',
] as const;
const PAINS = [
  'Updates scattered across email and chat',
  'Tools her team will not open',
  'Meetings that could have been a note',
] as const;
const TRAITS = [
  ['Confidence with tech', 70],
  ['Time to learn new tools', 25],
] as const;

function persona(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  // A list under its heading: an icon beside each line, the rows sharing the height given.
  const list = (
    x: number,
    y: number,
    w: number,
    h: number,
    title: string,
    lines: readonly string[],
    iconId: string,
    iconColor: string,
  ) => {
    const rowH = (h - u * 9) / lines.length;
    // Roomy rows (a tall page) set their lines a size up.
    const roomy = rowH >= u * 20 && w > u * 40;
    const icon = Math.min(roomy ? u * 8 : u * 6, rowH * 0.5);
    return [
      k.text(x, y, w, u * 7, title, { textSize: 'lg', textBold: true }),
      ...lines.flatMap((line, i) =>
        iconRow(k, x, y + u * 9 + i * rowH + (rowH - icon) / 2 - u, w, icon, iconId, line, {
          iconColor,
          lineH: rowH,
          textSize: roomy ? 'lg' : 'md',
        }),
      ),
    ];
  };
  const traits = (x: number, y: number, w: number) =>
    TRAITS.flatMap(([name, pct], i) => {
      const ty = y + i * u * 13;
      return [
        k.text(x, ty, w, u * 6, name, { textBold: true }),
        k.shape('progress-bar', x, ty + u * 7, w, u * 4, { progress: pct }),
      ];
    });
  const quote = (x: number, y: number, w: number, h: number) =>
    k.shape('speech-bubble', x, y, w, h, {
      label: '“I just need everyone looking at the same plan.”',
      textSize: 'lg',
      textItalic: true,
    });
  const who = (x: number, y: number, w: number) => [
    eyebrow(k, x, y, w, 'USER PERSONA'),
    k.title(x, y + u * 7, w, u * 12, 'Priya Shah'),
    k.text(x, y + u * 20, w, u * 10, '34 · Operations lead · Bristol'),
  ];
  // Wide or not much taller than wide: the person down the left; goals and frustrations side by
  // side, the traits under them.
  if (k.wide || H < W * 1.3) {
    const leftW = W * 0.34;
    const d = Math.min(leftW * 0.6, H * 0.34);
    const x = leftW + u * 8;
    const colGap = u * 6;
    const colW = (W - x - colGap) / 2;
    const traitsY = H - u * 24;
    return [
      avatar(k, 0, 0, d),
      ...who(0, d + u * 4, leftW),
      quote(0, d + u * 37, leftW, H - d - u * 37),
      ...list(x, 0, colW, traitsY - u * 6, 'Goals', GOALS, 'check-circle', TICK_GREEN),
      ...list(
        x + colW + colGap,
        0,
        colW,
        traitsY - u * 6,
        'Frustrations',
        PAINS,
        'alert-triangle',
        CROSS_ROSE,
      ),
      rule(k, x, traitsY - u * 3, W - x, u * 0.6),
      ...traits(x, traitsY, W - x),
    ];
  }
  // Tall: the photo beside who she is, her words, then goals and frustrations and her traits.
  const d = Math.min(W * 0.34, u * 34);
  const x = d + u * 6;
  const quoteY = Math.max(d, u * 28) + u * 6;
  const quoteH = clamp(H * 0.14, u * 18, u * 26);
  const listsY = quoteY + quoteH + u * 6;
  const traitsY = H - u * 24;
  const colGap = u * 6;
  const colW = (W - colGap) / 2;
  return [
    avatar(k, 0, 0, d),
    ...who(x, Math.max(0, (d - u * 30) / 2), W - x),
    quote(0, quoteY, W, quoteH),
    ...list(0, listsY, colW, traitsY - listsY - u * 4, 'Goals', GOALS, 'check-circle', TICK_GREEN),
    ...list(
      colW + colGap,
      listsY,
      colW,
      traitsY - listsY - u * 4,
      'Frustrations',
      PAINS,
      'alert-triangle',
      CROSS_ROSE,
    ),
    ...traits(0, traitsY, W),
  ];
}

const KUDOS = [
  ['To Grace, from Owen', 'Your bug write-ups are so clear they practically fix themselves.'],
  ['To Kofi, from Ines', 'Thank you for covering my launch week. I owe you a cake.'],
  ['To Night Ops, from Hannah', 'Two outages, zero drama. You are heroes.'],
] as const;

function shoutOuts(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Shout-outs', 'October’s thank-yous, from all of us.');
  const avail = H - head.top;
  const gap = u * 4;
  const pad = u * 5;
  const HERO_WORDS = u * 42;
  const reason = 'Stayed late three nights to get the Leeds clinic live, and made it look easy.';
  // The colleague of the month: a photo with an award disc on its corner, the name and why.
  const hero = (x: number, y: number, w: number, h: number, beside: boolean) => {
    // The words under (or beside) the photo: eyebrow, name, role and why, WORDS_H tall.
    const d = beside
      ? Math.min(h - pad * 2, w * 0.36)
      : Math.min(w - pad * 2, h - pad * 2 - u * 4 - HERO_WORDS, u * 40);
    const award = d * 0.36;
    const px = beside ? x + pad : x + (w - d) / 2;
    const py = beside ? y + (h - d) / 2 : y + pad;
    const tx = beside ? px + d + u * 6 : x + pad;
    const tw = beside ? x + w - pad - tx : w - pad * 2;
    const ty = beside ? y + (h - HERO_WORDS) / 2 : py + d + u * 4;
    const align = beside ? {} : ({ textAlignX: 'center' } as const);
    return [
      card(k, x, y, w, h),
      avatar(k, px, py, d),
      ...iconDisc(k, px + d - award * 0.8, py + d - award * 0.9, award, 'award').els,
      { ...eyebrow(k, tx, ty, tw, 'COLLEAGUE OF THE MONTH'), ...align },
      { ...k.title(tx, ty + u * 7, tw, u * 11, 'Femi Adebayo'), ...align },
      k.text(tx, ty + u * 19, tw, u * 6, 'Support lead', align),
      k.text(tx, ty + u * 26, tw, HERO_WORDS - u * 26, reason, align),
    ];
  };
  // A thank-you on a card: a heart, who it is to and from, and what it says.
  const notes = (x: number, y: number, w: number, h: number) => {
    const noteH = (h - gap * (KUDOS.length - 1)) / KUDOS.length;
    const icon = Math.min(u * 8, noteH * 0.4);
    return KUDOS.flatMap(([who, line], i) => {
      const ny = y + i * (noteH + gap);
      const tx = x + pad + icon + u * 4;
      const tw = x + w - pad - tx;
      const top = ny + Math.max(u, (noteH - u * 16) / 2);
      const lineH = Math.min(u * 10, ny + noteH - top - u * 7);
      return [
        card(k, x, ny, w, noteH),
        k.shape('icon', x + pad, top, icon, icon, { iconId: 'heart' }),
        k.text(tx, top, tw, u * 6, who, { textBold: true }),
        k.text(tx, top + u * 6, tw, lineH, line),
      ];
    });
  };
  // Wide or not much taller than wide: the colleague of the month down the left, the notes beside.
  if (k.wide || H < W * 1.3) {
    const heroW = W * 0.46;
    return [
      ...head.els,
      ...hero(0, head.top, heroW, avail, false),
      ...notes(heroW + gap, head.top, W - heroW - gap, avail),
    ];
  }
  const heroH = clamp(avail * 0.42, HERO_WORDS + pad * 2, u * 80);
  const beside = heroH < W * 0.9;
  return [
    ...head.els,
    ...hero(0, head.top, W, heroH, beside),
    ...notes(0, head.top + heroH + gap, W, avail - heroH - gap),
  ];
}

export const buildValues = (b: LayoutBox) => values(kit(b));
export const buildIdeaBoard = (b: LayoutBox) => ideaBoard(kit(b));
export const buildPersona = (b: LayoutBox) => persona(kit(b));
export const buildShoutOuts = (b: LayoutBox) => shoutOuts(kit(b));
