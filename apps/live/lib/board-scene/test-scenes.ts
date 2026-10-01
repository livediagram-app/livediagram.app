// Small typed builders for board scenes in tests (synthesised: no real board's content).
import type { BoardScene, SceneItem, SceneStroke, SceneText } from './scene';

export const inkStroke = (over: Partial<SceneStroke> = {}): SceneStroke => ({
  colour: 'ink',
  widthPx: 2,
  ...over,
});

export const sceneText = (text: string, over: Partial<SceneText> = {}): SceneText => ({
  text,
  fontPx: 20,
  family: 'hand',
  colour: 'ink',
  ...over,
});

export function boardScene(items: SceneItem[], over: Partial<BoardScene> = {}): BoardScene {
  return { source: 'excalidraw', authoredOn: 'unknown', items, assets: [], notes: [], ...over };
}

/** An id minter that counts: 'id-1', 'id-2', ... */
export function countingIds(): () => string {
  let n = 0;
  return () => `id-${++n}`;
}

/**
 * A large synthetic board: `strokes` pressure ink strokes of `points` samples each, wandering
 * smoothly over a 4,000 px board, with a few stock and custom colours, as a big hand-drawn board is.
 */
export function syntheticInkBoard(strokes: number, points: number): BoardScene {
  const colours = ['ink', { hex: '#1971c2' }, { hex: '#e03131' }, { hex: '#868e96' }] as const;
  const items: SceneItem[] = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let s = 0; s < strokes; s++) {
    const x0 = rand() * 4000;
    const y0 = rand() * 3000;
    const span = 20 + rand() * 600;
    const pts = Array.from({ length: points }, (_, i) => {
      const t = i / (points - 1);
      return {
        x: x0 + t * span + Math.sin(t * 9 + s) * span * 0.2,
        y: y0 + Math.cos(t * 7 + s) * span * 0.3,
        p: 0.3 + 0.4 * Math.abs(Math.sin(t * 5 + s)),
      };
    });
    items.push({
      key: `ink-${s}`,
      kind: 'ink',
      points: pts,
      stroke: { colour: colours[s % colours.length]!, widthPx: 1 + (s % 3) },
    });
  }
  return boardScene(items);
}
