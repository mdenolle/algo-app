import * as Speech from 'expo-speech';

// Algo's voice, in three tiers that share this one entry point:
//   tier 0 (now)   system text-to-speech via expo-speech (Android TTS, web speechSynthesis)
//   tier 1 (next)  Alex's recorded clips for the fixed lines, registered with registerVoiceClipPlayer
//   tier 2 (later) clips pre-rendered on the laptop with a local voice model for new lines
// The screens only ever call say(); they never know which tier answered.

export type VoiceLanguage = 'en-US' | 'fr-FR';

export type SayOptions = {
  /** Stable id for a fixed line, so a recorded clip can replace the synthesized voice. */
  lineId?: string;
  language?: VoiceLanguage;
};

/**
 * Tier 1 hook. Given a line id and the text, play Alex's recording and resolve true,
 * or resolve false to fall back to text-to-speech. Register once at app start.
 */
export type VoiceClipPlayer = (lineId: string, text: string) => Promise<boolean>;

let clipPlayer: VoiceClipPlayer | undefined;
let enabled = true;
let listeners: ((on: boolean) => void)[] = [];

export function registerVoiceClipPlayer(player: VoiceClipPlayer) {
  clipPlayer = player;
}

export function isVoiceEnabled() {
  return enabled;
}

export function setVoiceEnabled(on: boolean) {
  enabled = on;
  if (!on) stopSpeaking();
  listeners.forEach(listener => listener(on));
}

export function onVoiceEnabledChange(listener: (on: boolean) => void) {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
}

export function stopSpeaking() {
  Speech.stop();
}

/** Speak a line. Cancels whatever Algo was saying before, like the web prototype's say(). */
export async function say(text: string, options: SayOptions = {}) {
  if (!enabled || !text.trim()) return;
  stopSpeaking();
  if (clipPlayer && options.lineId) {
    try {
      if (await clipPlayer(options.lineId, text)) return;
    } catch {
      // A missing or broken clip should never silence Algo; fall through to TTS.
    }
  }
  Speech.speak(text, {
    language: options.language ?? 'en-US',
    rate: 1.02,
    pitch: 1.08,
  });
}

/** Speak a French phrase, then its English gloss, as two utterances so each gets the right accent. */
export async function sayBilingual(french: string, english: string, lineId?: string) {
  if (!enabled) return;
  stopSpeaking();
  if (clipPlayer && lineId) {
    try {
      if (await clipPlayer(lineId, `${french} ${english}`)) return;
    } catch {
      // fall through
    }
  }
  Speech.speak(french, { language: 'fr-FR', rate: 1.0, pitch: 1.08 });
  Speech.speak(english, { language: 'en-US', rate: 1.02, pitch: 1.08 });
}
