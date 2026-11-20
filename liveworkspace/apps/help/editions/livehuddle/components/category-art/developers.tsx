import { CODE_TONES, DevelopersArt as Scene } from '@liveworkspace/help-site/art/scenes/developers';
import { Desk, Plant, Room, Sofa } from '../illustrations/space-furniture';

// Developers: the shared scene (liveworkspace/docs/specs/017-help/help-centre.md "Category art"): `POST
// /api/documents` and the Space it creates, two rooms furnished.
export function DevelopersArt() {
  return (
    <Scene
      path="/api/documents"
      body={[
        [
          ['"name"', CODE_TONES.key],
          [': ', CODE_TONES.punctuation],
          ['"Our Office"', CODE_TONES.string],
        ],
        [
          ['"tabs"', CODE_TONES.key],
          [': ', CODE_TONES.punctuation],
          ['[ … ]', CODE_TONES.rest],
        ],
      ]}
      name="Our Office"
      result={
        <>
          <Room x={276} y={88} w={50} h={60} name="" door="none" />
          <Desk x={284} y={108} chair={false} />
          <Room x={330} y={88} w={50} h={60} name="" door="none" />
          <Sofa x={335} y={108} />
          <Plant cx={366} cy={134} s={0.7} />
        </>
      }
    />
  );
}
