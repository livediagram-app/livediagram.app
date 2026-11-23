import { describeWorkbenchSession } from '@liveworkspace/api-kit/testing/product-api-suites';
import { AccountsUnavailable } from '../db/api-tokens';
import { resolveWorkbenchSession } from './workbench-session';

// What a workbench session reaches, in this api's names (liveworkspace/docs/specs/011-workbench/workbench.md): the
// suite every product's api runs.
describeWorkbenchSession({
  app: 'livedocuments',
  item: 'document',
  resolveWorkbenchSession,
  AccountsUnavailable,
});
