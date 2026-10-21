// The page's side of the workbench messages (docs/specs/013-workspace/workbench-embeds.md "Workbench
// messages", blueprint "Workbench messages"): every send targets the bound origin, so a parent of any
// other origin never receives it; a message is accepted only from the parent window at that origin and
// only once it parses. Anything else from elsewhere is not a workbench's message and is dropped silently;
// an unknown or invalid message from the workbench is logged once per type.
import {
  parseWorkbenchMessage,
  type PageToWorkbenchMessage,
  type WorkbenchToPageMessage,
} from '@livediagram/api-schema';

export type WorkbenchPort = {
  origin: string;
  send: (message: PageToWorkbenchMessage) => void;
  subscribe: (listener: (message: WorkbenchToPageMessage) => void) => () => void;
  close: () => void;
};

export function createWorkbenchPort(origin: string, win: Window): WorkbenchPort {
  const listeners = new Set<(message: WorkbenchToPageMessage) => void>();
  const logged = new Set<string>();
  const logOnce = (line: string, type: string) => {
    const key = `${line} ${type}`;
    if (logged.has(key)) return;
    logged.add(key);
    console.warn(line, { type });
  };

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== origin || event.source !== win.parent) return;
    const parsed = parseWorkbenchMessage(event.data, 'to-page');
    if ('ignored' in parsed) return logOnce('[workbench] message-ignored', parsed.ignored);
    if ('invalid' in parsed) return logOnce('[workbench] message-invalid', parsed.invalid);
    listeners.forEach((l) => l(parsed));
  };
  win.addEventListener('message', onMessage);

  return {
    origin,
    send: (message) => win.parent.postMessage(message, origin),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => {
      listeners.clear();
      win.removeEventListener('message', onMessage);
    },
  };
}
