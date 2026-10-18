# Design reference (Figma Make prototype)

This folder is the web prototype generated in Figma Make, moved here unchanged in Phase 0.1.

- It is **reference only**: layouts, colours, typography, copy, icons and image assets are ported into `mobile/` as React Native code.
- It uses browser-only APIs (DOM, Tailwind CSS, CSS animations), so none of it is imported by the mobile app.
- All data in `src/data.ts` is mock data.
- `figma-make.gitattributes` is Figma's original Git LFS config, renamed so it is inactive (this repo does not use Git LFS).

To view it in a browser: `pnpm install && pnpm dev` inside this folder (Node 22, pnpm 10).
