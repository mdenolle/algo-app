// Algo's voice in the world: a recording when one exists (voice/clips + npm run voice),
// otherwise the browser's text-to-speech. Same line ids as the Algo app.
const clips = (typeof window !== 'undefined' && window.ALGO_VOICE_CLIPS) || {};
let audio = null;

export function say(text, lineId, { rate = 1.02, pitch = 1.08 } = {}) {
  if (audio) { audio.pause(); audio = null; }
  if (lineId && clips[lineId]) {
    audio = new Audio(`../${clips[lineId]}`);
    audio.play().catch(() => {});
    return 'clip';
  }
  if (typeof speechSynthesis === 'undefined') return 'silent';
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate; utterance.pitch = pitch;
  speechSynthesis.speak(utterance);
  return 'tts';
}

export const hasClip = lineId => Boolean(clips[lineId]);
