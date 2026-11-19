# Spacerogue — notes for Claude

## The owner must not be spoiled
The owner wants to *play* this game without knowing its mechanics. All game design decisions are Claude's.
- Never describe mechanics, systems, numbers, events, storylines, unlocks, or secrets in chat responses, commit messages, PR descriptions, or README.
- Commit messages: neutral and vague about content (e.g. "Add combat systems", "Expand event content", "Tune balance").
- Design notes live in `design/` (spoilers). Keep them current; never quote them to the owner.
- Ask the owner only about non-mechanical matters (tooling, hosting, UX/controls feel, bugs they hit).

## Constraints
- Web-based: Vite + TypeScript, HTML5 Canvas. Deployed to GitHub Pages on push to `main`.
- Prefer procedural generation for art (canvas/vector) and sound (WebAudio synthesis). Codex may be used for art assets only where procedural falls short.
- Every run must be unique (seeded generation); meta-progression (unlocks/rewards) persists across runs via localStorage.
- UI should feel natural: mouse + keyboard, minimal friction, discoverable controls.

## Commands
- `npm run dev`, `npm run build`, `npm run typecheck`
