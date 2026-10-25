import { CODE_TONES, DevelopersArt as Scene } from '@liveworkspace/help-site/art/scenes/developers';
import { MiniBoard } from '@liveworkspace/help-site/art/work';

// Developers: the shared scene (docs/specs/018-help/help-pages.md "Category art"). `POST /api/projects` with one tab
// from the `kanban` template (Working with Plans), and the board it makes.
export function DevelopersArt() {
  return (
    <Scene
      path="/api/projects"
      body={[
        [
          ['"name"', CODE_TONES.key],
          [': ', CODE_TONES.punctuation],
          ['"Sprint 14"', CODE_TONES.string],
          [',', CODE_TONES.punctuation],
        ],
        [
          ['"tabs"', CODE_TONES.key],
          [': [{', CODE_TONES.punctuation],
        ],
        [
          ['  "template"', CODE_TONES.key],
          [': ', CODE_TONES.punctuation],
          ['"kanban"', CODE_TONES.string],
        ],
        [['}]', CODE_TONES.punctuation]],
      ]}
      name="Sprint 14"
      result={<MiniBoard x={276} y={88} w={100} h={66} header={false} />}
    />
  );
}
