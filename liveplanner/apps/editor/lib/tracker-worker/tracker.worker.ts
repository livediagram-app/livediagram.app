// The Import dialog's worker (docs/specs/026-plan/tracker-import.md "Reading the file"): a board from another tool read
// and planned here, so a 2,000-card file never holds the page. Each request is answered with its id, in turn.
import {
  answerTrackerRequest,
  createTrackerRunner,
  type TrackerRequest,
  type TrackerResponse,
} from './tracker-tasks';

const scope = self as unknown as {
  postMessage: (message: TrackerResponse) => void;
  addEventListener: (type: 'message', fn: (e: MessageEvent<TrackerRequest>) => void) => void;
};

const runner = createTrackerRunner();
scope.addEventListener('message', (e) => scope.postMessage(answerTrackerRequest(runner, e.data)));
