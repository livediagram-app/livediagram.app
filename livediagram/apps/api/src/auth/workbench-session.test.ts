import { describeWorkbenchSession } from '@liveworkspace/api-kit/testing/product-api-suites';
import { AccountsUnavailable } from '@liveworkspace/auth-client/api-tokens';
import { resolveWorkbenchSession } from './workbench-session';

// What a workbench session reaches, in this api's names (liveworkspace/docs/specs/011-workbench/workbench.md): the
// suite every product's api runs.
describeWorkbenchSession({
  app: 'livediagram',
  item: 'document',
  resolveWorkbenchSession,
  AccountsUnavailable,
});
