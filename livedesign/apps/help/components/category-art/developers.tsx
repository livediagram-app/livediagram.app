import { CODE_TONES, DevelopersArt as Scene } from '@liveworkspace/help-site/art/scenes/developers';
import { MiniWireframe } from './design-parts';

// Developers: the shared scene (docs/specs/018-help/help-pages.md "Category art"). `POST /api/designs` with one tab
// from the `wireframe-mobile-app` template (the CLI article's `design create "Coffee app" --template
// wireframe-mobile-app`), and the phone screens it makes.
export function DevelopersArt() {
  return (
    <Scene
      path="/api/designs"
      body={[
        [
          ['"name"', CODE_TONES.key],
          [': ', CODE_TONES.punctuation],
          ['"Coffee app"', CODE_TONES.string],
          [',', CODE_TONES.punctuation],
        ],
        [
          ['"tabs"', CODE_TONES.key],
          [': [{ ', CODE_TONES.punctuation],
          ['"template"', CODE_TONES.key],
          [':', CODE_TONES.punctuation],
        ],
        [['  "wireframe-mobile-app"', CODE_TONES.string]],
        [['}]', CODE_TONES.punctuation]],
      ]}
      name="Coffee app"
      result={
        <>
          <MiniWireframe x={290} y={90} w={34} h={62} />
          <MiniWireframe x={330} y={90} w={34} h={62} />
        </>
      }
    />
  );
}
