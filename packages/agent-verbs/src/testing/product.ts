// A product for the shared suites, named unlike any real one so a word left unbound shows.

import type { AgentProduct } from '../product';
import { createFakeApi } from './fake-api';

export const TEST_PRODUCT = {
  cli: 'acme',
  noun: 'sketch',
  collection: 'sketches',
} as const satisfies AgentProduct;

// liveplanner's way: the api's noun, other words in messages.
export const WORDED_PRODUCT = {
  ...TEST_PRODUCT,
  word: 'drawing',
  words: 'drawings',
} as const satisfies AgentProduct;

export const TEST_HOST = 'https://acme.example';

export const { fakeApi, contextOf, library, tabsOfA } = createFakeApi(TEST_PRODUCT, TEST_HOST);
export { DOC_A, DOC_B, DOC_C } from './fake-api';
