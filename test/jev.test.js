import test from "node:test";
import assert from "node:assert/strict";
import { VM, assemble, disassemble, decode, SEMANTIC_OPS } from "../lib/vm.js";
import { DESCRIPTORS, makeCartridge } from "../lib/semantic.js";
import { createApp } from "../server.js";
function fixture(d, { mood = "warm", energy = 1, kindness = 0.9 } = {}) {
  return {
    model: "fixture",
    questionCount: Object.keys(d.questions).length,
    latencyMs: 1,
    answers: Object.fromEntries(
      Object.entries(d.questions).map(([id, q]) => {
        if (q.type === "choice") {
          const choice = id === "mood" ? mood : "connect";
          return [
            id,
            {
              type: "choice",
              choice,
              confidence: 0.8,
              probabilities: Object.fromEntries(
                Object.keys(q.criteria).map((k) => [k, k === choice ? 1 : 0]),
              ),
            },
          ];
        }
        if (q.type === "score")
          return [
            id,
            {
              type: "score",
              score: energy,
              confidence: 0.8,
              legend: Object.fromEntries(q.criteria.map((v, i) => [i, v])),
              probabilities: {
                0: energy === 0 ? 1 : 0,
                1: energy === 1 ? 1 : 0,
                2: energy === 2 ? 1 : 0,
              },
            },
          ];
        return [id, { type: "noul", noul: kindness }];
      }),
    ),
  };
}
async function cycle(vm, message = "test") {
  vm.context = { message };
  let seen = false;
  for (let n = 0; n < 100; n++) {
    const op = decode(vm.words[vm.pc]).op;
    if (seen && SEMANTIC_OPS.includes(op)) return;
    if (SEMANTIC_OPS.includes(op)) seen = true;
    await vm.step();
    assert.notEqual(vm.status, "fault", vm.error);
  }
  throw Error("Program did not return to input");
}
test("Jev extensions round-trip without changing legacy words", () => {
  const old = assemble("JUDGE 0\nHALT");
  assert.equal(old[0], 0xf0000000);
  const words = assemble(
    "CHOOSE R0, 1\nSCORE R1, 2\nTEST R2, 3\nCONF R3, 0\nHALT",
  );
  assert.deepEqual(assemble(disassemble(words)), words);
  assert.throws(() => decode(0xf0070000));
});
for (const kind of ["choose", "score", "test", "batch"])
  test(kind + " cartridge executes, reacts and replays", async () => {
    const p = makeCartridge(kind);
    let input = {};
    const vm = new VM(p.words, {
      descriptors: p.descriptors,
      judge: async (d) => fixture(d, input),
    });
    await cycle(vm, "warm");
    assert.equal(
      vm.mem[0xf000],
      kind === "score" ? 2 : kind === "batch" ? 3 : 1,
    );
    if (kind === "score") {
      assert.equal(vm.r[0], 5000);
      assert.equal(vm.mem[0xf004], 5000);
      input = { energy: 2 };
    } else if (kind === "test") {
      assert.equal(vm.r[0], 9000);
      assert.equal(vm.mem[0xf001], 1);
      input = { kindness: 0.1 };
    } else {
      assert.equal(vm.mem[0xf001], 1);
      input = { mood: "storm" };
      if (kind === "choose") assert.equal(vm.r[2], 8000);
    }
    await cycle(vm, "changed");
    assert.equal(
      vm.mem[kind === "score" ? 0xf004 : 0xf001],
      kind === "score" ? 10000 : kind === "test" ? 2 : 3,
    );
    if (kind === "choose" || kind === "batch") {
      input = { mood: "unknown" };
      await cycle(vm, "unknown");
      assert.equal(vm.mem[0xf001], 3);
    }
    let calls = 0;
    const replay = new VM(p.words, {
      descriptors: p.descriptors,
      replay: vm.decisions,
      judge: () => calls++,
    });
    for (const decision of vm.decisions)
      await cycle(replay, decision.descriptor.state.message);
    assert.deepEqual(replay.trace, vm.trace);
    assert.equal(calls, 0);
  });
test("primitive rejects incompatible descriptor without a request", async () => {
  let calls = 0;
  const vm = new VM(assemble("CHOOSE R0, 2\nHALT"), {
    descriptors: DESCRIPTORS,
    judge: () => calls++,
  });
  await vm.step();
  assert.equal(vm.status, "fault");
  assert.equal(calls, 0);
});
test("CONF reads descriptor order and rejects Noul slot", async () => {
  const vm = new VM(assemble("JUDGE 0\nCONF R0, 0\nCONF R1, 2\nHALT"), {
    descriptors: DESCRIPTORS,
    judge: async (d) => {
      const r = fixture(d);
      r.answers = Object.fromEntries(Object.entries(r.answers).reverse());
      return r;
    },
  });
  await vm.step();
  await vm.step();
  assert.equal(vm.r[0], 8000);
  await vm.step();
  assert.match(vm.error, /no.*confidence|not a confidence/);
});
test("primitive timeout preserves destination and bank", async () => {
  const vm = new VM(assemble("LI R0, 42\nSCORE R0, 2\nHALT"), {
    descriptors: DESCRIPTORS,
    timeout: 5,
    judge: () => new Promise(() => {}),
  });
  await vm.step();
  await vm.step();
  assert.equal(vm.status, "fault");
  assert.equal(vm.r[0], 42);
  assert.equal(vm.bank, null);
});
test("local proxy fixes questions, rejects origin/mismatch and never serves env", async (t) => {
  const calls = [];
  const server = createApp({
    evaluateRequest: async (d) => {
      calls.push(d);
      return fixture(d);
    },
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = "http://127.0.0.1:" + server.address().port;
  const post = (body, origin = base) =>
    fetch(base + "/api/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(body),
    });
  const good = await post({
    instruction: "CHOOSE",
    descriptorId: 1,
    message: "hello",
    questions: { injected: true },
    url: "https://example.com",
  });
  assert.equal(good.status, 200);
  assert.deepEqual(calls[0], {
    state: { message: "hello" },
    questions: DESCRIPTORS[1].questions,
  });
  assert.equal(
    (await post({ instruction: "SCORE", descriptorId: 1, message: "x" }))
      .status,
    400,
  );
  assert.equal(
    (await post({ message: "x" }, "https://example.com")).status,
    403,
  );
  assert.equal((await fetch(base + "/.env")).status, 404);
  assert.equal(calls.length, 1);
});
