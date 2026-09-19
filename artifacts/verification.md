# Verification

- 23 automated tests pass: all instruction encodings round-trip, arithmetic wrapping, shifts, signed/equality branches, memory permissions and overflow, immutable/atomic batches, malformed results, timeouts and reset recovery, cancellation, inactive speculative answers, score/probability projections, literal extraction and replay snapshot validation, and the complete 12-instruction teaching program for warm/storm/unknown input.
- Redesigned browser checks pass: 16 interactive opcode keys, keyboard navigation, all 12 teaching-program lines visible, unsupported-request handling, reduced motion, and live natural-language compilation, two live runtime JUDGE batches, matching palette memory changes, reset, replay without requests, mobile width and no JavaScript errors. Captures: app-desktop.png, app-mobile.png; recorded execution: browser-trace.json.
- Semantic development set: 15/15 compiler cases after one documented prompt revision; 4/5 runtime mood labels. This is not held-out validation. Initial and final raw responses retained.
- Three equivalent-input latency trials: 265 ms mean batch; 1187 ms mean sequential. Actual model: jev-1.13.0. Per-request tokens and timing in evaluation.json.
- Finished videos verified with ffprobe and fully decoded by FFmpeg: main exactly 30.000s, cutdown exactly 14.000s; both H.264, 1080×1080, 30 fps, yuv420p. Visual frames inspected at main-film seconds 1, 4, 12, 22 and 28. Silent, no speed changes.
- Generated source/text artifacts scanned against the local API credential: no leaks found. Credential remains in ignored .env, used only by server-side fetch.

Design research, decisions and source links: docs/design-research.md. Redesigned desktop/mobile captures: artifacts/redesign-desktop.png, artifacts/redesign-mobile.png, artifacts/redesign-playground.png.
