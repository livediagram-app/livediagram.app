// `cloudflare:workers` for node tests, which every product's api aliases in its vitest.config.ts: the Durable
// Object base class keeps the state and env it was built with, as the runtime's does. Not a `.test.ts` file, so
// vitest doesn't collect it as a suite.
export class DurableObject<Env = unknown> {
  protected ctx: DurableObjectState;
  protected env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
}
