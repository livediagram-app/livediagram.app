import { describe, expect, it } from 'vitest';
import { BLEND_FS, FULL_VS, PRESENT_FS, QUAD_VS } from './shaders';

// The GPU compositor's orientation (docs/specs/031-photo/blueprints/photo-engine.md "The GPU compositor"): a
// tile lays the photo's top at the buffer's top, and a pass over a whole buffer samples it straight, so no
// number of blends turns a layer over (once every second layer of a photo showed upside down).
describe('the compositor shaders', () => {
  it('sample a whole buffer straight, and place by photo px from the top', () => {
    expect(FULL_VS).toContain('v_uv = a_pos;');
    expect(FULL_VS).toContain('v_photo = vec2(a_pos.x, 1.0 - a_pos.y);');
    expect(QUAD_VS).toContain('gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);');
  });

  it('read photo positions through v_photo, never v_uv', () => {
    for (const fs of [BLEND_FS, PRESENT_FS]) {
      expect(fs).not.toMatch(/u_view\.xy \+ v_uv/);
      expect(fs).toContain('in vec2 v_photo;');
    }
  });
});
