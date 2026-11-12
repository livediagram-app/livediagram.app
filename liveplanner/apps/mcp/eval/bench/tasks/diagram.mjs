// The diagram tasks of the benchmark (docs/instructions/evaluate-mcp-output.md): the bank every diagram product
// shares (@liveworkspace/mcp-kit/eval/diagram-tasks), judged with this product's checks.mjs.
import { diagramTasks } from '@liveworkspace/mcp-kit/eval/diagram-tasks';
import * as checks from '../checks.mjs';

export default diagramTasks(checks);
