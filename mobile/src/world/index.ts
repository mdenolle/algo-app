import Constants from 'expo-constants';

// Where the Algo World page lives. By default the published site, so the phone
// works with the laptop off. While developing the world, point the app at the
// laptop instead with EXPO_PUBLIC_WORLD_URL=lan in mobile/.env (Expo tells us the
// laptop's IP through hostUri), or give any full URL. Restart `npm start` after
// changing .env.
export const PUBLISHED_WORLD_URL = 'https://mdenolle.github.io/algo-app/world/';

export function worldUrl(): string {
  const override = process.env.EXPO_PUBLIC_WORLD_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (override && override !== 'lan') return override;
  if (override === 'lan' && host) return `http://${host}:8000/world/?embedded=1&distance=3`;
  // Phones render fewer chunks than a laptop.
  return `${PUBLISHED_WORLD_URL}?embedded=1&distance=3`;
}
