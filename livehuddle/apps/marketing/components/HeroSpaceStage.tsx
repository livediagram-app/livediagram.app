// The landing hero's stage (docs/specs/019-marketing/marketing-site.md "Hero"): the Team Pod filling up, in the
// editor window every scene is drawn in. A server component: the scene is static SVG moved by
// app/hero-scenes/space.css, so it adds no JavaScript to the page.

import { EditorWindow } from './hero-editor-window';
import { heroSceneData } from './hero-scene-data';
import { SPACE_VIEWBOX } from './hero-space-cast';
import { SpaceScene } from './hero-space-scene';

// A phone keeps the window's fixed height and crops the pod about the table; from sm up the canvas takes the
// scene's own proportion (its 1120 by 500 box under the 40px palette strip), so the whole pod and board show.
export const SPACE_CANVAS = 'h-[460px] sm:h-auto sm:aspect-[41/20]';

export function HeroSpaceStage() {
  const scene = heroSceneData('space');
  return (
    <div aria-hidden className="pointer-events-none select-none">
      <EditorWindow
        title={scene.title}
        tabs={scene.tabs}
        shared={scene.shared}
        mode={scene.mode}
        viewBox={SPACE_VIEWBOX}
        fit="slice"
        playing={false}
        veil="opacity-0"
        document={<SpaceScene />}
        canvasClassName={SPACE_CANVAS}
      />
    </div>
  );
}
