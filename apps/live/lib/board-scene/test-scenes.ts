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
