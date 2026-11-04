import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderElementsToSvg, shade, tint, type Element, type Tab } from '@livehuddle/document';
import { buildTemplate } from '@livehuddle/templates';
import { AVATAR_DEFAULTS, configureAvatar } from '@liveworkspace/avatar/bindings';
import { AvatarSprite } from '@liveworkspace/avatar/components/avatar-sprite';
import { reactionPose } from '@liveworkspace/avatar/reactions';
import { avatarBox, type AvatarFacing } from '@liveworkspace/avatar/walk';
import { SpaceScene } from '@/components/hero-space-scene';
import {
  CAST,
  CAST_SHEET_HREF,
  CHEER_LIFTS,
  SPACE_AVATAR_SCALE,
  SPACE_PAPER,
  SPACE_ROOM_HREF,
  SPACE_STAGE,
  stillId,
  stillKeysOf,
  type CastMember,
  type StillKey,
} from '@/components/hero-space-cast';

// The Space feature scene's art (docs/specs/019-marketing/marketing-site.md "Feature scenes"), written to public/hero/: the room is
// the real Team Pod, the template's own elements drawn by the editor's own SVG renderer once per appearance, and the
// cast is a sprite sheet of every still the scene shows, drawn by Avatar mode's own sprite. This test is both the
// generator and the guard: it fails when a committed file drifts from what the template, the renderer and the sprite
// draw today, and `HERO_SPACE_WRITE=1 vitest run lib/hero-space-room.test.tsx` writes them afresh.

// The shirt's shaded side in the editor's own colour maths, as the editor binds Avatar mode at startup.
configureAvatar({ ...AVATAR_DEFAULTS, shade, tint });

const SCHEMES = ['light', 'dark'] as const;
const publicPath = (href: string) => fileURLToPath(new URL(`../public${href}`, import.meta.url));

/** The pod and its board: the plan's title, description and Walk In hint are the canvas's, not the scene's. */
function podElements(): Element[] {
  const box = (e: Element) => e as Element & { y: number; height: number; shape?: string };
  const bottom = SPACE_STAGE.y + SPACE_STAGE.height;
  return (
    buildTemplate('team-pod', 0, 0)
      .filter((e) => box(e).y >= SPACE_STAGE.y && box(e).y + box(e).height <= bottom)
      .filter((e) => box(e).shape !== 'sticker')
      // Fixed ids, so a drawing is the same every time it is written.
      .map((e, i) => ({ ...e, id: `pod-${i}` }))
  );
}

/** The drawing on the stage's box with no paper of its own: the editor window's canvas shows through. */
function podSvg(scheme: (typeof SCHEMES)[number]): string {
  const tab = { id: 'hero', name: 'Team Pod', elements: podElements() } as unknown as Tab;
  const svg = renderElementsToSvg(tab, { padding: 0, background: SPACE_PAPER[scheme] });
  const { x, y, width, height } = SPACE_STAGE;
  const open = svg.indexOf('>') + 1;
  const paper = svg.indexOf('/>', open) + 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">` +
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
  return { ...base, facing: kind === 'idle' ? ('left' as const) : member.rest };
}

/** Every still of every character, one <symbol> each in the sprite's own box. */
function castSheet(): string {
  const symbols = CAST.flatMap((member) =>
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

describe('the hero Space cast', () => {
  it('is drawn by the sprite as committed', () => {
    const sheet = castSheet();
    const path = publicPath(CAST_SHEET_HREF);
    write(path, sheet);
    expect(readFileSync(path, 'utf8')).toBe(sheet);
  });

  it('holds every still the scene shows, and nothing it does not', () => {
    const sheet = readFileSync(publicPath(CAST_SHEET_HREF), 'utf8');
    const held = [...sheet.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]);
    const used = new Set(
      [...renderToStaticMarkup(<SpaceScene />).matchAll(/team-cast\.svg#([^"]+)"/g)].map(
        (m) => m[1],
      ),
    );
    expect([...used].sort()).toEqual([...held].sort());
  });
});

describe('the hero Space room', () => {
  it('keeps the pod, its furniture and the Team Board, and nothing of the plan around them', () => {
    const elements = podElements() as (Element & { shape?: string; label?: string })[];
    const shapes = new Set(elements.map((e) => e.shape).filter(Boolean));
    for (const kind of ['room', 'desk', 'meeting-table', 'coffee-machine', 'plant', 'bookshelf']) {
      expect(shapes.has(kind), kind).toBe(true);
    }
    const labels = elements.map((e) => e.label);
    expect(labels).toEqual(expect.arrayContaining(['Team Board', 'This week', 'Wins']));
    expect(shapes.has('mode-button')).toBe(false);
  });

  it.each(SCHEMES)('is drawn by the template and the renderer as committed (%s)', (scheme) => {
    const svg = podSvg(scheme);
    expect(svg).toMatch(/^<svg [^>]*viewBox="-560 -262 1120 500">/);
    // No paper rect of its own and nothing fetched from elsewhere.
    expect(svg).not.toContain(`fill="${SPACE_PAPER[scheme]}"`);
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    const path = publicPath(SPACE_ROOM_HREF[scheme]);
    write(path, svg);
    expect(readFileSync(path, 'utf8')).toBe(svg);
  });
});
