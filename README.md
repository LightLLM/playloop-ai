# PlayLoop AI

Prompt-to-playable 2D story worlds built for OpenAI Build Week. This repository contains a complete local-first MVP: a creator studio, GameSpec compiler, canvas game runtime, branching characters, procedural 2D art directions, touch controls, collisions, objectives, sound effects, ambient audio, and a branded growth-game demo.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local address shown in the terminal. No API key or credit card is needed for the included deterministic demo.

## Production checks

```bash
npm run build
npm test
```

## Included experience

- Generate science-fiction, fantasy, mystery, or adventure worlds from a prompt
- Select Illustrated Adventure, Graphic Novel, or Pixel Art rendering
- Move using WASD, arrow keys, or mobile touch controls
- Collision-aware explorable map
- Discover a clue and talk to a character
- Persistent trust, clue, dialogue, and quest state
- Opt-in Web Audio ambience and interaction sounds
- Branded lead-rescue growth game and simple analytics demo

## Architecture

The current MVP intentionally keeps gameplay deterministic. A prompt is compiled into a validated `GameSpec`; the runtime, rather than an AI model, controls movement, collisions, inventory, and quest state. This makes games testable and prevents generated dialogue from corrupting gameplay.

`examples/neptune-gamespec.json` demonstrates the portable schema that should become the interface between GPT-5.6, the asset pipeline, and a future Phaser runtime.

## Next production integrations

1. Replace the Canvas renderer with Phaser 4 while preserving the GameSpec interface.
2. Add a server-side OpenAI Responses API route for prompt-to-GameSpec compilation.
3. Add GPT Image 2 generation for reference sheets, portraits, props, and scene layers.
4. Process images into WebP texture atlases using Sharp.
5. Store published GameSpecs and assets in Supabase plus Cloudflare R2.
6. Add Playwright bot traversal for quest and soft-lock validation.

Never expose an OpenAI API key in browser code. Put all model calls in a server route and configure secrets through the deployment platform.

## Repository notes

- Generated stories and visual prompts should be original or based on properly licensed/public-domain material.
- The synthetic sound demo uses the browser Web Audio API, so no copyrighted music is included.
- Audio starts only after user interaction to comply with browser autoplay rules.

## License

Choose and add a license before making the repository public. MIT is a common option for hackathon projects, but confirm that it matches your intended commercial use.
