// An in-memory ReadCopies for the verb suites, over this product's tabs.

import { memoryCopies as memoryCopiesOf } from '@liveworkspace/agent-verbs/testing/memory-copies';
import type { Tab } from '@liveplanner/project';

export const memoryCopies = () => memoryCopiesOf<Tab>();
