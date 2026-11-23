// Whether a photo read will spend AI credits, so the choice is offered before anything is sent
// (docs/specs/021-event-storming/note-reader.md "What the editor shows"). Loaded with the detection pipeline, once a
// photo is picked, so the subscription contract stays off the editor's first load.
import { itemPayer } from '@liveworkspace/subscription';
import { proOn } from '@liveworkspace/subscription-ui/flag';
import { readOwner } from './read-credits';

/** Pro on, the reader signed in, the server reader available, and a diagram that is not a guest's (by the one rule
 *  every app follows, `itemPayer`). The server's word wins: this is only whether to ask. */
export function readCharged(signedIn: boolean, aiEnabled: boolean): boolean {
  return proOn() && signedIn && aiEnabled && itemPayer(readOwner()).kind !== 'guest';
}
