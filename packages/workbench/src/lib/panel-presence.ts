// A floating panel arriving or leaving with no gesture of its own (the Map with the canvas's first content,
// Collaborate when someone joins) tells the chrome that places itself around the panels to measure again
// (docs/specs/008-canvas/quick-style-panel.md "Collisions"). A paste into a blank canvas showed Quick Style and the Map
// in the same moment; Quick Style, placed before the Map existed, sat over the Map's header.
// The event is the product's (the `panelPresenceEvent` binding).
import { workbench } from '../bindings';

export function announcePanelPresence(): void {
  window.dispatchEvent(new Event(workbench.panelPresenceEvent));
}
