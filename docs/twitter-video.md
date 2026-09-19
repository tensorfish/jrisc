# Twitter demo — September 19, 2026

`artifacts/jrisc-twitter.mp4`: 27 seconds, 1080×1080, 30 fps, H.264/yuv420p, fast-start MP4. Silent; all messaging is on screen. Cover: `artifacts/jrisc-twitter-cover.png`.

Opening: “AI if statements? Meet AI assembly.”

- 0–4s: CHOOSE turns a warm message into a rose heart.
- 4–8s: change the message; the same program switches to amber.
- 8–13s: SCORE changes orbit speed from quiet to excited.
- 13–18s: TEST branches at a 60% kindness threshold.
- 18–23s: JUDGE returns four typed decisions from one snapshot.
- 23–27s: “Useful primitive or ridiculous toy?” and the repository address.

Captured from the working browser VM with recording-only layout and caption styles. The landing-page fixtures are illustrative and deterministic; no API requests are made. Every frame identifies the fixed demo responses. The scene changes come from the actual VM, with no speed changes. The ending asks for discussion rather than claiming any measured performance or practical adoption.

Reproduce with the local server running: `node scripts/twitter-video.js`. Raw video, final-frame screenshots, decision traces and the edit manifest are saved under ignored `artifacts/raw/twitter/`. Nothing has been posted.

## Opcode / state-transition cut

`artifacts/jrisc-opcodes.mp4` is the revised 31.6-second square edit. It shows the real VM stepping through CHOOSE, CONF, SCORE, TEST, JUDGE, LI, LD, ST, BEQ, BLT and JMP, with the executed instruction highlighted. Five live state cells show the program counter, R0, first answer slot, palette and energy; changed values are displayed as before → after. The BLT example visibly skips instruction 9. Pixels change on ST, after the semantic instruction has returned.

Reproduce with `node scripts/twitter-state-video.js`. The listing omits the initial five setup instructions, which are executed before each recording. Every displayed state transition comes from reading the actual VM immediately before and after `vm.step()`. Execution is deliberately paced for viewing and labeled “slow step-through”; demo responses remain local fixtures. Raw captures, per-step screenshots, traces and the edit manifest are in `artifacts/raw/state-video/`. This cut ends with “AI belongs in the ISA? You tell me.”

## Instruction-only cut (latest)

`artifacts/jrisc-instruction-set.mp4` is the latest 26.8-second cut. It removes the particle display entirely. The program listing sits beside a large instruction panel showing CHOOSE, CONF, SCORE, TEST and JUDGE and their typed results. CONF is explicitly labeled a local confidence read. State cells show PC, R0, R2 and two decision-bank slots. Fixed fixtures and slow stepping remain disclosed. Reproduce with `node scripts/twitter-opcode-video.js`.
