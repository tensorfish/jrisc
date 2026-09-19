import test from "node:test";
import assert from "node:assert/strict";
import { VM, assemble, disassemble, validateResult } from "../lib/vm.js";
import { makeProgram, lower, compilerDescriptor } from "../lib/semantic.js";
const run = async (source, opts) => {
  const vm = new VM(assemble(source), opts);
  for (let n = 0; n < 300 && !["halted", "fault"].includes(vm.status); n++)
    await vm.step();
  return vm;
};
const d = {
  state: { message: "hi" },
  questions: {
    mood: {
      type: "choice",
      instructions: "Mood?",
      criteria: { yes: "yes", no: "no" },
    },
  },
};
const result = {
  model: "test",
  answers: {
    mood: {
      type: "choice",
      choice: "yes",
      probabilities: { yes: 0.8, no: 0.2 },
      confidence: 0.6,
    },
  },
};
test("all opcodes assembler disassembler round trip", () => {
  const s =
    "LI R0, -1\nMOV R1, R0\nADD R2, R0, R1\nSUB R2, R0, R1\nAND R3, R0, R1\nOR R3, R0, R1\nXOR R3, R0, R1\nSHL R3, R0, R1\nSHR R3, R0, R1\nLD R0, R1, 8\nST R0, R1, 9\nBEQ R0, R1, 0\nBLT R0, R1, 0\nJMP 0\nJUDGE 0\nHALT";
  const w = assemble(s);
  assert.deepEqual(assemble(disassemble(w)), w);
});
test("arithmetic wraps and all bitwise operations are exact", async () => {
  const v = await run(
    "LI R0, 65535\nLI R1, 1\nADD R2, R0, R1\nSUB R3, R2, R1\nAND R4, R0, R1\nOR R5, R2, R1\nXOR R6, R0, R1\nSHL R7, R1, R1\nSHR R0, R0, R1\nHALT",
  );
  assert.deepEqual([...v.r], [32767, 1, 0, 65535, 1, 1, 65534, 2]);
});
test("signed comparison and equality branches", async () => {
  const v = await run(
    "LI R0, -1\nLI R1, 1\nBLT R0, R1, ok\nHALT\nok: MOV R2, R1\nBEQ R1, R2, end\nLI R3, 9\nend: HALT",
  );
  assert.equal(v.r[2], 1);
  assert.equal(v.r[3], 0);
});
test("shift count uses low four bits", async () => {
  const v = await run("LI R0, 1\nLI R1, 17\nSHL R2, R0, R1\nHALT");
  assert.equal(v.r[2], 2);
});
test("memory write/load and display writes", async () => {
  const v = await run(
    "LI R0, 42\nLI R1, 0\nST R0, R1, 3\nLD R2, R1, 3\nLI R1, 61440\nST R0, R1, 0\nHALT",
  );
  assert.equal(v.r[2], 42);
  assert.equal(v.mem[61440], 42);
});
for (const addr of [4096, 57344, 65535])
  test("fault on protected/unmapped store " + addr, async () => {
    const v = await run(`LI R0, ${addr}\nST R1, R0, 0\nHALT`);
    assert.equal(v.status, "fault");
  });
test("address arithmetic never wraps", async () => {
  const v = await run("LI R0, 65535\nLD R1, R0, 1\nHALT");
  assert.match(v.error, /overflow/);
});
test("bad assembly and encoding rejected", () => {
  for (const s of [
    "LI R8, 2",
    "LI R1, 65536",
    "JMP 99",
    "BOGUS",
    "HALT 2",
    "x: HALT\nx: HALT",
  ])
    assert.throws(() => assemble(s));
  assert.throws(() => new VM([0xe0010000]));
});
test("batch immutable, atomic, replay deterministic", async () => {
  let release;
  const v = new VM(assemble("JUDGE 0\nLI R1, 57344\nLD R0, R1, 1\nHALT"), {
    descriptors: { 0: d },
    judge: async (snapshot) => {
      assert(Object.isFrozen(snapshot.state));
      assert(!("answers" in snapshot.state));
      await new Promise((r) => (release = r));
      return result;
    },
  });
  const pending = v.step();
  assert.equal(v.status, "judging");
  assert.equal(v.pc, 0);
  assert.equal(v.bank, null);
  await v.step();
  assert.equal(v.pc, 0);
  release();
  await pending;
  await v.step();
  await v.step();
  await v.step();
  assert.equal(v.r[0], 1);
  let calls = 0;
  const replay = new VM(v.words, {
    descriptors: { 0: d },
    replay: v.decisions,
    judge: () => calls++,
  });
  for (let i = 0; i < 4; i++) await replay.step();
  assert.deepEqual(replay.trace, v.trace);
  assert.equal(calls, 0);
});
test("malformed response faults without partial commit", async () => {
  const v = await run("JUDGE 0\nHALT", {
    descriptors: { 0: d },
    judge: async () => ({ ...result, answers: {} }),
  });
  assert.equal(v.status, "fault");
  assert.equal(v.bank, null);
  assert.equal(v.mem[57345], 0);
});
test("timeout and reset recovery", async () => {
  const v = await run("JUDGE 0\nHALT", {
    descriptors: { 0: d },
    timeout: 5,
    judge: () => new Promise(() => {}),
  });
  assert.match(v.error, /timeout/);
  const recovered = await run("JUDGE 0\nHALT", {
    descriptors: { 0: d },
    judge: async () => result,
  });
  assert.equal(recovered.status, "halted");
});
test("cancellation ignores late response", async () => {
  let release;
  const v = new VM(assemble("JUDGE 0\nHALT"), {
    descriptors: { 0: d },
    judge: () => new Promise((r) => (release = r)),
  });
  const p = v.step();
  v.cancel();
  release(result);
  await p;
  assert.equal(v.bank, null);
  assert.equal(v.status, "cancelled");
});
test("invalid probabilities and options rejected", () => {
  for (const a of [
    { ...result.answers.mood, choice: "other" },
    { ...result.answers.mood, probabilities: { yes: 1, no: 1 } },
    { ...result.answers.mood, confidence: NaN },
  ])
    assert.throws(() => validateResult(d, { ...result, answers: { mood: a } }));
});
test("inactive speculative condition ignored, unsupported active choice rejected", () => {
  const desc = compilerDescriptor("show a heart");
  const vals = {
    behavior: "arrange",
    target: "heart",
    condition: "unsupported",
    palette: "rose",
    direction: "right",
    count: "default",
  };
  const res = {
    model: "test",
    answers: Object.fromEntries(
      Object.entries(desc.questions).map(([id, q]) => [
        id,
        {
          type: "choice",
          choice: vals[id],
          confidence: 1,
          probabilities: Object.fromEntries(
            Object.keys(q.criteria).map((k) => [k, k === vals[id] ? 1 : 0]),
          ),
        },
      ]),
    ),
  };
  assert.equal(lower(desc, res).config.behavior, "arrange");
  res.answers.target.choice = "unsupported";
  assert.throws(() => lower(desc, res));
});
test("example configurations compile and run setup", async () => {
  for (const target of ["heart", "orbit", "wave"]) {
    const p = makeProgram({ target, behavior: "arrange" });
    const v = await run(p.source);
    assert.equal(v.status, "halted");
    assert.equal(v.mem[0xf002], 256);
  }
});
test("memory projection uses criteria order, not response object order", async () => {
  const v = await run("JUDGE 0\nHALT", {
    descriptors: { 0: d },
    judge: async () => ({
      ...result,
      answers: {
        mood: { ...result.answers.mood, probabilities: { no: 0.2, yes: 0.8 } },
      },
    }),
  });
  assert.equal(v.mem[0xe003], 8000);
  assert.equal(v.mem[0xe004], 2000);
});
test("score projection normalizes before fixed-point conversion", async () => {
  const descriptor = {
    state: {},
    questions: {
      energy: {
        type: "score",
        instructions: "Energy?",
        criteria: ["low", "mid", "high"],
      },
    },
  };
  const response = {
    model: "test",
    answers: {
      energy: {
        type: "score",
        score: 1.5,
        confidence: 0.5,
        probabilities: { 0: 0, 1: 0.5, 2: 0.5 },
        legend: { 0: "low", 1: "mid", 2: "high" },
      },
    },
  };
  const v = await run("JUDGE 0\nHALT", {
    descriptors: { 0: descriptor },
    judge: async () => response,
  });
  assert.equal(v.mem[0xe001], 7500);
});
test("numeric candidates preserve negative and fractional literals", () => {
  assert.deepEqual(
    compilerDescriptor("Show -32 or 2.5 heart particles").state.candidates,
    ["-32", "2.5"],
  );
});
test("failed later batch preserves committed memory", async () => {
  let calls = 0;
  const v = new VM(assemble("JUDGE 0\nJUDGE 0\nHALT"), {
    descriptors: { 0: d },
    judge: async () => (++calls === 1 ? result : { model: "bad", answers: {} }),
  });
  await v.step();
  const page = [...v.mem.slice(0xe000, 0xe100)];
  await v.step();
  assert.equal(v.status, "fault");
  assert.equal(v.pc, 1);
  assert.deepEqual([...v.mem.slice(0xe000, 0xe100)], page);
});
test("replay rejects a different snapshot", async () => {
  const v = await run("JUDGE 0\nHALT", {
    descriptors: { 0: d },
    replay: [{ descriptor: { ...d, state: { message: "changed" } }, result }],
  });
  assert.equal(v.status, "fault");
  assert.match(v.error, /snapshot mismatch/);
});

test("12-instruction teaching cartridge branches on mood and retains color on unknown", async () => {
  const { makeTinyProgram, runtimeQuestions } =
    await import("../lib/semantic.js");
  const p = makeTinyProgram();
  assert.equal(p.words.length, 12);
  let mood = "warm";
  const fixture = () => ({
    model: "test",
    answers: Object.fromEntries(
      Object.entries(runtimeQuestions).map(([id, q]) => [
        id,
        q.type === "choice"
          ? {
              type: "choice",
              choice: id === "mood" ? mood : "connect",
              confidence: 1,
              probabilities: Object.fromEntries(
                Object.keys(q.criteria).map((k) => [
                  k,
                  k === (id === "mood" ? mood : "connect") ? 1 : 0,
                ]),
              ),
            }
          : q.type === "score"
            ? {
                type: "score",
                score: 1,
                confidence: 1,
                legend: Object.fromEntries(
                  q.criteria.map((v, i) => [String(i), v]),
                ),
                probabilities: { 0: 0, 1: 1, 2: 0 },
              }
            : { type: "noul", noul: 0.9 },
      ]),
    ),
  });
  const v = new VM(p.words, {
    descriptors: p.descriptors,
    judge: async () => fixture(),
  });
  for (let n = 0; n < 5; n++) await v.step();
  assert.equal(v.mem[0xf000], 1);
  assert.equal(v.mem[0xf002], 256);
  for (const [label, expected] of [
    ["warm", 1],
    ["storm", 3],
    ["unknown", 3],
  ]) {
    mood = label;
    await v.step();
    for (let n = 0; n < 20 && v.pc !== 5; n++) await v.step();
    assert.equal(v.status, "ready");
    assert.equal(v.mem[0xf001], expected);
  }
});
