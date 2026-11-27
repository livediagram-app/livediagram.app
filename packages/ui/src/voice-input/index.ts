// Voice input on every AI prompt field (liveworkspace/docs/specs/022-interface-design/voice-input.md).
export { useVoiceInput, type VoiceInput, type VoiceInputOptions } from './useVoiceInput';
export {
  VoiceInputButton,
  VoiceInputNote,
  VOICE_START_LABEL,
  VOICE_STOP_LABEL,
  voiceInputListening,
} from './VoiceInputButton';
export { VOICE_NOTE_WORDS, type VoiceNote } from './speech-recognition';
