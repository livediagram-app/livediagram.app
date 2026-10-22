// Laid-out diagrams kept as data: a gateway fanning out to its services (down and right), the same fan with its
// services in a frame, and a smaller fan. Their trunks, frame and routed lines are what the operations' tests edit.
import type { Tab } from '@livedocuments/document';
import architecture from './architecture.json';
import fan from './fan.json';
import gatewayDown from './gateway-down.json';
import gatewayRight from './gateway-right.json';

const TABS = {
  architecture,
  fan,
  'gateway-down': gatewayDown,
  'gateway-right': gatewayRight,
};

// A fresh copy each call, so no test sees another's edits.
export const laidOutTab = (name: keyof typeof TABS): Tab =>
  structuredClone(TABS[name]) as unknown as Tab;
