# JRISC observed evaluation

Recorded 2026-09-18T23:34:15.861Z. Model: jev-1.13.0. Small hand-labeled development set; not a general accuracy or calibration estimate. Re-running consumes API usage and may change outcomes.

## Bounded compiler

15/15 requests met their expected acceptance/rejection and specified configuration.

| Request | Expected | Observed | Pass |
|---|---|---|---|
| Make a rose heart that reacts to the mood of incoming messages | {"behavior":"react","target":"heart","palette":"rose"} | {"behavior":"react","target":"heart","palette":"rose","direction":"right","condition":"always","count":256} | yes |
| Arrange 128 pink particles in a heart | {"behavior":"arrange","target":"heart","count":128} | {"behavior":"arrange","target":"heart","palette":"rose","direction":"right","condition":"always","count":128} | yes |
| A tranquil blue ring responding to incoming emotions, counterclockwise | {"behavior":"react","target":"orbit","palette":"ice","direction":"left"} | {"behavior":"react","target":"orbit","palette":"ice","direction":"left","condition":"always","count":256} | yes |
| Show a golden wave of 64 particles | {"behavior":"arrange","target":"wave","count":64,"palette":"amber"} | {"behavior":"arrange","target":"wave","palette":"amber","direction":"right","condition":"always","count":64} | yes |
| Let a heart respond only to caring messages | {"behavior":"react","condition":"kind","target":"heart"} | {"behavior":"react","target":"heart","palette":"rose","direction":"right","condition":"kind","count":256} | yes |
| Sculpt a love symbol from pink dots | {"behavior":"arrange","target":"heart"} | {"behavior":"arrange","target":"heart","palette":"rose","direction":"right","condition":"always","count":256} | yes |
| A circle of icy particles listening to how people feel | {"behavior":"react","target":"orbit","palette":"ice"} | {"behavior":"react","target":"orbit","palette":"ice","direction":"right","condition":"always","count":256} | yes |
| Build a spreadsheet with formulas | null | Outside the supported scene vocabulary. Try a heart, orbit or wave, optionally reacting to emotions. | yes |
| Draw a dragon | null | Outside the supported scene vocabulary. Try a heart, orbit or wave, optionally reacting to emotions. | yes |
| Make a heart with 900 particles | null | Particle count must be an integer from 32 to 512. | yes |
| Make a heart react to stock prices | null | Outside the supported scene vocabulary. Try a heart, orbit or wave, optionally reacting to emotions. | yes |
| Make a heart or a wave, I cannot decide | null | Outside the supported scene vocabulary. Try a heart, orbit or wave, optionally reacting to emotions. | yes |
| Make it nice | null | Outside the supported scene vocabulary. Try a heart, orbit or wave, optionally reacting to emotions. | yes |
| Make a green heart | null | Outside the supported scene vocabulary. Try a heart, orbit or wave, optionally reacting to emotions. | yes |
| A heart with 2.5 particles | null | Particle count must be an integer from 32 to 512. | yes |

## Runtime semantics

4/5 mood labels matched hand labels. Ambiguous mixed emotion is deliberately included.

- You make the world a little brighter. Thank you for being here. → **warm**, expected warm; 304 ms.
- Everything is falling apart! I am furious and overwhelmed! → **storm**, expected storm; 314 ms.
- The lake is still. Breathe slowly. There is no rush. → **calm**, expected calm; 244 ms.
- The package has four items. → **unknown**, expected unknown; 271 ms.
- I love you, but I am furious with you. → **storm**, expected unknown; 362 ms.

## Same questions, batch versus sequential

Three trials, four identical questions over identical state per trial. Alternated which mode went first; no concurrent client requests. Wall-clock includes network and service time, with millisecond rounding. This is not a CPU parallelism benchmark.

| Trial | Batch ms | Sequential ms | Batch tokens | Sequential tokens |
|---|---:|---:|---:|---:|
| 1 | 251 | 1326 | 709 | 1557 |
| 2 | 271 | 1195 | 706 | 1545 |
| 3 | 273 | 1040 | 711 | 1562 |

Mean: batch **265 ms**, sequential **1187 ms**. These observations do not guarantee a speedup. Tokens include input plus output; no monetary cost inferred. Raw question banks, distributions, individual request timings, model identity, usage and failures are in evaluation.json.

## Initial failure and iteration

The first compiler run passed 10/15 cases. Five supported requests were rejected because the model selected unsupported when direction was omitted. We added an explicit unspecified direction option and applied the default in code. The 15/15 result is a development-set rerun after that fix, not held-out validation. Original responses are retained in evaluation-initial.json.

## Limitations

Single model/service/date, small development set, no repeated accuracy sampling, no human inter-rater study. Harmless aesthetic choices use a selected-option probability threshold of 0.5; this is a prototype policy, not a validated reliability bound. Kindness uses 0.6. Speculative condition results are ignored for static scenes. Animation is a deterministic renderer with a wall-clock presentation layer; traces replay architectural state, not frame timing.
