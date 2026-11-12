// A stack's wrangler inspector port (docs: .claude/skills/verify/SKILL.md "Running two e2e stacks"). Wrangler's own
// default (9229, or the port + 1000 the stacks once passed) lies outside the port block a stack is given, so two
// stacks in neighbouring blocks could collide. It sits 10 above its service's port unless the environment names one.
export const INSPECTOR_OFFSET = 10;

/** The inspector port: `fromEnv` when set, else `servicePort` + INSPECTOR_OFFSET. */
export const inspectorPortOf = (fromEnv, servicePort) =>
  Number(fromEnv ?? servicePort + INSPECTOR_OFFSET);
