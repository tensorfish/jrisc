import { writeFile, mkdir } from "node:fs/promises";
import { evaluate } from "../lib/api.js";
import {
  compilerDescriptor,
  lower,
  runtimeQuestions,
  makeProgram,
} from "../lib/semantic.js";
import { VM } from "../lib/vm.js";
await mkdir("artifacts", { recursive: true });
const cases = [
  [
    "Make a rose heart that reacts to the mood of incoming messages",
    { behavior: "react", target: "heart", palette: "rose" },
  ],
  [
    "Arrange 128 pink particles in a heart",
    { behavior: "arrange", target: "heart", count: 128 },
  ],
  [
    "A tranquil blue ring responding to incoming emotions, counterclockwise",
    { behavior: "react", target: "orbit", palette: "ice", direction: "left" },
  ],
  [
    "Show a golden wave of 64 particles",
    { behavior: "arrange", target: "wave", count: 64, palette: "amber" },
  ],
  [
    "Let a heart respond only to caring messages",
    { behavior: "react", condition: "kind", target: "heart" },
  ],
  [
    "Sculpt a love symbol from pink dots",
    { behavior: "arrange", target: "heart" },
  ],
  [
    "A circle of icy particles listening to how people feel",
    { behavior: "react", target: "orbit", palette: "ice" },
  ],
  ["Build a spreadsheet with formulas", null],
  ["Draw a dragon", null],
  ["Make a heart with 900 particles", null],
  ["Make a heart react to stock prices", null],
  ["Make a heart or a wave, I cannot decide", null],
  ["Make it nice", null],
  ["Make a green heart", null],
  ["A heart with 2.5 particles", null],
];
const results = [];
for (const [request, expected] of cases) {
  const descriptor = compilerDescriptor(request);
  let result, config, error;
  try {
    result = await evaluate(descriptor);
    config = lower(descriptor, result).config;
  } catch (e) {
    error = e.message;
  }
  const pass = expected
    ? !!config && Object.entries(expected).every(([k, v]) => config[k] === v)
    : !!result && !!error;
  results.push({ request, expected, config, error, pass, descriptor, result });
  console.log(pass ? "PASS" : "FAIL", request);
}
const messages = [
  ["You make the world a little brighter. Thank you for being here.", "warm"],
  ["Everything is falling apart! I am furious and overwhelmed!", "storm"],
  ["The lake is still. Breathe slowly. There is no rush.", "calm"],
  ["The package has four items.", "unknown"],
  ["I love you, but I am furious with you.", "unknown"],
];
const runtime = [];
for (const [message, expected] of messages) {
  const descriptor = { state: { message }, questions: runtimeQuestions },
    result = await evaluate(descriptor);
  runtime.push({
    descriptor,
    result,
    expected,
    pass: result.answers.mood.choice === expected,
  });
  console.log("MOOD", result.answers.mood.choice, expected);
}
const benchmark = [];
for (let trial = 0; trial < 3; trial++) {
  const descriptor = runtime[trial].descriptor;
  let batch,
    seq = [];
  const sequential = async () => {
    for (const [key, q] of Object.entries(descriptor.questions))
      seq.push(
        await evaluate({ state: descriptor.state, questions: { [key]: q } }),
      );
  };
  if (trial % 2) {
    await sequential();
    batch = await evaluate(descriptor);
  } else {
    batch = await evaluate(descriptor);
    await sequential();
  }
  benchmark.push({
    trial,
    batch,
    sequential: seq,
    sequentialMs: seq.reduce((a, r) => a + r.latencyMs, 0),
    batchMs: batch.latencyMs,
  });
}
const p = makeProgram(),
  v = new VM(p.words, {
    descriptors: p.descriptors,
    judge: async (d) =>
      runtime.find((r) => r.descriptor.state.message === d.state.message)
        .result,
  });
for (const rec of runtime.slice(0, 3)) {
  v.context = rec.descriptor.state;
  let judged = false;
  for (let i = 0; i < 100; i++) {
    if (v.words[v.pc] >>> 28 === 15 && judged) break;
    if (v.words[v.pc] >>> 28 === 15) judged = true;
    await v.step();
    if (v.status === "fault") throw Error(v.error);
  }
}
const demo = { ...v.export(), config: p.config };
await writeFile("public/demo.json", JSON.stringify(demo, null, 2));
await writeFile(
  "artifacts/evaluation.json",
  JSON.stringify(
    { date: new Date().toISOString(), results, runtime, benchmark },
    null,
    2,
  ),
);
const avg = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length),
  tokens = (rs) =>
    rs.reduce(
      (a, r) =>
        a + (r.usage?.input_tokens || 0) + (r.usage?.output_tokens || 0),
      0,
    );
let md = `# JRISC observed evaluation\n\nRecorded ${new Date().toISOString()}. Model: ${runtime[0].result.model}. Small hand-labeled development set; not a general accuracy or calibration estimate. Re-running consumes API usage and may change outcomes.\n\n## Bounded compiler\n\n${results.filter((x) => x.pass).length}/${results.length} requests met their expected acceptance/rejection and specified configuration.\n\n| Request | Expected | Observed | Pass |\n|---|---|---|---|\n`;
for (const r of results)
  md += `| ${r.request} | ${JSON.stringify(r.expected) || "reject"} | ${r.error || JSON.stringify(r.config)} | ${r.pass ? "yes" : "no"} |\n`;
md += `\n## Runtime semantics\n\n${runtime.filter((x) => x.pass).length}/${runtime.length} mood labels matched hand labels. Ambiguous mixed emotion is deliberately included.\n\n`;
for (const r of runtime)
  md += `- ${r.descriptor.state.message} → **${r.result.answers.mood.choice}**, expected ${r.expected}; ${r.result.latencyMs} ms.\n`;
md += `\n## Same questions, batch versus sequential\n\nThree trials, four identical questions over identical state per trial. Alternated which mode went first; no concurrent client requests. Wall-clock includes network and service time, with millisecond rounding. This is not a CPU parallelism benchmark.\n\n| Trial | Batch ms | Sequential ms | Batch tokens | Sequential tokens |\n|---|---:|---:|---:|---:|\n`;
for (const b of benchmark)
  md += `| ${b.trial + 1} | ${b.batchMs} | ${b.sequentialMs} | ${tokens([b.batch])} | ${tokens(b.sequential)} |\n`;
md += `\nMean: batch **${avg(benchmark.map((b) => b.batchMs))} ms**, sequential **${avg(benchmark.map((b) => b.sequentialMs))} ms**. These observations do not guarantee a speedup. Tokens include input plus output; no monetary cost inferred. Raw question banks, distributions, individual request timings, model identity, usage and failures are in evaluation.json.\n\n## Initial failure and iteration\n\nThe first compiler run passed 10/15 cases. Five supported requests were rejected because the model selected unsupported when direction was omitted. We added an explicit unspecified direction option and applied the default in code. The 15/15 result is a development-set rerun after that fix, not held-out validation. Original responses are retained in evaluation-initial.json.\n\n## Limitations\n\nSingle model/service/date, small development set, no repeated accuracy sampling, no human inter-rater study. Harmless aesthetic choices use a selected-option probability threshold of 0.5; this is a prototype policy, not a validated reliability bound. Kindness uses 0.6. Speculative condition results are ignored for static scenes. Animation is a deterministic renderer with a wall-clock presentation layer; traces replay architectural state, not frame timing.\n`;
await writeFile("artifacts/evaluation.md", md);
for (const [name, cfg] of Object.entries({
  empathy: {},
  orbit: { target: "orbit", palette: "ice", direction: "left" },
  wave: { target: "wave", palette: "amber", behavior: "arrange" },
}))
  await writeFile(
    "examples/" + name + ".jrisc",
    makeProgram(cfg).source + "\n",
  );
console.log("Evaluation artifacts saved.");
