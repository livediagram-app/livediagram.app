// What a verb is (docs/specs/015-api/blueprints/cli.md "The verb"): the shared shape
// (@liveworkspace/agent-verbs/define), bound to this product's read copies.

import type { z } from 'zod';
import type {
  Verb as SharedVerb,
  VerbContext as SharedVerbContext,
} from '@liveworkspace/agent-verbs/define';
import type { ReadCopies } from './copies';

export {
  VerbRefusal,
  type CliProjection,
  type VerbBehaviour,
} from '@liveworkspace/agent-verbs/define';

export type VerbContext = SharedVerbContext<ReadCopies>;

// Inputs are objects: their keys become positionals and flags.
export type Verb<I extends z.ZodObject = z.ZodObject, O extends z.ZodType = z.ZodType> = SharedVerb<
  I,
  O,
  VerbContext
>;

// Keeps the schemas' types flowing into the handler and the renderers.
export function defineVerb<I extends z.ZodObject, O extends z.ZodType>(
  verb: Verb<I, O>,
): Verb<I, O> {
  return verb;
}
