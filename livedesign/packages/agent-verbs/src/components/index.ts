// Agents' component calls (docs/specs/009-elements/components.md "Exports, thumbnails and agents"), shared by the
// MCP's change_components and the CLI's `component` verbs.
export {
  componentSummary,
  patchComponent,
  prepareMakeComponent,
  readLibrary,
  storeComponent,
  storedButNotPlaced,
  type ComponentStored,
  type ComponentSummary,
} from './calls';
export {
  elementChangeOperations,
  planMakeComponent,
  safeRef,
  type ComponentRefused,
  type MakePlan,
} from './plan';
