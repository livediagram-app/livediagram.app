import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoomArt } from './room-art';
import { SpaceScene } from './hero-space-scene';
import { TEAM_POD, roomHref } from './hero-space-cast';

// Work Tracker #519: a room drawing is a CSS background picked by the `dark` class, never a pair of SVG <image>s
// (an <image> loads whether it is shown or not), so a page fetches only its own appearance's drawing.
describe('a room drawing in a scene', () => {
  it('is one box with both drawings as custom properties, the dark one only under the dark class', () => {
    const html = renderToStaticMarkup(
      <svg>
        <RoomArt
          light="/hero/a-light.svg"
          dark="/hero/a-dark.svg"
          x={-10}
          y={20}
          width={300}
          height={200}
        />
      </svg>,
    );
    expect(html).toContain('<foreignObject x="-10" y="20" width="300" height="200">');
    expect(html).toContain('--room-light:url(/hero/a-light.svg);--room-dark:url(/hero/a-dark.svg)');
    expect(html).toContain('bg-(image:--room-light)');
    expect(html).toContain('dark:bg-(image:--room-dark)');
    expect(html).not.toContain('<image');
  });

  it('draws a scene’s room through it, with no <image> to fetch both', () => {
    const html = renderToStaticMarkup(
      <svg>
        <SpaceScene spec={TEAM_POD} />
      </svg>,
    );
    expect(html).toContain(`url(${roomHref(TEAM_POD, 'dark')})`);
    expect(html).not.toMatch(/<image[^>]+-(light|dark)\.svg/);
  });
});
