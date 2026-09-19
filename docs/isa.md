# JRISC 1.0 — experimental ISA

JRISC is a proposed educational design, not an existing standard or a claim of optimality. Eight writable 16-bit registers R0–R7 (no hardwired zero), separate immutable program memory of 1–65,536 instructions, a word-indexed program counter, and 65,536 addressable 16-bit data words. No stack, interrupts, multiplication, floating point or self-modifying code.

## Encoding

Every instruction is 32 bits: opcode [31:28], A [27:25], B [24:22], C [21:19], extension E [18:16] (zero except for opcode 15), immediate I [15:0]. Unused fields must be zero; noncanonical words fault at load. Program addresses count instructions, data addresses count words, so neither has alignment ambiguity. Binary exports use unsigned JSON word values; assembly exports use `.jrisc` text. Opcode 15 uses E=0 for JUDGE, E=1 for CHOOSE, E=2 for SCORE, E=3 for TEST, E=4 for CONF. Other extension values fault. Legacy encodings are unchanged.

| Opcode | Assembly | Effect |
|---|---|---|
| 0 | LI A, I | A ← immediate's 16-bit pattern |
| 1 | MOV A, B | A ← B |
| 2 | ADD A, B, C | A ← B + C modulo 65536 |
| 3 | SUB A, B, C | A ← B − C modulo 65536 |
| 4 | AND A, B, C | bitwise conjunction |
| 5 | OR A, B, C | bitwise inclusive disjunction |
| 6 | XOR A, B, C | bitwise exclusive disjunction |
| 7 | SHL A, B, C | logical left shift; C & 15; keep low 16 bits |
| 8 | SHR A, B, C | logical right shift; C & 15; zero fill |
| 9 | LD A, B, I | A ← memory[B + unsigned I] |
| 10 | ST A, B, I | memory[B + unsigned I] ← A |
| 11 | BEQ A, B, I | if identical bit patterns, PC ← I |
| 12 | BLT A, B, I | if signed two's-complement A < B, PC ← I |
| 13 | JMP I | PC ← I |
| 14 | HALT | stop; PC stays on HALT |
| 15, E=0 | JUDGE I | evaluate descriptor I; atomic decision-bank commit |
| 15, E=1 | CHOOSE A, I | single Choice descriptor; commit bank and put option index in A |
| 15, E=2 | SCORE A, I | single Score descriptor; commit bank and put normalized 0–10000 in A |
| 15, E=3 | TEST A, I | single Noul descriptor; commit bank and put yes probability 0–10000 in A |
| 15, E=4 | CONF A, I | read confidence 0–10000 from committed Choice/Score slot I; no request |

Otherwise PC advances by one. There are no branch delay slots or flags. All integer computation is local. Arithmetic overflow wraps; address addition does **not** wrap. Addresses above 65535 fault. LI accepts decimal −32768…65535 (negative values become two's-complement) or unsigned hexadecimal. Other immediates are 0…65535. Branch targets are absolute instruction indexes. Labels, case-insensitive opcode/register names, commas and semicolon comments are supported. Duplicate labels, invalid operand counts, invalid registers and out-of-program branches are rejected by the assembler.

## Memory map

| Word range | Permissions | Meaning |
|---|---|---|
| 0000–0FFF | read/write | 4096 words of RAM |
| 8000–83FF | read/write | 32×32 framebuffer, row-major; 0 transparent, other words select renderer palette entries modulo 3 |
| E000–E0FF | read only | typed decision projection; faults before first commit |
| F000 | read/write | particle shape: 1 heart, 2 orbit, 3 wave; other values scatter |
| F001 | read/write | palette: 1 rose, 2 ice, 3 amber; other values rose |
| F002 | read/write | particle count: 0 gives 256; renderer clamps other values to 512 |
| F003 | read/write | direction: 65535 reverse, otherwise forward |
| F004 | read/write | energy parameter: word / 10000; validated compiler uses 0–10000 |
| F005 | read/write | reaction counter, wraps like any word |
| all other addresses | fault | unmapped |

The particle device is deliberately higher-level than a raw framebuffer. Its geometry/interpolation is ordinary JavaScript, not Jev output. The VM writes its controls; the renderer reads those words. Wall-clock animation makes the scene fluid; architectural replay reproduces registers, decisions and writes, not exact visual frame timestamps. For raw pixel experiments, write the framebuffer directly.

## JUDGE descriptors and typed decisions

A descriptor contains JSON state plus 1–8 independent questions and is bounded to 16,000 JSON characters. Choice questions have 2–16 options; score questions have 2–8 levels; noul questions have yes/no criteria. This product exposes descriptor 0 with mood, energy, kindness and intent, and descriptors 1–3 with mood, energy and kindness individually. CHOOSE/SCORE/TEST validate the descriptor type before inference. The server owns the question bank. User messages (1–500 characters) supply the `message` field. The generic VM supports prevalidated descriptor tables supplied at load.

On JUDGE, copy and deeply freeze the descriptor and current host context. Every question receives that same snapshot. No question sees any answers from this batch. Answers never become instructions or code. Dependent judgments require another JUDGE with explicitly prepared later state.

The VM enters `judging`; repeated steps cannot advance it. Validate the entire result before projecting any memory. Atomically swap the typed bank and its 256-word projection, then advance PC. Choice IDs, full distributions, confidence values, score values/legends and noul probabilities remain available in the separate JSON decision bank and trace.

Each question uses a 32-word slot in descriptor insertion order:

- +0: type tag: choice=1, score=2, noul=3.
- +1: choice's one-based option index in criteria insertion order; or round(10000 × normalized score); or round(10000 × yes probability).
- +2: round(10000 × confidence) for choice/score; yes probability for noul (not a distinct confidence).
- +3 onward: round(10000 × probability), in criteria order (score levels ascending). Unused words are zero.

Score normalization is score / (number of levels − 1). Independently rounded distributions need not sum to 10000. Probability/score conversion is explicit and lossy; raw values are preserved. Confidence measures concentration, not correctness. The runtime mood mapping warm=1, calm=2, storm=3, unknown=4 allows ordinary LD/BEQ/ST to retain the display on unknown and choose palettes otherwise. The optional kindness branch requires a projected yes probability of at least 6000. Energy is read and shifted right by one for visual damping. ADD increments the reaction counter exactly.

## Faults, recovery, isolation and replay

Bad instruction encodings, missing descriptors, invalid memory, invalid next PC, network/service errors, a 12-second API deadline, a 15-second VM deadline, malformed answer types/distributions/options/legends or replay snapshot mismatches visibly fault execution. The faulting PC is retained. A failed JUDGE preserves the previous bank and all its mapped words. No retries are hidden; reset and send again. Reset creates a fresh VM; generation checks discard late responses from a cancelled VM. A timeout does not commit a later result.

Programs run serially; independent model questions are batched inference, not parallel CPU execution. The UI queues up to eight messages. When a looping program reaches JUDGE without a message, the host waits without executing it. Pause stops scheduling new instructions; an in-flight JUDGE may finish its atomic commit. Step executes one whole instruction, including the complete asynchronous JUDGE. Reset clears architectural state and queued messages.

Traces store initial program words, descriptors, snapshots, validated results, actual model identity, API wall-clock latency, question counts, available token usage, and per-instruction PC/register/display-control states. The compiler record is included in UI downloads. Replay supplies the recorded responses, verifies snapshots, reruns ordinary instructions and makes zero inference calls. Recorded latency remains labeled as the original measurement. Full memory writes are deterministically reconstructed from program execution.

## Research grounding

- [RV32I reference](https://docs.riscv.org/reference/isa/v20260120/unpriv/rv32.html): inspiration for explicit registers, load/store separation, fixed-width encoding and defined integer semantics. JRISC is not RISC-V compatible.
- [Nand2Tetris project 4](https://www.nand2tetris.org/project04): inspiration for a visible small machine and memory-mapped display.
- [Jev System One](https://docs.typesafe.ai/concepts/system-one.md) and [current API](https://docs.typesafe.ai/api.md): bounded typed decisions, no generated assembly.
- [Jev 1.13 limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md): motivates semantic descriptions, literal extraction and exact arithmetic in code.
- [Speculative fan-out](https://docs.typesafe.ai/patterns/fan-out.md): independent questions over shared state, unused answers ignored.

Documentation consulted September 19, 2026 (Australia/Melbourne).

## Example cartridges

CHOOSE maps mood to palette and reads confidence with CONF. SCORE maps emotional energy to motion. TEST branches at a 60% kindness probability, opening the rose gate or leaving it blue. JUDGE asks four independent questions together and uses mood and energy to control a wave. Unknown mood preserves the current palette. The examples are in `examples/choose.jrisc`, `score.jrisc`, `test.jrisc` and `batch.jrisc`.

All semantic instructions share atomic commit, validation, cancellation and replay behavior. CONF faults before a commit, for a missing slot or for a Noul slot, which has no separate confidence. The browser sends only the message, instruction and descriptor ID to the local `/api/proxy`. The server validates that pairing, owns the questions and reads credentials only from `.env`.
