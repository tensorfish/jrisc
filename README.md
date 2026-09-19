# JRISC

**A tiny computer where ordinary instructions calculate, and AI instructions understand.**

An interactive 16-bit experimental computer with 20 instructions, eight registers, a deterministic assembler/interpreter, memory-mapped particles and a framebuffer, and a `JUDGE` instruction that calls Jev for independent typed judgments in one request.

## Static site

```sh
npm install
npm run build
npm run preview
```

Open http://localhost:4174. Deploy the contents of `dist/` to any static host. No server, API key or `.env` is required for the landing page. Asset paths are relative, so the build also works under a URL subdirectory. The build includes only the page, styles, browser modules and ISA manual. Google Fonts is optional; system fonts are the fallback.

The demos execute the real VM with fixed local responses. To verify the built site while preview is running: `JRISC_URL=http://localhost:4174 npm run check:browser`.

## Optional local proxy

Node 22+ required. Place `TYPESAFE_API_KEY` in `.env` (server-only, ignored by Git), then:

```sh
npm install
npm start
```

Open http://localhost:4173. The server binds only to loopback. No credentials reach the browser. Static files are served by an explicit allowlist. Runtime question banks are server-owned; inputs are bounded. This local prototype does not include multi-user authentication, persistent storage or a public deployment.

Explore the 20 opcode keys, then run CHOOSE (mood palette), SCORE (motion energy), TEST (kindness gate), or JUDGE (parallel judgments). Each example has contrasting inputs and shows its complete program. Open the machine to step, edit assembly, inspect registers or replay without another inference request. The landing-page programs use fixed, illustrative typed responses and make no API calls. Pick an example message to execute the real VM deterministically; these are demos, not live inference. The local `/api/proxy` remains available for integrations and keeps TypeSafe credentials from `.env` server-side.

Supported composition: one heart/orbit/wave, static or reacting to emotion, rose/ice/amber, left/right movement, 32–512 particles, optionally responding only to kindness. Literal numeric candidates are extracted in code. Jev selects bounded components; deterministic code checks compatibility and lowers a known template. It does not generate arbitrary software. Vague and unsupported requests are rejected visibly.

See [the redesign research and decisions](docs/design-research.md) for the instruction-first layout and fantasy-computer theme.

## Verification and deliverables

```sh
npm test
npm run evaluate             # live API usage; writes measured reports
node scripts/browser-check.js # running server required; live API usage
npm run record               # running server required; live recordings
npm run video                # Python 3 required; local FFmpeg installed by npm
```

Install the recording browser once with `npx playwright install chromium`.

- [Documented ISA](docs/isa.md), [example programs](examples/)
- [Measured evaluation](artifacts/evaluation.md), [raw results](artifacts/evaluation.json), [initial failures](artifacts/evaluation-initial.json)
- [Main 30-second square video](artifacts/jrisc-main.mp4), [14-second cutdown](artifacts/jrisc-cutdown.mp4)
- [Thumbnail](artifacts/thumbnail.png), [launch post](artifacts/launch-post.md)
- Reproducible recording/edit: [record.js](scripts/record.js), [render-video.py](scripts/render-video.py)

The semantic evaluation is a small development set. An initial omitted-direction failure was fixed by giving “unspecified” its own option, then defaulting in code. Ambiguous mixed emotion still has a documented failure. The benchmark compares identical independent questions in one batch versus four sequential requests; it does not establish guaranteed latency or accuracy.

The showcase uses real browser footage, large sound-off captions and short cuts. No footage is sped up; idle gaps are edited out. See [X's creative guidance](https://business.x.com/en/advertising/creative-best-practices) for the inspiration, not a promise of organic reach. No post has been published.
