# GenZ in Action — mobile app

Expo SDK 58 · React Native 0.88 · React 19.3 · TypeScript (strict) · Expo Router 58 · Supabase.

```bash
npm install
cp .env.example .env     # fill in Supabase URL + anon/publishable key
npx expo start           # open in Expo Go (SDK 58) on Android
npm run typecheck        # tsc --noEmit
npm run lint             # expo lint
```

Install native libraries with `npx expo install <package>` so versions match SDK 58.
See the root `README.md` and `docs/decisions.md` for project structure and decisions.
