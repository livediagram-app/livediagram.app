import { WORKBENCH_DEFAULTS, type WorkbenchBindings } from '../../bindings';

/** A full set of bindings for a test: the defaults, with what the test cares about replaced. */
export function testBindings(overrides: Partial<WorkbenchBindings> = {}): WorkbenchBindings {
  return { ...WORKBENCH_DEFAULTS, ...overrides };
}
