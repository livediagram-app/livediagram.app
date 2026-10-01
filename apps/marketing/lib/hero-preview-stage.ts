// The hero's stage (docs/specs/019-marketing/hero-environment-preview.md "Stages"): idle, previewing
// one environment, or launching one. Pure, so every transition is tested apart from the timers
// and the DOM that drive it.

export type HeroEnv = 'drawing' | 'diagram' | 'brainstorm';

export type HeroStage =
  | { readonly kind: 'idle' }
  | { readonly kind: 'previewing'; readonly env: HeroEnv }
  | { readonly kind: 'launching'; readonly env: HeroEnv };

export type HeroStageEvent =
  | { readonly type: 'preview'; readonly env: HeroEnv }
  | { readonly type: 'leave' }
  | { readonly type: 'launch'; readonly env: HeroEnv }
  | { readonly type: 'reset' };

export const HERO_IDLE: HeroStage = { kind: 'idle' };

export function heroStageReducer(stage: HeroStage, event: HeroStageEvent): HeroStage {
  if (event.type === 'reset') return HERO_IDLE;
  // A launch is one-way: only a back/forward-cache restore (reset) brings the hero back.
  if (stage.kind === 'launching') return stage;
  switch (event.type) {
    case 'preview':
      return stage.kind === 'previewing' && stage.env === event.env
        ? stage
        : { kind: 'previewing', env: event.env };
    case 'leave':
      return HERO_IDLE;
    case 'launch':
      return { kind: 'launching', env: event.env };
  }
}

/** The environment showing in a stage, if any. */
export function activeEnv(stage: HeroStage): HeroEnv | null {
  return stage.kind === 'idle' ? null : stage.env;
}
