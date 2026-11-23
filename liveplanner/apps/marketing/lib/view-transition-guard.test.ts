import { NON_MARKETING_SEGMENTS } from '@liveplanner/api-schema';
import { describeViewTransitionGuard } from '@liveworkspace/marketing-site/lib/view-transition-guard-testing';

// The shared guard, bound to this product's other apps as its layout binds it.
describeViewTransitionGuard({
  segments: NON_MARKETING_SEGMENTS,
  product: 'liveplanner',
  featurePath: '/features/boards',
  itemPath: '/project/abc123',
});
