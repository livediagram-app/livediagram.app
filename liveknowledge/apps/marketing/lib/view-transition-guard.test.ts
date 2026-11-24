import { NON_MARKETING_SEGMENTS } from '@liveknowledge/api-schema';
import { describeViewTransitionGuard } from '@liveworkspace/marketing-site/lib/view-transition-guard-testing';

// The shared guard, bound to this product's other apps as its layout binds it.
describeViewTransitionGuard({
  segments: NON_MARKETING_SEGMENTS,
  product: 'liveknowledge',
  featurePath: '/features/diagrams',
  itemPath: '/document/abc',
});
