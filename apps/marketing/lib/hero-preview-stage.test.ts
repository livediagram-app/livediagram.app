import { describe, expect, it } from 'vitest';
import { HERO_IDLE, heroStageReducer, type HeroStage } from './hero-preview-stage';

const previewing = (env: 'drawing' | 'diagram' | 'brainstorm'): HeroStage => ({
  kind: 'previewing',
  env,
});
const launching = (env: 'drawing' | 'diagram' | 'brainstorm'): HeroStage => ({
  kind: 'launching',
  env,
});

describe('heroStageReducer', () => {
  it('previews an environment from idle', () => {
    expect(heroStageReducer(HERO_IDLE, { type: 'preview', env: 'diagram' })).toEqual(
      previewing('diagram'),
    );
  });

  it('swaps environments while previewing', () => {
    expect(heroStageReducer(previewing('drawing'), { type: 'preview', env: 'brainstorm' })).toEqual(
      previewing('brainstorm'),
    );
  });

  it('returns the same stage for a repeated preview, so nothing re-renders', () => {
    const stage = previewing('drawing');
    expect(heroStageReducer(stage, { type: 'preview', env: 'drawing' })).toBe(stage);
  });

  it('returns to idle on leave', () => {
    expect(heroStageReducer(previewing('diagram'), { type: 'leave' })).toBe(HERO_IDLE);
  });

  it('launches from a preview or straight from idle', () => {
    expect(heroStageReducer(previewing('diagram'), { type: 'launch', env: 'diagram' })).toEqual(
      launching('diagram'),
    );
    expect(heroStageReducer(HERO_IDLE, { type: 'launch', env: 'brainstorm' })).toEqual(
      launching('brainstorm'),
    );
  });

  it('holds a launch: no preview, leave or second launch undoes it', () => {
    const stage = launching('drawing');
    expect(heroStageReducer(stage, { type: 'preview', env: 'diagram' })).toBe(stage);
    expect(heroStageReducer(stage, { type: 'leave' })).toBe(stage);
    expect(heroStageReducer(stage, { type: 'launch', env: 'diagram' })).toBe(stage);
  });

  it('resets any stage to idle (a back/forward-cache restore)', () => {
    expect(heroStageReducer(launching('drawing'), { type: 'reset' })).toBe(HERO_IDLE);
    expect(heroStageReducer(previewing('drawing'), { type: 'reset' })).toBe(HERO_IDLE);
  });
});
