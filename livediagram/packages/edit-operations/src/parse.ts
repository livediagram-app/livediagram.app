// A changeset's operations as text (blueprint "Line form"): the walk is one copy for every product,
// bound here to this product's operations, their words and its refusals.

import { CHANGESET_MAX_OPERATIONS, type EditRejection } from '@livediagram/api-schema';
import { createParseEditOperations } from '@liveworkspace/edit-operations/parse';
import { validateEditOperation } from './parse-json';
import { isOperationName, parseOperationWords } from './parse-line';
import { lineParseError, tooLarge, unknownOperation } from './rejections';
import type { EditLog, EditOperation, ParseOutcome } from './types';

const parse = createParseEditOperations<
  EditOperation,
  EditRejection,
  Parameters<typeof parseOperationWords>[0]
>({
  maxOperations: CHANGESET_MAX_OPERATIONS,
  isOperationName,
  parseOperationWords,
  validateEditOperation,
  lineParseError,
  tooLarge,
  unknownOperation,
});

export function parseEditOperations(text: string, log?: EditLog): ParseOutcome {
  return parse(text, log);
}
