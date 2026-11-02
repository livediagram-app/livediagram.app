import { Arrow, Shape } from '@liveworkspace/help-site/art/primitives';
import { CODE_TONES, DevelopersArt as Scene } from '@liveworkspace/help-site/art/scenes/developers';

// Developers: the shared scene (docs/specs/018-help/help-pages.md "Category art"). `POST /api/documents` and the
// Service map diagram it creates.
export function DevelopersArt() {
  return (
    <Scene
      path="/api/documents"
      body={[
        [
          ['"name"', CODE_TONES.key],
          [': ', CODE_TONES.punctuation],
          ['"Service map"', CODE_TONES.string],
        ],
        [
          ['"tabs"', CODE_TONES.key],
          [': ', CODE_TONES.punctuation],
          ['[ … ]', CODE_TONES.rest],
        ],
      ]}
      name="Service map"
      result={
        <>
          <Shape x={280} y={92} w={44} h={24} label="" />
          <Shape
            x={330}
            y={122}
            w={44}
            h={28}
            kind="circle"
            fill="fill-violet-100"
            stroke="stroke-violet-400"
          />
          <Shape x={282} y={126} w={40} h={22} accent />
          <Arrow from={[324, 104]} to={[340, 119]} width={1.8} />
          <Arrow from={[302, 116]} to={[302, 123]} width={1.8} />
        </>
      }
    />
  );
}
