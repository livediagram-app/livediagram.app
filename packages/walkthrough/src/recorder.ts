// The recording itself (liveworkspace/docs/specs/006-media/walkthroughs.md "Recording"): the microphone, and the camera
// when it is on, through the browser's MediaRecorder at the walkthrough bit rates, so ten minutes stays under the size
// limit. The bytes gather in memory in one-second pieces; a recording that reaches the limit stops itself.

import {
  WALKTHROUGH_AUDIO_BPS,
  WALKTHROUGH_MEDIA_MAX_BYTES,
  WALKTHROUGH_VIDEO_BPS,
} from '@liveworkspace/media/walkthrough';

// Most likely first: Chrome, Edge and Firefox record WebM; Safari records MP4.
const VIDEO_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];
const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

type RecorderClass = {
  new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder;
  isTypeSupported: (type: string) => boolean;
};

const recorderClass = (): RecorderClass | undefined =>
  (globalThis as { MediaRecorder?: RecorderClass }).MediaRecorder;

/** The type this browser records in, or null when it records none of the kept ones. */
export function recordingType(camera: boolean, Recorder = recorderClass()): string | null {
  if (!Recorder) return null;
  return (camera ? VIDEO_TYPES : AUDIO_TYPES).find((t) => Recorder.isTypeSupported(t)) ?? null;
}

/** Whether this browser can record a walkthrough at all. */
export function canRecordHere(Recorder = recorderClass()): boolean {
  return recordingType(false, Recorder) !== null;
}

export type Recorded = { blob: Blob; type: string };

export type Recording = {
  /** Ends it and hands back the bytes. */
  stop: () => Promise<Recorded>;
  /** Ends it and throws the bytes away. */
  cancel: () => void;
};

export type RecordingOptions = {
  stream: MediaStream;
  camera: boolean;
  /** Told when the bytes reach the size limit, after which nothing more is kept. */
  onFull?: () => void;
  Recorder?: RecorderClass | undefined;
};

export function startRecording({
  stream,
  camera,
  onFull,
  Recorder = recorderClass(),
}: RecordingOptions): Recording {
  const type = recordingType(camera, Recorder);
  if (!Recorder || !type) throw new Error('recording_unsupported');
  const recorder = new Recorder(stream, {
    mimeType: type,
    audioBitsPerSecond: WALKTHROUGH_AUDIO_BPS,
    ...(camera ? { videoBitsPerSecond: WALKTHROUGH_VIDEO_BPS } : {}),
  });
  const pieces: Blob[] = [];
  let bytes = 0;
  let full = false;
  recorder.ondataavailable = (e: BlobEvent) => {
    if (full || e.data.size === 0) return;
    if (bytes + e.data.size > WALKTHROUGH_MEDIA_MAX_BYTES) {
      full = true;
      onFull?.();
      return;
    }
    bytes += e.data.size;
    pieces.push(e.data);
  };
  recorder.start(1000);
  // The type the browser settled on (it may add codecs), without parameters the service would not know.
  const blobType = () => (recorder.mimeType || type).split(';')[0]!.trim();
  return {
    stop: () =>
      new Promise<Recorded>((resolve) => {
        recorder.onstop = () =>
          resolve({ blob: new Blob(pieces, { type: blobType() }), type: blobType() });
        if (recorder.state === 'inactive') recorder.onstop(new Event('stop'));
        else recorder.stop();
      }),
    cancel: () => {
      recorder.ondataavailable = null;
      if (recorder.state !== 'inactive') recorder.stop();
      pieces.length = 0;
    },
  };
}

/** Stops every track of a stream: the camera light goes off and the microphone is released. */
export function stopStream(stream: MediaStream | null): void {
  for (const track of stream?.getTracks() ?? []) track.stop();
}
