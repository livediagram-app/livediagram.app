// A stream whose sound runs on the browser's audio clock, for a recorder (owner, 2026-11-17). Some USB microphones,
// read straight by MediaRecorder, come out about a quarter too long: slowed, deep and garbled on playback (measured on
// an NZXT USB mic in Brave: 5 s recorded as 6.36 s, whatever the processing settings). Passed through Web Audio first
// (a source into a stream destination) the same microphone records true to time. Video tracks pass through untouched.

import { primedAudio } from './level';

type SteadyContext = {
  createMediaStreamSource: (stream: MediaStream) => MediaStreamAudioSourceNode;
  createMediaStreamDestination: () => MediaStreamAudioDestinationNode;
  resume?: () => Promise<void>;
  close: () => Promise<void>;
  state?: string;
};

export type SteadyAudio = { stream: MediaStream; close: () => void };

// The context primeAudio started on the Record press, else a new one: the recording starts after the count, outside
// any press, where Brave would hold a new context suspended and record silence.
const sharedOrNew = (): { context: SteadyContext; shared: boolean } => {
  const primed = primedAudio() as SteadyContext | null;
  return primed
    ? { context: primed, shared: true }
    : { context: new AudioContext(), shared: false };
};

export function steadyAudio(
  stream: MediaStream,
  open: () => { context: SteadyContext; shared: boolean } = sharedOrNew,
): SteadyAudio {
  if (
    typeof MediaStream === 'undefined' ||
    typeof stream.getAudioTracks !== 'function' ||
    stream.getAudioTracks().length === 0
  )
    return { stream, close: () => {} };
  let context: SteadyContext;
  let shared: boolean;
  try {
    ({ context, shared } = open());
  } catch {
    // No Web Audio: the stream as it is, rather than no recording.
    return { stream, close: () => {} };
  }
  if (context.state === 'suspended') void context.resume?.().catch(() => {});
  const source = context.createMediaStreamSource(stream);
  const destination = context.createMediaStreamDestination();
  source.connect(destination);
  return {
    stream: new MediaStream([...stream.getVideoTracks(), ...destination.stream.getAudioTracks()]),
    close: () => {
      source.disconnect();
      // A primed context stays for the next meter or recording.
      if (!shared) void context.close().catch(() => {});
    },
  };
}
