// The storyboard template, split out of template-builders-slides.ts once it
// grew a real story: shot chips, dialogue, and an action + sound line per
// panel.
//
// Pure: (cx, cy) -> Element[]. See docs/specs/008-canvas/canvas-and-palette.md "Templates".

import { createShape, createText, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import { uiAt } from './template-wireframe-kit';

const MUTED = '#64748b';

// Storyboard: a 30-second ad for a made-up bike-share app (Pedal), told in
// six shots the way a film storyboard is: each panel is a 16:9 theme-filled
// card with a bold number chip on its corner and a
// soft shot chip naming the framing and start time ("Close-up · 0:04"). The
// sketch is built from line-art glyphs and stickers, with a speech bubble
// where someone speaks. Beneath each panel, the ACTION (what we see) and the
// SOUND (a muted italic line for dialogue, voice-over, music or effects), the
// two things a storyboard caption must carry. The story has a shape: a bad
// moment, the app, the win, the end card. Frames, number chips and the how-to
// are the "Frames" scaffold; sketches, chips and captions are "Content".

// A sketch mark placed in panel-local coordinates: a glyph, a sticker, or a
// speech bubble carrying dialogue.
type Mark =
  | { icon: string; x: number; y: number; size: number }
  | { sticker: string; x: number; y: number; size: number }
  | { says: string; x: number; y: number; w: number };

type Shot = { shot: string; action: string; sound: string; marks: Mark[] };

const SHOTS: Shot[] = [
  {
    shot: 'Wide · 0:00',
    action: 'Rain. Maya misses the bus by seconds.',
    sound: 'SFX: rain, the bus pulling away',
    marks: [
      { icon: 'user', x: 56, y: 92, size: 72 },
      { sticker: 'emoji-cloud', x: 136, y: 44, size: 72 },
      { says: 'Not again…', x: 214, y: 104, w: 124 },
    ],
  },
  {
    shot: 'Close-up · 0:04',
    action: 'She opens Pedal: a bike 90 m away.',
    sound: 'VO: “Next bus, 20 minutes. Your bike, 90 metres.”',
    marks: [
      { icon: 'smartphone', x: 125, y: 52, size: 110 },
      { icon: 'map-pin', x: 162, y: 88, size: 36 },
      { sticker: 'emoji-point-left', x: 244, y: 84, size: 64 },
    ],
  },
  {
    shot: 'Over the shoulder · 0:09',
    action: 'One tap, and the lock clicks open.',
    sound: 'SFX: a satisfying click',
    marks: [
      { icon: 'user', x: 60, y: 84, size: 80 },
      { icon: 'unlock', x: 190, y: 92, size: 64 },
      { sticker: 'emoji-sparkles', x: 256, y: 56, size: 64 },
    ],
  },
  {
    shot: 'Tracking · 0:14',
    action: 'She glides past the stuck traffic.',
    sound: 'Music: the beat drops',
    marks: [
      { icon: 'arrow-right', x: 28, y: 90, size: 40 },
      { icon: 'arrow-right', x: 28, y: 130, size: 40 },
      { icon: 'user', x: 84, y: 88, size: 72 },
      { icon: 'arrow-right', x: 170, y: 104, size: 48 },
      { icon: 'map-pin', x: 232, y: 96, size: 56 },
      { sticker: 'emoji-zap', x: 286, y: 52, size: 60 },
    ],
  },
  {
    shot: 'Medium · 0:21',
    action: 'She reaches work early, grinning.',
    sound: 'SFX: office chatter, a door swinging shut',
    marks: [
      { sticker: 'emoji-laughing', x: 52, y: 88, size: 88 },
      { icon: 'briefcase', x: 160, y: 104, size: 56 },
      { says: 'Made it, early!', x: 214, y: 56, w: 128 },
    ],
  },
  {
    shot: 'End card · 0:26',
    action: 'Logo and line, held for four seconds.',
    sound: 'VO: “Pedal. Ride the next one.”',
    marks: [],
  },
];

export function buildStoryboard(cx: number, cy: number): Element[] {
  const frameW = 360;
  const frameH = 202;
  const gapX = 48;
  const captionGap = 10;
  const lineH = 22;
  const gapY = 52;
  const titleH = 44;
  const captionH = 28;
  const headGap = 32;
  const cols = 3;
  const rowPitch = frameH + captionGap + 2 * lineH + gapY;
  const totalW = cols * frameW + (cols - 1) * gapX;
  const totalH = titleH + captionH + headGap + 2 * rowPitch - gapY;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const top = y0 + titleH + captionH + headGap;
  const content = { layerId: TEMPLATE_CONTENT_LAYER_ID };
  const scaffold = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID };

  const elements: Element[] = [
    {
      ...createText(x0, y0),
      width: totalW - 200,
      height: titleH,
      label: 'Storyboard · Pedal, 30-second ad',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
      ...content,
    },
    {
      ...createText(x0 + totalW - 200, y0),
      width: 200,
      height: titleH,
      label: '6 shots · 0:30',
      textSize: 'md',
      textColor: MUTED,
      textAlignX: 'right',
      ...content,
    },
    {
      ...createText(x0, y0 + titleH),
      width: totalW,
      height: captionH,
      label:
        'One panel per shot: sketch it, name the framing and start time, then write the action and the sound beneath.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
      ...scaffold,
    },
  ];

  SHOTS.forEach((shot, i) => {
    const fx = x0 + (i % cols) * (frameW + gapX);
    const fy = top + Math.floor(i / cols) * rowPitch;
    const at = uiAt(fx, fy);

    elements.push({
      ...createShape('square', fx, fy),
      width: frameW,
      height: frameH,
      borderRadius: 'sm',
      ...scaffold,
    });

    // The shot chip, top-right inside the panel.
    const chipW = 188;
    elements.push(
      at('stadium', frameW - 12 - chipW, 12, chipW, 28, {
        label: shot.shot,
        textSize: 'sm',
        colorPreset: 'soft',
      }),
    );

    for (const mark of shot.marks) {
      if ('icon' in mark) {
        elements.push(at('icon', mark.x, mark.y, mark.size, mark.size, { iconId: mark.icon }));
      } else if ('sticker' in mark) {
        elements.push(
          at('sticker', mark.x, mark.y, mark.size, mark.size, { stickerId: mark.sticker }),
        );
      } else {
        elements.push(
          at('speech-bubble', mark.x, mark.y, mark.w, 56, { label: mark.says, textSize: 'sm' }),
        );
      }
    }

    // The end card is type, not a sketch: brand, line and the one action.
    if (i === SHOTS.length - 1) {
      elements.push({
        ...createText(fx + 24, fy + 60),
        width: frameW - 48,
        height: 44,
        label: 'Pedal',
        textSize: 'lg',
        textBold: true,
        ...content,
      });
      elements.push({
        ...createText(fx + 24, fy + 104),
        width: frameW - 48,
        height: 30,
        label: 'Ride the next one.',
        textSize: 'md',
        ...content,
      });
      elements.push(
        at('stadium', (frameW - 160) / 2, 146, 160, 34, {
          label: 'Get the app',
          textSize: 'sm',
          colorPreset: 'bold',
        }),
      );
    }

    // Number chip overlapping the panel's top-left corner.
    const chip = 40;
    elements.push({
      ...createShape('circle', fx - chip / 2 + 6, fy - chip / 2 + 6),
      width: chip,
      height: chip,
      label: `${i + 1}`,
      textSize: 'sm',
      textBold: true,
      colorPreset: 'bold',
      ...scaffold,
    });

    // Action, then sound, under the panel.
    const cy0 = fy + frameH + captionGap;
    elements.push({
      ...createText(fx, cy0),
      width: frameW,
      height: lineH,
      label: shot.action,
      textSize: 'sm',
      textAlignX: 'left',
      ...content,
    });
    elements.push({
      ...createText(fx, cy0 + lineH),
      width: frameW,
      height: lineH,
      label: shot.sound,
      textSize: 'sm',
      textItalic: true,
      textColor: MUTED,
      textAlignX: 'left',
      ...content,
    });
  });

  return elements;
}
