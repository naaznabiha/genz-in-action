# Decision log

| # | Date | Decision | Status |
| --- | --- | --- | --- |
| D1 | 2026-10-18 | Stay on **Expo SDK 54** for Phases 0–2 so the app runs in store Expo Go on Android. Schedule a deliberate SDK upgrade checkpoint before Phase 6 (communities). | Agreed |
| D2 | 2026-10-18 | Git repo at the project root; Figma Make web prototype moved to `design-reference/`; Expo app stays in `mobile/`. No Git LFS. | Agreed |
| D3 | 2026-10-18 | App identity (provisional, change before first store build): name **GenZ in Action**, slug `genz-in-action`, scheme `genzinaction`, Android package / iOS bundle ID `com.genzinaction.app`. | Provisional |
| D4 | 2026-10-18 | Dark-only UI (`userInterfaceStyle: "dark"`), matching the prototype. | Agreed |
| D5 | 2026-10-18 | Password reset uses a 6-digit email code (`type: recovery`) rather than a deep link, so it works in Expo Go. | Recommended — confirm in Phase 1 |
| D6 | 2026-10-18 | Design system: Plus Jakarta Sans 700/800 (display) + Inter 400–700 (body) via `@expo-google-fonts`, imported per weight so only 6 font files ship. Prototype `font-black` (900) maps to Jakarta 800. Icons are the prototype SVG paths via `react-native-svg`. | Agreed |
| D7 | 2026-10-18 | TanStack Query is added with the first real server query (Phase 1/2), not before, so no unused dependency is installed. | Agreed |
| D8 | 2026-10-18 | App icon / adaptive icon / splash generated from the logo mark (hi-res Gemini artwork + background-removed alpha). Replace with designer-supplied exports before store release if available. | Provisional |

## Open decisions

See section 9 of the Phase 0 audit: Supabase project/CLI setup, session storage (AsyncStorage vs encrypted), profile tags vs "Primary Cause", post model fields, petition/RSVP/"Take action" scope, prototype-only features (Menu, Projects Hub, Meetings, Resources, Member Directory, DMs), impact scoring.
