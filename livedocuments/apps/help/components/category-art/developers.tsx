import { CODE_TONES, DevelopersArt as Scene } from '@liveworkspace/help-site/art/scenes/developers';
import { MiniSlide } from './page-parts';

// Developers: the shared scene (docs/specs/018-help/help-pages.md "Category art"). `POST /api/documents` with one tab
// from the `slide-deck` template (the CLI article's `document create "Pitch" --template slide-deck`), and the slide
// it makes.
export function DevelopersArt() {
  return (
    <Scene
      path="/api/documents"
      body={[
        [
          ['"name"', CODE_TONES.key],
          [': ', CODE_TONES.punctuation],
          ['"Pitch"', CODE_TONES.string],
          [',', CODE_TONES.punctuation],
        ],
        [
          ['"tabs"', CODE_TONES.key],
          [': [{', CODE_TONES.punctuation],
        ],
        [
          ['  "template"', CODE_TONES.key],
          [': ', CODE_TONES.punctuation],
          ['"slide-deck"', CODE_TONES.string],
        ],
        [['}]', CODE_TONES.punctuation]],
      ]}
      name="Pitch"
      result={<MiniSlide x={278} y={90} w={96} h={60} />}
    />
  );
}
