// The element tours the dashboard charts (docs/specs/007-editor/element-tours.md), each by its telemetry token
// (`<Kind>Tour`). A new toured kind adds its row here; a test holds this to the editor's registry.
export const ELEMENT_TOUR_KINDS = [
  { token: 'SankeyTour', title: 'Sankey' },
  { token: 'LayerStackTour', title: 'Layer Stack' },
  { token: 'PyramidTour', title: 'Pyramid' },
  { token: 'FunnelTour', title: 'Funnel' },
  { token: 'CycleTour', title: 'Cycle' },
  { token: 'HubTour', title: 'Hub and Spoke' },
  { token: 'OnionTour', title: 'Onion' },
  { token: 'ChevronsTour', title: 'Chevrons' },
  { token: 'MindMapTour', title: 'Mind Map' },
  { token: 'FlowchartTour', title: 'Flowchart' },
  { token: 'OrgChartTour', title: 'Org Chart' },
  { token: 'SequenceTour', title: 'Sequence' },
] as const;

export const elementTourTokens = (suffix = ''): string[] =>
  ELEMENT_TOUR_KINDS.map((k) => `${k.token}${suffix}`);
