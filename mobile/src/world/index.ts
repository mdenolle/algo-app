import Constants from 'expo-constants';

// Where the Algo World page lives. In development it is served by the laptop
// (`npm run web` at the repo root, port 8000); Expo tells us the laptop's IP
// through hostUri, so the phone finds it without configuration.
// Set EXPO_PUBLIC_WORLD_URL to override (e.g. a hosted build later).
export function worldUrl(): string {
  const override = process.env.EXPO_PUBLIC_WORLD_URL;
  if (override) return override;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (typeof window !== 'undefined' && window.location?.hostname && !host) {
    return `${window.location.protocol}//${window.location.hostname}:8000/world/?embedded=1`;
  }
  // Phones render fewer chunks than a laptop.
  return `http://${host ?? 'localhost'}:8000/world/?embedded=1&distance=3`;
}
