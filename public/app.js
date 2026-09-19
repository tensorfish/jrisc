import { VM, assemble, disassemble, decode, SEMANTIC_OPS } from "./lib/vm.js";
import {
  makeProgram,
  makeTinyProgram,
  makeCartridge,
  DEMO_EXAMPLES as hooks,
  demoResponse,
} from "./lib/semantic.js";
const $ = (id) => document.getElementById(id),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let program,
  vm,
  running = false,
  generation = 0,
  queue = [],
  saved = null,
  compilerRecord = null,
  streaming = false,
  runToken = 0;
const notice = (s, error = false) => {
  if ($("notice").textContent === s) return;
  $("notice").textContent = s;
  $("notice").className = error ? "error" : "";
};
const instructionGuide = [
  [
    "LI",
    "Load value",
    "DATA",
    "Put a number in a register.",
    "Load an exact 16-bit value. No guessing, no model call. Registers are the machine’s eight small working spaces.",
    "LI R0, 42",
    "R0 ← 42",
  ],
  [
    "MOV",
    "Copy register",
    "DATA",
    "Copy a value. Keep the original.",
    "Move the value from one register into another. The source register stays unchanged.",
    "MOV R1, R0",
    "R1 ← R0",
  ],
  [
    "ADD",
    "Add",
    "MATH",
    "Two numbers. An exact sum.",
    "Add two register values locally. Like all JRISC arithmetic, the result wraps to 16 bits when it overflows.",
    "ADD R2, R0, R1",
    "If R0 = 7 and R1 = 5, R2 becomes 12",
  ],
  [
    "SUB",
    "Subtract",
    "MATH",
    "Find the difference.",
    "Subtract the second source register from the first. The low 16 bits become the destination value.",
    "SUB R2, R0, R1",
    "If R0 = 7 and R1 = 5, R2 becomes 2",
  ],
  [
    "AND",
    "Mask bits",
    "BITS",
    "Keep the bits they share.",
    "A result bit is 1 only when both matching input bits are 1. Useful for isolating part of a value.",
    "AND R2, R0, R1",
    "1100 AND 1010 → 1000",
  ],
  [
    "OR",
    "Combine bits",
    "BITS",
    "Keep either bit.",
    "A result bit is 1 when either matching input bit is 1. Useful for combining flags.",
    "OR R2, R0, R1",
    "1100 OR 1010 → 1110",
  ],
  [
    "XOR",
    "Toggle bits",
    "BITS",
    "Find the bits that differ.",
    "A result bit is 1 when the matching input bits are different. Equal values XOR to zero.",
    "XOR R2, R0, R1",
    "1100 XOR 1010 → 0110",
  ],
  [
    "SHL",
    "Shift left",
    "BITS",
    "Slide the bits to the left.",
    "Shift a register left, filling with zeroes. The low four bits of the shift register select how far to move.",
    "SHL R2, R0, R1",
    "If R0 = 3 and R1 = 1, R2 becomes 6",
  ],
  [
    "SHR",
    "Shift right",
    "BITS",
    "Slide the bits to the right.",
    "Shift right with zero fill. This is a logical shift: it does not preserve the sign bit.",
    "SHR R2, R0, R1",
    "If R0 = 8 and R1 = 1, R2 becomes 4",
  ],
  [
    "LD",
    "Read memory",
    "MEMORY",
    "Bring memory into a register.",
    "Read one word at a base register plus an offset. This is how ordinary code reads a committed Jev decision.",
    "LD R0, R6, 1",
    "R0 ← memory[R6 + 1] · the selected mood",
  ],
  [
    "ST",
    "Write memory",
    "MEMORY",
    "A memory write. A visible change.",
    "Store a register value at a base address plus an offset. Writes to display memory change what you see on screen.",
    "ST R0, R7, 1",
    "memory[R7 + 1] ← R0 · set the palette",
  ],
  [
    "BEQ",
    "Branch if equal",
    "CONTROL",
    "If they match, take another path.",
    "Compare two register values. Jump to an instruction when they are equal; otherwise continue to the next instruction.",
    "BEQ R0, R1, 5",
    "Mood is unknown? Go back to JUDGE",
  ],
  [
    "BLT",
    "Branch if less",
    "CONTROL",
    "Compare, then choose a path.",
    "Jump when the first register is less than the second, interpreted as signed 16-bit values.",
    "BLT R0, R1, 5",
    "If R0 < R1, continue at instruction 5",
  ],
  [
    "JMP",
    "Jump",
    "CONTROL",
    "Go straight to another instruction.",
    "Set the program counter to an instruction address. A jump back to JUDGE makes our message loop.",
    "JMP 5",
    "Next instruction ← 5",
  ],
  [
    "HALT",
    "Stop",
    "CONTROL",
    "That’s all, little computer.",
    "Stop execution and leave the program counter on HALT. Reset to start the program again.",
    "HALT",
    "Machine state stays available to inspect",
  ],
  [
    "JUDGE",
    "Understand",
    "SEMANTIC",
    "Ask questions. Understand the input.",
    "Jev evaluates independent questions about one snapshot in a single request. The computer waits, then commits every answer together.",
    "JUDGE 0",
    "message → mood, energy, kindness, intent",
  ],
];
instructionGuide.push(
  [
    "CHOOSE",
    "Pick an option",
    "JEV",
    "Choose an option.",
    "One Choice question. The selected option’s one-based ID goes into a register.",
    "CHOOSE R0, 1",
    "R0 ← mood ID (1–4)",
  ],
  [
    "SCORE",
    "Rate a level",
    "JEV",
    "Score the input.",
    "One Score question. Code normalizes the result to 0–10000.",
    "SCORE R0, 2",
    "R0 ← normalized energy",
  ],
  [
    "TEST",
    "Yes probability",
    "JEV",
    "Test a condition.",
    "One Noul question. The yes probability goes into a register, scaled to 0–10000.",
    "TEST R0, 3",
    "R0 ← kindness probability",
  ],
  [
    "CONF",
    "Read confidence",
    "JEV",
    "Read stored confidence.",
    "Read a Choice or Score slot’s confidence, scaled to 0–10000. Local operation; no request. TEST has no separate confidence.",
    "CONF R2, 0",
    "R2 ← confidence of decision slot 0",
  ],
);
const isJev = (op) => SEMANTIC_OPS.includes(op) || op === "CONF";
let activeQuestions = {};
let selectedOpcode = "JUDGE";
function selectOpcode(op) {
  selectedOpcode = op;
  const index = instructionGuide.findIndex((x) => x[0] === op);
  const [, , category, title, description, code, effect] =
    instructionGuide[index];
  $("op-category").textContent =
    `${category} / 0x${index.toString(16).toUpperCase()}`;
  $("op-name").textContent = op;
  $("op-title").textContent = title;
  $("op-description").textContent = description;
  $("op-code").textContent = code;
  $("op-effect").textContent = effect;
  $("instruction-explainer").classList.toggle("local-instruction", !isJev(op));
  document
    .querySelectorAll(".opcode-key")
    .forEach((key) => key.setAttribute("aria-pressed", key.dataset.op === op));
  document
    .querySelectorAll(".instruction")
    .forEach((line) =>
      line.classList.toggle("op-highlight", line.dataset.op === op),
    );
}
instructionGuide.forEach(([op, label, category], index) => {
  const key = document.createElement("button");
  key.className = "opcode-key" + (isJev(op) ? " semantic-key" : "");
  key.dataset.op = op;
  key.setAttribute("aria-pressed", String(op === "JUDGE"));
  key.setAttribute("aria-controls", "instruction-explainer");
  key.setAttribute("aria-label", `${op}: ${label}`);
  key.innerHTML = `<span class="key-number">${index.toString(16).toUpperCase().padStart(2, "0")}</span><strong>${op}</strong><span class="key-label">${label}</span>`;
  key.onclick = () => selectOpcode(op);
  key.onkeydown = (event) => {
    const columns = getComputedStyle(
      $("opcode-grid"),
    ).gridTemplateColumns.split(" ").length;
    const move = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
    }[event.key];
    if (move) {
      event.preventDefault();
      const next =
        (index + move + instructionGuide.length) % instructionGuide.length;
      $("opcode-grid").children[next].focus();
      selectOpcode(instructionGuide[next][0]);
    }
  };
  $("opcode-grid").append(key);
});
const teachingAnnotations = [
  "display address",
  "heart shape",
  "draw the heart",
  "256 particles",
  "set particle count",
  "ask four questions",
  "decision address",
  "read the mood",
  "4 = unknown",
  "unknown? try next input",
  "mood → color",
  "back to JUDGE",
];
function explainInstruction(d) {
  const { op, a, b, c, i } = d;
  const address = (n) => "0x" + n.toString(16).toUpperCase();
  if (SEMANTIC_OPS.includes(op))
    return vm.status === "judging"
      ? "Loading demo response…"
      : `${op} · awaiting input`;
  if (op === "LI")
    return `Next: put ${i} into register R${a}. This runs locally.`;
  if (op === "LD")
    return `Next: read ${address(vm.r[b] + i)} into R${a}. No model call.`;
  if (op === "ST")
    return `Next: write R${a} (${vm.r[a]}) to ${address(vm.r[b] + i)}${vm.r[b] + i === 61441 ? " — the display palette" : ""}.`;
  if (op === "BEQ")
    return `Next: compare R${a} (${vm.r[a]}) with R${b} (${vm.r[b]}). ${vm.r[a] === vm.r[b] ? "Equal: branch to " + i + "." : "Different: continue."}`;
  if (op === "JMP")
    return `Next: jump to instruction ${i}. The loop is ready for another message.`;
  return (
    instructionGuide.find((x) => x[0] === op)?.[3] ||
    "Ordinary execution runs locally."
  );
}

function showDecisions(result, waiting = false) {
  document.querySelector(".decision-panel").hidden = !result;
  document.querySelector(".answer-details").hidden = !result;
  document.querySelector(".prob-note").hidden = !result;
  $("decisions").replaceChildren();
  $("decisions").style.gridTemplateColumns =
    `repeat(${Math.max(1, Object.keys(result?.answers || activeQuestions).length)},1fr)`;
  $("typed-answers").textContent = result
    ? JSON.stringify(result.answers, null, 2)
    : "No decisions yet.";
  for (const [i, id] of Object.keys(
    result?.answers || activeQuestions,
  ).entries()) {
    const a = result?.answers[id],
      v = a
        ? (a.choice ??
          (a.type === "score"
            ? a.score.toFixed(2) + "/2"
            : Math.round(a.noul * 100) + "% yes"))
        : "—",
      p = a
        ? a.type === "choice"
          ? a.probabilities[a.choice]
          : a.type === "score"
            ? a.score / 2
            : a.noul
        : 0;
    const el = document.createElement("div");
    el.className = "decision" + (waiting ? " waiting" : "");
    el.innerHTML = `<small>${id.toUpperCase()}</small><b></b><div class="bar"><i style="width:${p * 100}%"></i></div>`;
    el.querySelector("b").textContent = v;
    el.title = a
      ? JSON.stringify(a, null, 2)
      : "Independent judgment over the same message";
    $("decisions").append(el);
  }
  if (result) {
    $("latency").textContent =
      result.model === "local-demo" ? "Local" : result.latencyMs + " ms";
    $("model").textContent = result.model;
    $("questions").textContent = result.questionCount + " / batch";
    $("commit").textContent =
      `✓ ${result.questionCount} answer${result.questionCount === 1 ? "" : "s"} committed`;
    $("commit").title = JSON.stringify(result.usage);
  }
}
function render() {
  if (!vm) return;
  const needsInput =
    !vm.replay &&
    !queue.length &&
    !["judging", "fault", "halted", "cancelled"].includes(vm.status) &&
    SEMANTIC_OPS.includes(decode(vm.words[vm.pc]).op);
  const semantic =
    program.words.map(decode).find((d) => SEMANTIC_OPS.includes(d.op))?.op ||
    "program";
  const busy = vm.status === "judging" || queue.length > 0;
  $("interaction-title").textContent = "Choose an example";
  $("interaction-state").textContent =
    vm.status === "fault"
      ? "Couldn't run · reset to retry"
      : busy
        ? "Running…"
        : vm.replay
          ? "Replay"
          : vm.bank
            ? "Ready"
            : "Demo · no API calls";
  $("message")
    .closest(".interaction-panel")
    .classList.toggle("is-running", busy);
  $("send").textContent = busy
    ? "Reading…"
    : {
        choose: "Read mood →",
        score: "Read energy →",
        test: "Check kindness →",
        batch: "Analyze →",
      }[program.config.cartridge] || "Run →";
  $("send").disabled = busy;
  $("send").setAttribute("aria-label", `Run ${semantic} with this input`);
  const lines = $("instructions").children;
  [...lines].forEach((el, i) => el.classList.toggle("active", i === vm.pc));
  const active = lines[vm.pc];
  if (active) {
    const box = $("instructions");
    if (
      active.offsetTop - box.offsetTop < box.scrollTop ||
      active.offsetTop - box.offsetTop > box.scrollTop + box.clientHeight - 25
    )
      box.scrollTop = active.offsetTop - box.offsetTop - 65;
  }
  $("registers").innerHTML = [...vm.r]
    .map(
      (v, i) =>
        `<div class="register"><span>R${i}</span>${v.toString(16).padStart(4, "0").toUpperCase()}</div>`,
    )
    .join("");
  $("status").textContent =
    vm.status === "judging"
      ? "DEMO"
      : vm.status === "fault"
        ? "FAULT"
        : running
          ? SEMANTIC_OPS.includes(decode(vm.words[vm.pc]).op) && !queue.length
            ? "AWAITING INPUT"
            : "RUNNING"
          : vm.status.toUpperCase();
  $("status").hidden = needsInput;
  $("run").textContent = running ? "Ⅱ Pause" : "▶ Run";
  if (vm.error) notice(vm.error, true);
  $("execution-explanation").textContent =
    vm.error || explainInstruction(decode(vm.words[vm.pc]));
  $("display-state").textContent = !vm.mem[0xf000]
    ? "WAITING TO BOOT"
    : vm.status === "judging"
      ? "UNDERSTANDING…"
      : "DISPLAY ONLINE";
  $("scene-detail").textContent = !vm.mem[0xf000]
    ? "Run the program to bring it to life."
    : vm.bank
      ? "A judgment. A branch. A memory write."
      : "Your words can change this little world.";
  const palettes = ["", "rose", "ice", "amber"];
  const color = palettes[vm.mem[0xf001]] || "rose";
  const energy = Math.round(vm.mem[0xf004] / 100);
  const kind = program.config.cartridge;
  $("scene-word").textContent = !vm.bank
    ? {
        choose: "MAKE IT FEEL",
        score: "TURN IT UP",
        test: "KIND WORDS ONLY",
        batch: "ONE MESSAGE. FOUR ANSWERS.",
      }[kind] || "READY"
    : kind === "score"
      ? `SCORE → ${energy}% ENERGY`
      : kind === "test"
        ? `TEST → ${vm.mem[0xf001] === 1 ? "GATE OPEN" : "GATE CLOSED"}`
        : kind === "batch"
          ? `JUDGE → ${color.toUpperCase()} + ${energy}%`
          : `CHOOSE → ${color.toUpperCase()}`;
  $("scene-word").style.color =
    color === "rose" ? "#efb8a7" : color === "ice" ? "#b3dbe5" : "#f8d59a";
}

function load(p, { replay = null } = {}) {
  generation++;
  running = false;
  queue = [];
  vm?.cancel();
  program = p;
  const examples = hooks[p.config.cartridge] || hooks.choose;
  document.querySelectorAll("[data-message]").forEach((button, i) => {
    button.textContent = examples[i][0];
    button.dataset.message = examples[i][1];
  });
  $("message").replaceChildren(
    ...examples.map(([label, message]) => {
      const option = document.createElement("option");
      option.value = message;
      option.textContent = message;
      return option;
    }),
  );
  document.querySelectorAll("[data-preset]").forEach((key) => {
    const selected = key.dataset.preset === p.config.cartridge;
    key.classList.toggle("selected", selected);
    key.setAttribute("aria-pressed", String(selected));
  });
  const firstSemantic = p.words
    .map(decode)
    .find((d) => SEMANTIC_OPS.includes(d.op));
  activeQuestions = firstSemantic
    ? p.descriptors[firstSemantic.i]?.questions || {}
    : {};
  $("questions").textContent =
    Object.keys(activeQuestions).length + " / request";
  const localGeneration = generation;
  vm = new VM(p.words, {
    descriptors: p.descriptors,
    replay,
    judge: async (descriptor) => {
      activeQuestions = descriptor.questions;
      showDecisions(null, true);
      $("snapshot-label").textContent = descriptor.state.message;
      $("snapshot-label").title = descriptor.state.message;
      const result = demoResponse(descriptor);
      if (localGeneration === generation) {
        showDecisions(result);
        notice("Demo response loaded locally.");
      }
      return result;
    },
  });
  $("assembly").value = p.source;
  const listing = disassemble(p.words).split("\n");
  $("instructions").replaceChildren();
  $("instructions").classList.toggle("teaching-list", !!p.config.teaching);
  listing.forEach((line, index) => {
    const op = line.split(" ")[0],
      row = document.createElement("div");
    row.className = "instruction" + (isJev(op) ? " semantic" : "");
    row.dataset.op = op;
    const values = [
      String(index).padStart(2, "0"),
      op,
      line.includes(" ") ? line.slice(line.indexOf(" ") + 1) : "",
      p.source
        .split("\n")
        .filter((l) => l.split(";")[0].trim())
        .map((l) => l.split(";")[1]?.trim() || "")[index] ||
        instructionGuide.find((x) => x[0] === op)?.[1] ||
        "",
    ];
    ["addr", "opcode", "operands", "annotation"].forEach((className, i) => {
      const span = document.createElement("span");
      span.className = className;
      span.textContent = values[i];
      row.append(span);
    });
    $("instructions").append(row);
  });
  selectOpcode(selectedOpcode);
  $("word-count").textContent = p.words.length + " instructions";
  $("scene-label").textContent =
    `${p.config.target.toUpperCase()} · ${p.config.count} PARTICLES`;
  $("program-title").textContent =
    p.title ||
    (p.config.target === "heart"
      ? "empathy_engine"
      : p.config.target === "orbit"
        ? "quiet_orbit"
        : "golden_hour") + ".jrisc";
  $("snapshot-label").textContent = "";
  $("model").textContent = "local-demo";
  showDecisions(null);
  $("commit").textContent = "Ready";
  $("latency").textContent = "—";
  render();
}
async function step() {
  const current = vm;
  if (current.status === "judging") return false;
  if (SEMANTIC_OPS.includes(decode(current.words[current.pc]).op)) {
    if (current.replay) {
      const rec = current.replay[current.replayIndex];
      if (!rec) {
        running = false;
        notice("Replay complete. No API requests made.");
        render();
        return false;
      }
      current.context = structuredClone(rec.descriptor.state);
    } else {
      if (!queue.length) {
        notice("");
        render();
        return false;
      }
      current.context = { message: queue.shift() };
    }
  }
  const promise = current.step();
  render();
  await promise;
  if (current !== vm) return false;
  if (current.bank) {
    $("snapshot-label").textContent =
      current.context.message || "RECORDED SNAPSHOT";
    showDecisions(current.bank);
    if (current.replay)
      $("commit").textContent = "↻ Recorded decisions · no API call";
  }
  render();
  if (current.status === "fault" || current.status === "halted") {
    running = false;
    render();
    return false;
  }
  return true;
}
async function run() {
  if (running) {
    running = false;
    runToken++;
    render();
    return;
  }
  if (["fault", "halted", "cancelled"].includes(vm.status)) {
    notice("Reset the program before running again.", true);
    return;
  }
  running = true;
  render();
  const g = generation,
    token = ++runToken;
  while (running && g === generation && token === runToken) {
    await step();
    await sleep(65);
  }
  render();
}
$("run").onclick = run;
$("step").onclick = () => {
  running = false;
  step();
};
$("reset").onclick = () => {
  if (vm.decisions.length) saved = { program, record: vm.export() };
  load(program);
  notice("Reset. Decision memory cleared.");
};
$("send").onclick = () => {
  const text = $("message").value.trim();
  if (!text) {
    $("message").focus();
    return;
  }
  if (program.config.behavior !== "react") {
    notice("This is a static program. Choose a Jev program.", true);
    return;
  }
  if (queue.length >= 8) {
    notice("Message queue full. Wait for processing.", true);
    return;
  }
  queue.push(text);
  notice("Message queued");
  if (!running) run();
};
document.querySelectorAll("[data-message]").forEach(
  (b) =>
    (b.onclick = () => {
      $("message").value = b.dataset.message;
      $("send").click();
    }),
);
$("message").onkeydown = (e) => {
  if (e.key === "Enter") $("send").click();
};
document.querySelectorAll("[data-preset]").forEach(
  (b) =>
    (b.onclick = () => {
      document.querySelectorAll("[data-preset]").forEach((x) => {
        x.classList.toggle("selected", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      });
      load(makeCartridge(b.dataset.preset));
      notice("Ready");
      run();
    }),
);
$("assemble").onclick = () => {
  try {
    const source = $("assembly").value;
    load({
      ...program,
      title: "your_program.jrisc",
      source,
      words: assemble(source),
      config: { ...program.config, teaching: false },
    });
    notice("Assembly validated and loaded.");
  } catch (e) {
    notice(e.message, true);
  }
};
function download(name, value, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob(
      [typeof value === "string" ? value : JSON.stringify(value, null, 2)],
      { type },
    ),
  );
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$("download-program").onclick = () =>
  download("scene.jrisc", program.source, "text/plain");
$("download-trace").onclick = () =>
  download("jrisc-trace.json", {
    ...vm.export(),
    config: program.config,
    compiler: compilerRecord,
  });
function replay(record, p = program) {
  saved = { record, program: p };
  load(p, { replay: record.decisions });
  notice("Replaying recorded snapshots. No network inference.");
  run();
}
$("replay").onclick = () => {
  const record = vm.decisions.length ? vm.export() : saved?.record;
  const p = vm.decisions.length ? program : saved?.program;
  if (!record) {
    notice("Send a message first to record a decision batch.");
    return;
  }
  replay(record, p);
};
$("import-trace").onchange = async (e) => {
  try {
    const f = e.target.files[0];
    if (!f || f.size > 4000000) throw Error("Trace must be under 4 MB");
    const rec = JSON.parse(await f.text());
    if (
      rec.version !== 1 ||
      !Array.isArray(rec.decisions) ||
      !Array.isArray(rec.program)
    )
      throw Error("Invalid trace");
    replay(rec, {
      words: rec.program,
      source: disassemble(rec.program),
      descriptors: rec.descriptors,
      config: rec.config || program.config,
    });
  } catch (e) {
    notice(e.message, true);
  }
};
$("stream").onclick = async () => {
  if (streaming) return;
  streaming = true;
  const g = generation;
  for (const text of [...document.querySelectorAll("[data-message]")].map(
    (b) => b.dataset.message,
  )) {
    if (g !== generation) break;
    $("message").value = text;
    $("send").click();
    await sleep(4500);
  }
  streaming = false;
};
const canvas = $("screen"),
  ctx = canvas.getContext("2d");
let points = Array.from({ length: 512 }, (_, i) => ({
  x: Math.sin(i * 78.2) * 500 + 600,
  y: Math.cos(i * 32.8) * 350 + 420,
}));
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const heartCells = [];
for (let row = 0; row < 24; row++) {
  for (let col = 0; col < 26; col++) {
    const x = (col - 12.5) / 10,
      y = (11.5 - row) / 10;
    if ((x * x + y * y - 1) ** 3 - x * x * y * y * y <= 0)
      heartCells.push({ x: x * 250, y: -y * 220 });
  }
}
function draw(t) {
  requestAnimationFrame(draw);
  const w = canvas.width,
    h = canvas.height;
  ctx.fillStyle = "#24212e";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#62516b";
  for (let x = 25; x < w; x += 28)
    for (let y = 20; y < h; y += 28) {
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x, y, 1.4, 1.4);
    }
  ctx.globalAlpha = 1;
  if (!vm) return;
  const shape = vm.mem[0xf000],
    palette = vm.mem[0xf001],
    count = vm.mem[0xf002] || 256,
    dir = vm.mem[0xf003] === 65535 ? -1 : 1,
    energy = vm.mem[0xf004] / 10000,
    time = reducedMotion.matches ? 0 : t * 0.00025 * dir * (0.25 + energy * 2);
  const colors =
    palette === 2
      ? ["#b4f0ff", "#55bdda", "#328dca"]
      : palette === 3
        ? ["#ffe7a3", "#fab844", "#eb702c"]
        : ["#ffd2b1", "#f58a76", "#bc687c"];
  for (let i = 0; i < Math.min(count, 512); i++) {
    const a = i * 2.39996323,
      rad = Math.sqrt((i + 0.5) / count),
      pulse = 1 + Math.sin(time * 5) * (0.025 + energy * 0.045);
    let x, y;
    if (shape === 1) {
      const cell =
        heartCells[Math.floor((i * heartCells.length) / Math.min(count, 512))];
      x = cell.x * pulse;
      y = cell.y * pulse;
    } else if (shape === 2) {
      const q = a + time * 0.6;
      x = Math.cos(q) * (135 + rad * 120);
      y = Math.sin(q) * (70 + rad * 110);
      const rot = Math.sin(time) * 0.4;
      [x, y] = [
        x * Math.cos(rot) - y * Math.sin(rot),
        x * Math.sin(rot) + y * Math.cos(rot),
      ];
    } else if (shape === 3) {
      x = (i / count - 0.5) * 790;
      y = Math.sin(x * 0.012 + time * 3) * 95 + Math.sin(a) * 45;
    } else {
      x = Math.cos(a + time) * rad * 340;
      y = Math.sin(a + time) * rad * 230;
    }
    x += 600;
    y += 390;
    points[i].x += (x - points[i].x) * (reducedMotion.matches ? 1 : 0.065);
    points[i].y += (y - points[i].y) * (reducedMotion.matches ? 1 : 0.065);
    const size = shape === 1 ? 16 : 6 + ((i * 13) % 3) * 2;
    ctx.fillStyle = colors[i % 3];
    ctx.shadowColor = colors[i % 3];
    ctx.shadowBlur = 0;
    ctx.globalAlpha =
      shape === 1
        ? 0.85 + Math.sin(i + time) * 0.15
        : 0.5 + Math.sin(i + time) * 0.2 + rad * 0.25;
    ctx.fillRect(
      Math.round(points[i].x / 8) * 8,
      Math.round(points[i].y / 8) * 8,
      size,
      size,
    );
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  for (let i = 0; i < 1024; i++)
    if (vm.mem[0x8000 + i]) {
      ctx.fillStyle = colors[vm.mem[0x8000 + i] % 3];
      ctx.fillRect(
        ((i % 32) * w) / 32,
        (Math.floor(i / 32) * h) / 32,
        w / 32 - 2,
        h / 32 - 2,
      );
    }
}
load(makeCartridge());
$("hero-play").addEventListener("click", () => {
  if (!running && vm.status === "ready") run();
});
requestAnimationFrame(draw);
// A narrow, explicit capture interface also supports reproducible browser verification.
window.jrisc = {
  get vm() {
    return vm;
  },
  get program() {
    return program;
  },
  step,
  run,
  load,
  async playRecorded(rec) {
    replay(rec, {
      ...makeProgram(rec.config),
      words: rec.program,
      source: disassemble(rec.program),
      descriptors: rec.descriptors,
    });
  },
  get compiler() {
    return compilerRecord;
  },
};
