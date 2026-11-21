// An agent's page cover (docs/specs/030-knowledgebase/page-surface.md "The cover"; docs/specs/024-agents/
// knowledgebase-for-agents.md "write_page's cover"): read strictly, so a cover it cannot take is refused by name
// and nothing is written. A person's cover is the editor's tab change and is read forgivingly
// (@liveknowledge/document page-cover.ts); this is the wire's door alone.
import type { PageCover } from '@liveknowledge/document';
import {
  PAGE_GRADIENT_PRESETS,
  coverOfGradient,
  gradientNameOf,
  isPageImageId,
  isRecord,
} from '@liveknowledge/document';
import type { AgentCover } from '@liveknowledge/api-schema';

export type CoverRefusal = { code: 'invalid_cover'; message: string };

const refuse = (message: string): CoverRefusal => ({ code: 'invalid_cover', message });
const GRADIENT_NAMES = PAGE_GRADIENT_PRESETS.map((p) => p.label).join(', ');

/** The stored cover an agent's `cover` asks for (null: take it away), or why it cannot be taken. */
export function parseAgentCover(
  raw: unknown,
): { cover: PageCover | null } | { refusal: CoverRefusal } {
  if (raw === null) return { cover: null };
  if (!isRecord(raw))
    return {
      refusal: refuse(
        'Send cover as a picture ({ "imageId", "focus" }), a gradient ({ "gradient" }) or null.',
      ),
    };
  const keys = Object.keys(raw);
  if ('gradient' in raw) {
    if (keys.length !== 1)
      return {
        refusal: refuse(
          'A gradient cover is { "gradient": <name> } alone: a picture and a gradient are not sent together.',
        ),
      };
    const cover = typeof raw.gradient === 'string' ? coverOfGradient(raw.gradient) : undefined;
    return cover ? { cover } : { refusal: refuse(`cover.gradient is one of ${GRADIENT_NAMES}.`) };
  }
  if (!('imageId' in raw))
    return {
      refusal: refuse(
        'Send cover as a picture ({ "imageId", "focus" }), a gradient ({ "gradient" }) or null.',
      ),
    };
  const extra = keys.find((k) => k !== 'imageId' && k !== 'focus');
  if (extra)
    return { refusal: refuse(`cover takes no "${extra}" (a picture takes imageId and focus).`) };
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

/** A stored cover as an agent reads it back: its picture and where it sits, or its gradient's name. */
export function agentCoverOf(cover: PageCover | undefined): Exclude<AgentCover, null> | undefined {
  if (!cover) return undefined;
  if (cover.imageId)
    return { imageId: cover.imageId, ...(cover.focus !== undefined ? { focus: cover.focus } : {}) };
  const gradient = gradientNameOf(cover);
  return gradient ? { gradient } : undefined;
}
