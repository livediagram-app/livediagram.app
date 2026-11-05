import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderElementsToSvg, shade, tint, type Element, type Tab } from '@livehuddle/document';
import { buildTemplate } from '@livehuddle/templates';
import { AVATAR_DEFAULTS, configureAvatar } from '@liveworkspace/avatar/bindings';
import { AvatarSprite } from '@liveworkspace/avatar/components/avatar-sprite';
import { reactionPose } from '@liveworkspace/avatar/reactions';
import { seatPoints, type SeatedBox } from '@liveworkspace/avatar/seats';
import { avatarBox, type AvatarFacing } from '@liveworkspace/avatar/walk';
import { SpaceScene } from '@/components/hero-space-scene';
import {
  CHEER_LIFTS,
  SAY_S,
  LOOP_S,
  SPACE_AVATAR_SCALE,
  SPACE_PAPER,
  TEAM_POD,
  arrivalOf,
  castHref,
  restOf,
  roomHref,
  stillId,
  stillKeysOf,
  viewBoxOf,
  type CastMember,
  type SpaceSceneSpec,
  type StillKey,
} from '@/components/hero-space-cast';
import { HALL, OFFICE } from '@/components/hero-space-places';

// The Space feature scenes' art (docs/specs/019-marketing/marketing-site.md "Feature scenes"), written to
// public/hero/: each room is the real template, its own elements drawn by the editor's own SVG renderer once per
// appearance, and each cast is a sprite sheet of every still its scene shows, drawn by Avatar mode's own sprite. This
// test is both the generator and the guard: it fails when a committed file drifts from what the template, the
// renderer and the sprite draw today, and `HERO_SPACE_WRITE=1 vitest run lib/hero-space-room.test.tsx` writes them
// afresh.

// The shirt's shaded side in the editor's own colour maths, as the editor binds Avatar mode at startup.
configureAvatar({ ...AVATAR_DEFAULTS, shade, tint });

const SCENES: readonly SpaceSceneSpec[] = [TEAM_POD, OFFICE, HALL];
const SCHEMES = ['light', 'dark'] as const;
const publicPath = (href: string) => fileURLToPath(new URL(`../public${href}`, import.meta.url));

type Box = Element & { x: number; y: number; width: number; height: number; shape?: string };

// What a room drawing leaves out: the plan's sticker, and its Walk In button and the hint beside it, are the
// canvas's, not the scene's (the title and description sit above every stage).
const LEFT_OUT = new Set(['sticker', 'mode-button']);
const isHint = (e: Box) =>
  e.type === 'text' && /Walk In/.test((e as { label?: string }).label ?? '');

/** The template's pieces on the stage (a room cut by its edge is drawn whole and clipped by the viewBox), and the
 *  light content the scene adds. */
function roomElements(spec: SpaceSceneSpec): Element[] {
  const { x, y, width, height } = spec.stage;
  // A piece only a sliver of which would show (a row of chairs below the edge) is left out.
  const SLIVER = 24;
  const onStage = (e: Box) =>
    e.x < x + width &&
    e.x + e.width > x &&
    e.y < y + height - SLIVER &&
    e.y + e.height > y + SLIVER;
  const template = (buildTemplate(spec.template, 0, 0) as Box[])
    .filter((e) => !isHint(e) && !LEFT_OUT.has(e.shape ?? ''))
    .filter(onStage);
  const added: Element[] = [];
  const heading = spec.stickies?.heading;
  if (heading) {
    added.push({
      id: '',
      type: 'text',
      ...heading,
      height: 26,
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
    } as unknown as Element);
  }
  for (const note of spec.stickies?.notes ?? []) {
    added.push({
      id: '',
      type: 'sticky',
      x: note.x,
      y: note.y,
      width: note.size,
      height: note.size,
      textSize: 'sm',
      fillColor: note.colour,
      ...(note.text ? { label: note.text } : {}),
    } as unknown as Element);
  }
  // Fixed ids, so a drawing is the same every time it is written.
  return [...template, ...added].map((e, i) => ({ ...e, id: `${spec.id}-${i}` }));
}

/** The drawing on the stage's box with no paper of its own: the editor window's canvas shows through. */
function roomSvg(spec: SpaceSceneSpec, scheme: (typeof SCHEMES)[number]): string {
  const tab = { id: 'hero', name: spec.id, elements: roomElements(spec) } as unknown as Tab;
  const svg = renderElementsToSvg(tab, { padding: 0, background: SPACE_PAPER[scheme] });
  const { width, height } = spec.stage;
  const open = svg.indexOf('>') + 1;
  const paper = svg.indexOf('/>', open) + 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBoxOf(spec.stage)}">` +
    svg.slice(paper) +
    '\n'
  );
}

const BOX = avatarBox(SPACE_AVATAR_SCALE);

/** How the sprite draws one still. */
function spriteFor(member: CastMember, key: StillKey) {
  const base = {
    config: member.config,
    shirt: member.colour,
    scale: SPACE_AVATAR_SCALE,
    holding: member.holding ?? null,
    headphones: member.headphones ?? false,
    wave: null,
    stepFrame: 0,
    lift: 0,
    walking: false,
    pose: null,
  };
  const [kind, facing, step] = key.split('-') as [string, string?, string?];
  if (kind === 'walk') {
    return { ...base, facing: facing as AvatarFacing, walking: true, stepFrame: Number(step) };
  }
  if (kind === 'cheer') {
    const lift = CHEER_LIFTS[Number(facing) as 0 | 1 | 2];
    return { ...base, facing: 'down' as const, lift, pose: { ...reactionPose('cheer', 0), lift } };
  }
  if (kind === 'wave') {
    return { ...base, facing: 'down' as const, pose: reactionPose('wave', Number(facing) * 170) };
  }
  if (kind === 'idle') return { ...base, facing: 'left' as const };
  return { ...base, facing: member.rest, seated: member.sits ?? false };
}

/** Every still of every character, one <symbol> each in the sprite's own box. */
function castSheet(spec: SpaceSceneSpec): string {
  const symbols = spec.cast.flatMap((member) =>
    stillKeysOf(member).map((key) => {
      const sprite = renderToStaticMarkup(<AvatarSprite {...spriteFor(member, key)} />);
      return `<symbol id="${stillId(member, key)}" viewBox="0 0 ${BOX.width} ${BOX.height}">${sprite}</symbol>`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg">\n${symbols.join('\n')}\n</svg>\n`;
}

const write = (path: string, text: string) => {
  if (process.env.HERO_SPACE_WRITE === '1') writeFileSync(path, text);
};

describe.each(SCENES.map((spec) => [spec.id, spec] as const))('the %s scene', (_, spec) => {
  it('has its cast drawn by the sprite as committed', () => {
    const sheet = castSheet(spec);
    const path = publicPath(castHref(spec));
    write(path, sheet);
    expect(readFileSync(path, 'utf8')).toBe(sheet);
  });

  it('holds every still the scene shows, and nothing it does not', () => {
    const sheet = readFileSync(publicPath(castHref(spec)), 'utf8');
    const held = [...sheet.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]);
    const used = new Set(
      [
        ...renderToStaticMarkup(<SpaceScene spec={spec} />).matchAll(
          new RegExp(`${spec.id}-cast\\.svg#([^"]+)"`, 'g'),
        ),
      ].map((m) => m[1]),
    );
    expect([...used].sort()).toEqual([...held].sort());
  });

  it.each(SCHEMES)(
    'has its room drawn by the template and the renderer as committed (%s)',
    (scheme) => {
      const svg = roomSvg(spec, scheme);
      expect(svg).toMatch(new RegExp(`^<svg [^>]*viewBox="${viewBoxOf(spec.stage)}">`));
      // No paper rect of its own and nothing fetched from elsewhere.
      expect(svg).not.toContain(`fill="${SPACE_PAPER[scheme]}"`);
      expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
      const path = publicPath(roomHref(spec, scheme));
      write(path, svg);
      expect(readFileSync(path, 'utf8')).toBe(svg);
    },
  );

  it('seats everyone who sits on a real seat of the template, facing the way it faces', () => {
    const seats = (buildTemplate(spec.template, 0, 0) as Box[])
      .filter((e) => ['chair', 'desk', 'sofa', 'meeting-table'].includes(e.shape ?? ''))
      .flatMap((e) => seatPoints(e as unknown as SeatedBox));
    for (const member of spec.cast.filter((m) => m.sits)) {
      const at = restOf(member);
      const seat = seats.find((p) => Math.hypot(p.x - at.x, p.y - at.y) < 2);
      expect(seat, `${member.name} sits on a seat`).toBeDefined();
      if (seat?.facing) expect(member.rest, member.name).toBe(seat.facing);
    }
  });

  it('only puts words in a bubble once its speaker is in place, one bubble at a time', () => {
    const lines = [...spec.speech].sort((a, b) => a.at - b.at);
    for (const line of lines) {
      const member = spec.cast.find((m) => m.name === line.who);
      expect(member, line.who).toBeDefined();
      expect(line.at, `${line.who} speaks after arriving`).toBeGreaterThanOrEqual(
        arrivalOf(member!),
      );
    }
    // On the loop, each bubble is gone before the next rises, the last before the first comes round again.
    lines.forEach((line, i) => {
      const next = lines[i + 1]?.at ?? lines[0]!.at + LOOP_S;
      expect(line.at + SAY_S, `${line.text} clears before the next`).toBeLessThanOrEqual(next);
    });
  });
});

describe('the Team Pod room', () => {
  it('keeps the pod, its furniture and the Team Board, and nothing of the plan around them', () => {
    const elements = roomElements(TEAM_POD) as (Element & { shape?: string; label?: string })[];
    const shapes = new Set(elements.map((e) => e.shape).filter(Boolean));
    for (const kind of ['room', 'desk', 'meeting-table', 'coffee-machine', 'plant', 'bookshelf']) {
      expect(shapes.has(kind), kind).toBe(true);
    }
    const labels = elements.map((e) => e.label);
    expect(labels).toEqual(expect.arrayContaining(['Team Board', 'This week', 'Wins']));
    expect(shapes.has('mode-button')).toBe(false);
  });
});
