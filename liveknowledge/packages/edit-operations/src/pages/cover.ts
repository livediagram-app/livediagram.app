// An agent's page cover (docs/specs/030-knowledgebase/page-surface.md "The cover"; docs/specs/024-agents/
// knowledgebase-for-agents.md "write_page's cover"): read strictly, so a cover it cannot take is refused by name
// and nothing is written. A person's cover is the editor's tab change and is read forgivingly
// (@liveknowledge/document page-cover.ts); this is the wire's door alone.
import {
  COVER_COLOURINGS,
  COVER_GRADIENT_IDS,
  COVER_MOTIONS,
  PAGE_MOTION_SPEED_MAX,
  PAGE_MOTION_SPEED_MIN,
  isPageImageId,
  isRecord,
  type TabCover,
} from '@liveknowledge/document';
import type { AgentCover } from '@liveknowledge/api-schema';

export type CoverRefusal = { code: 'invalid_cover'; message: string };

const refuse = (message: string): CoverRefusal => ({ code: 'invalid_cover', message });
const SHAPE =
  'Send cover as { "kind": "image", "imageId", "focus" }, { "kind": "gradient", "preset" }, { "kind": "animated", "preset", "colouring", "speed" } or null.';
// What an animated cover is coloured in when no colouring is named.
const DEFAULT_COLOURING = 'deep';

type Read = { cover: TabCover | null } | { refusal: CoverRefusal };

const extraKey = (raw: Record<string, unknown>, allowed: readonly string[]) =>
  Object.keys(raw).find((k) => !allowed.includes(k));

function imageCover(raw: Record<string, unknown>): Read {
  const extra = extraKey(raw, ['kind', 'imageId', 'focus']);
  if (extra)
    return { refusal: refuse(`An image cover takes no "${extra}" (only imageId and focus).`) };
  // A gallery id only: an agent has no inline pictures (those are an Offline knowledgebase's, in one browser).
  if (
    typeof raw.imageId !== 'string' ||
    raw.imageId.startsWith('data:') ||
    !isPageImageId(raw.imageId)
  )
    return { refusal: refuse('cover.imageId names a picture from upload_image or list_images.') };
  const focus = raw.focus;
  if (
    focus !== undefined &&
    !(Number.isInteger(focus) && (focus as number) >= 0 && (focus as number) <= 100)
  )
    return {
      refusal: refuse(
        'cover.focus is a whole number from 0 (the top of the picture) to 100 (its foot).',
      ),
    };
  return {
    cover: {
      imageId: raw.imageId,
      ...(focus !== undefined && focus !== 50 ? { focus: focus as number } : {}),
    },
  };
}

function gradientCover(raw: Record<string, unknown>): Read {
  const extra = extraKey(raw, ['kind', 'preset']);
  if (extra) return { refusal: refuse(`A gradient cover takes no "${extra}" (only preset).`) };
  const preset = COVER_GRADIENT_IDS.find((id) => id === raw.preset);
  return preset
    ? { cover: { gradient: preset } }
    : { refusal: refuse(`cover.preset is one of ${COVER_GRADIENT_IDS.join(', ')}.`) };
}

function animatedCover(raw: Record<string, unknown>): Read {
  const extra = extraKey(raw, ['kind', 'preset', 'colouring', 'speed']);
  if (extra)
    return {
      refusal: refuse(`An animated cover takes no "${extra}" (only preset, colouring and speed).`),
    };
  const motion = COVER_MOTIONS.find((m) => m === raw.preset);
  if (!motion) return { refusal: refuse(`cover.preset is one of ${COVER_MOTIONS.join(', ')}.`) };
  const colouring = COVER_COLOURINGS.find((c) => c === (raw.colouring ?? DEFAULT_COLOURING));
  if (!colouring)
    return { refusal: refuse(`cover.colouring is one of ${COVER_COLOURINGS.join(', ')}.`) };
  const speed = raw.speed;
  if (
    speed !== undefined &&
    !(typeof speed === 'number' && speed >= PAGE_MOTION_SPEED_MIN && speed <= PAGE_MOTION_SPEED_MAX)
  )
    return {
      refusal: refuse(
        `cover.speed is from ${PAGE_MOTION_SPEED_MIN} to ${PAGE_MOTION_SPEED_MAX}, 1 its own pace.`,
      ),
    };
  return { cover: { motion, colouring, ...(speed !== undefined && speed !== 1 ? { speed } : {}) } };
}

/** The stored cover an agent's `cover` asks for (null: take it away), or why it cannot be taken. */
export function parseAgentCover(raw: unknown): Read {
  if (raw === null) return { cover: null };
  if (!isRecord(raw)) return { refusal: refuse(SHAPE) };
  switch (raw.kind) {
    case 'image':
      return imageCover(raw);
    case 'gradient':
      return gradientCover(raw);
    case 'animated':
      return animatedCover(raw);
    default:
      return { refusal: refuse(SHAPE) };
  }
}

/** A stored cover as an agent reads it back: its kind, and its picture and where it sits, or its preset. */
export function agentCoverOf(cover: TabCover | undefined): Exclude<AgentCover, null> | undefined {
  if (!cover) return undefined;
  if ('imageId' in cover)
    return {
      kind: 'image',
      imageId: cover.imageId,
      ...(cover.focus !== undefined ? { focus: cover.focus } : {}),
    };
  if ('gradient' in cover) return { kind: 'gradient', preset: cover.gradient };
  return {
    kind: 'animated',
    preset: cover.motion,
    colouring: cover.colouring,
    ...(cover.speed !== undefined ? { speed: cover.speed } : {}),
  };
}
