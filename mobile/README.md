# GenZ in Action — mobile app

Expo SDK 54 · React Native 0.81 · TypeScript (strict) · Expo Router 6 · Supabase.

```bash
npm install
cp .env.example .env     # fill in Supabase URL + anon/publishable key
npx expo start           # open in Expo Go (SDK 54) on Android
npm run typecheck        # tsc --noEmit
npm run lint             # expo lint
```

Install native libraries with `npx expo install <package>` so versions match SDK 54.
See the root `README.md` and `docs/decisions.md` for project structure and decisions.
