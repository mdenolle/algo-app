import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { CLIPS } from './clips.generated';
import { registerVoiceClipPlayer } from './index';

// Tier 1: Alex's recordings. voice/clips/<lineId>.m4a (or webm/mp3/wav) → `npm run voice`
// → CLIPS. Any line without a clip keeps the text-to-speech voice.

let current: AudioPlayer | null = null;

export function registerRecordedVoice() {
  if (Object.keys(CLIPS).length === 0) return false;
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  registerVoiceClipPlayer(async (lineId) => {
    const source = CLIPS[lineId];
    if (source === undefined) return false;
    if (current) { try { current.remove(); } catch { /* already gone */ } current = null; }
    current = createAudioPlayer(source);
    current.play();
    return true;
  });
  return true;
}

export const recordedLineIds = () => Object.keys(CLIPS);
