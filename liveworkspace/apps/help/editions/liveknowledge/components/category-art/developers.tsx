import { CODE_TONES, DevelopersArt as Scene } from '@liveworkspace/help-site/art/scenes/developers';
import { Lines, Pill } from '../illustrations/kit';

// Developers: the shared scene (liveworkspace/docs/specs/017-help/help-centre.md "Category art"). `POST
// /api/documents/{id}/ask` with a question, and the answer it makes: a line of writing ending in its citation.
export function DevelopersArt() {
  return (
    <Scene
      path="/api/documents/3f9c/ask"
      body={[
        [
          ['"question"', CODE_TONES.key],
          [': ', CODE_TONES.punctuation],
        ],
        [['  "When do we deploy?"', CODE_TONES.string]],
      ]}
      name="Handbook"
      result={
        <g>
          <Lines x={282} y={100} widths={[88, 80, 52]} gap={9} h={4} />
          <Pill x={338} y={120} label="1" tone="brand" size={6.5} w={12} h={10} />
        </g>
      }
    />
  );
}
