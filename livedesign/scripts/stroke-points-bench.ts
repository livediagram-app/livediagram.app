// The stroke points bench, shared in @liveworkspace/element-model (scripts/stroke-points-bench.ts), run on this
// product's stored-tab migration.
//   pnpm bench:stroke-points
import { runStrokePointsBench } from '../../packages/element-model/scripts/stroke-points-bench';
import { migrateStoredTab } from '../packages/design/src/index';

runStrokePointsBench(migrateStoredTab);
