// Loading a Session button saved with a tool it no longer offers (a poll, docs/specs/012-collaboration/session-button.md):
// `session: { tool: 'poll' }` would fail validation and take the tab with it. The config is dropped and the button
// reads as the default tool, a timer. Runs where stored elements enter (./stored-elements).
import { isSessionTool } from './behaviour-config';
import type { Element } from './index';

const carriesRetiredTool = (el: Element): boolean => {
  if (el.type !== 'shape') return false;
  const session = (el as { session?: unknown }).session;
  return (
    typeof session === 'object' &&
    session !== null &&
    !isSessionTool((session as { tool?: unknown }).tool)
  );
};

export function migrateLegacySessionButtons(elements: Element[]): Element[] {
  if (!elements.some(carriesRetiredTool)) return elements;
  return elements.map((el) => {
    if (!carriesRetiredTool(el)) return el;
    const { session: _gone, ...rest } = el as Element & { session?: unknown };
    void _gone;
    return rest;
  });
}
