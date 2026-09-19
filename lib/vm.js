export const OPS = [
  "LI",
  "MOV",
  "ADD",
  "SUB",
  "AND",
  "OR",
  "XOR",
  "SHL",
  "SHR",
  "LD",
  "ST",
  "BEQ",
  "BLT",
  "JMP",
  "HALT",
  "JUDGE",
  "CHOOSE",
  "SCORE",
  "TEST",
  "CONF",
];
export const SEMANTIC_OPS = ["JUDGE", "CHOOSE", "SCORE", "TEST"];
const forms = [
  "ri",
  "rr",
  "rrr",
  "rrr",
  "rrr",
  "rrr",
  "rrr",
  "rrr",
  "rrr",
  "rri",
  "rri",
  "rri",
  "rri",
  "i",
  "",
  "i",
  "ri",
  "ri",
  "ri",
  "ri",
];
const fail = (m) => {
  throw Error(m);
};
export const signed = (n) => (n & 32768 ? n - 65536 : n);
export function decode(w) {
  if (!Number.isInteger(w) || w < 0 || w > 0xffffffff)
    fail("Invalid instruction word");
  const base = w >>> 28,
    extension = (w >>> 16) & 7,
    op = base === 15 ? 15 + extension : base,
    a = (w >>> 25) & 7,
    b = (w >>> 22) & 7,
    c = (w >>> 19) & 7,
    i = w & 65535;
  if ((base !== 15 && extension) || op >= OPS.length)
    fail("Reserved encoding bits");
  const f = forms[op];
  if (
    (!f.includes("r") && (a || b || c)) ||
    (f === "ri" && (b || c)) ||
    (f === "rr" && (c || i)) ||
    (f === "rrr" && i) ||
    (f === "rri" && c) ||
    (f === "" && i)
  )
    fail("Noncanonical encoding");
  return { op: OPS[op], a, b, c, i };
}
export function assemble(source) {
  const labels = {},
    lines = [];
  for (let raw of source.split("\n")) {
    let line = raw.split(";")[0].trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z_]\w*):/);
    if (m) {
      if (Object.hasOwn(labels, m[1])) fail("Duplicate label");
      labels[m[1]] = lines.length;
      line = line.slice(m[0].length).trim();
    }
    if (line) lines.push(line);
  }
  if (!lines.length || lines.length > 65536) fail("Program size");
  return lines.map((line, pc) => {
    const [name, ...args] = line.replaceAll(",", " ").split(/\s+/);
    const op = OPS.indexOf(name.toUpperCase());
    if (op < 0) fail(`Unknown opcode at ${pc}`);
    const f = forms[op];
    if (args.length !== f.length) fail(`Operand count at ${pc}`);
    const vals = args.map((x, k) => {
      if (f[k] === "r") {
        if (!/^r[0-7]$/i.test(x)) fail("Invalid register");
        return +x[1];
      }
      const v = Object.hasOwn(labels, x) ? labels[x] : Number(x);
      if (
        !Number.isInteger(v) ||
        v < (name.toUpperCase() === "LI" ? -32768 : 0) ||
        v > 65535
      )
        fail("Invalid immediate");
      return v & 65535;
    });
    let a = 0,
      b = 0,
      c = 0,
      i = 0,
      ri = 0;
    f.split("").forEach((t, k) => {
      if (t === "i") i = vals[k];
      else {
        if (ri === 0) a = vals[k];
        if (ri === 1) b = vals[k];
        if (ri === 2) c = vals[k];
        ri++;
      }
    });
    if (["BEQ", "BLT", "JMP"].includes(OPS[op]) && i >= lines.length)
      fail("Branch outside program");
    return (
      ((Math.min(op, 15) << 28) |
        ((op > 15 ? op - 15 : 0) << 16) |
        (a << 25) |
        (b << 22) |
        (c << 19) |
        i) >>>
      0
    );
  });
}
export function disassemble(words) {
  return words
    .map((w) => {
      const d = decode(w),
        f = forms[OPS.indexOf(d.op)],
        rs = [d.a, d.b, d.c];
      let k = 0;
      return (
        d.op +
        (f
          ? " " +
            [...f].map((t) => (t === "r" ? "R" + rs[k++] : d.i)).join(", ")
          : "")
      );
    })
    .join("\n");
}
export function validateDescriptor(d) {
  if (!d || typeof d !== "object" || JSON.stringify(d).length > 16000)
    fail("Descriptor too large or absent");
  const qs = Object.entries(d.questions || {});
  if (!qs.length || qs.length > 8)
    fail("Question bank must contain 1–8 questions");
  for (const [id, q] of qs) {
    if (
      !/^[a-z][a-z0-9_]*$/.test(id) ||
      typeof q.instructions !== "string" ||
      !q.instructions
    )
      fail("Invalid question");
    if (q.type === "choice") {
      if (
        !q.criteria ||
        Array.isArray(q.criteria) ||
        Object.keys(q.criteria).length < 2 ||
        Object.keys(q.criteria).length > 16
      )
        fail("Invalid choices");
    } else if (q.type === "score") {
      if (
        !Array.isArray(q.criteria) ||
        q.criteria.length < 2 ||
        q.criteria.length > 8
      )
        fail("Invalid score");
    } else if (q.type !== "noul") fail("Invalid question type");
  }
  return d;
}
const probability = (x) =>
  typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1;
export function validateResult(d, result) {
  validateDescriptor(d);
  if (
    !result ||
    typeof result.model !== "string" ||
    !result.answers ||
    Object.keys(result.answers).length !== Object.keys(d.questions).length
  )
    fail("Malformed result");
  for (const [id, q] of Object.entries(d.questions)) {
    const a = result.answers[id];
    if (!a || a.type !== q.type) fail("Answer type mismatch");
    if (q.type === "noul") {
      if (!probability(a.noul)) fail("Invalid yes probability");
      continue;
    }
    if (!probability(a.confidence)) fail("Invalid confidence");
    const keys =
      q.type === "choice"
        ? Object.keys(q.criteria)
        : q.criteria.map((_, i) => String(i));
    if (
      !a.probabilities ||
      Object.keys(a.probabilities).length !== keys.length ||
      keys.some((k) => !probability(a.probabilities[k])) ||
      Math.abs(Object.values(a.probabilities).reduce((x, y) => x + y, 0) - 1) >
        0.02
    )
      fail("Invalid distribution");
    if (q.type === "choice" && !keys.includes(a.choice)) fail("Unknown option");
    if (
      q.type === "score" &&
      (!Number.isFinite(a.score) ||
        a.score < 0 ||
        a.score > keys.length - 1 ||
        !a.legend ||
        keys.some((k) => a.legend[k] !== q.criteria[+k]))
    )
      fail("Invalid score");
  }
  return structuredClone(result);
}
function freeze(x) {
  if (x && typeof x === "object") {
    Object.freeze(x);
    Object.values(x).forEach(freeze);
  }
  return x;
}
export class VM {
  constructor(
    words,
    { judge, descriptors = {}, timeout = 15000, replay = null } = {},
  ) {
    words.forEach(decode);
    this.words = [...words];
    this.r = new Uint16Array(8);
    this.mem = new Uint16Array(65536);
    this.pc = 0;
    this.status = "ready";
    this.trace = [];
    this.decisions = [];
    this.bank = null;
    this.judge = judge;
    this.descriptors = structuredClone(descriptors);
    this.timeout = timeout;
    this.replay = replay;
    this.replayIndex = 0;
    this.epoch = 0;
    this.context = {};
  }
  read(addr) {
    if (addr < 0 || addr > 65535) fail("Address overflow");
    if (
      addr < 0x1000 ||
      (addr >= 0x8000 && addr < 0x8400) ||
      (addr >= 0xf000 && addr <= 0xf005)
    )
      return this.mem[addr];
    if (addr >= 0xe000 && addr < 0xe100) {
      if (!this.bank) fail("Decision bank empty");
      return this.mem[addr];
    }
    fail("Unmapped memory");
  }
  write(addr, v) {
    if (addr < 0 || addr > 65535) fail("Address overflow");
    if (
      addr < 0x1000 ||
      (addr >= 0x8000 && addr < 0x8400) ||
      (addr >= 0xf000 && addr <= 0xf005)
    ) {
      this.mem[addr] = v;
      return;
    }
    fail("Read-only or unmapped memory");
  }
  cancel() {
    this.epoch++;
    this.status = "cancelled";
  }
  async step() {
    if (["halted", "fault", "cancelled", "judging"].includes(this.status))
      return;
    const pc = this.pc,
      epoch = this.epoch;
    try {
      if (pc >= this.words.length) fail("PC outside program");
      const d = decode(this.words[pc]),
        { op, a, b, c, i } = d;
      let next = pc + 1;
      this.status = "ready";
      switch (op) {
        case "LI":
          this.r[a] = i;
          break;
        case "MOV":
          this.r[a] = this.r[b];
          break;
        case "ADD":
          this.r[a] = this.r[b] + this.r[c];
          break;
        case "SUB":
          this.r[a] = this.r[b] - this.r[c];
          break;
        case "AND":
          this.r[a] = this.r[b] & this.r[c];
          break;
        case "OR":
          this.r[a] = this.r[b] | this.r[c];
          break;
        case "XOR":
          this.r[a] = this.r[b] ^ this.r[c];
          break;
        case "SHL":
          this.r[a] = this.r[b] << (this.r[c] & 15);
          break;
        case "SHR":
          this.r[a] = this.r[b] >>> (this.r[c] & 15);
          break;
        case "LD":
          this.r[a] = this.read(this.r[b] + i);
          break;
        case "ST":
          this.write(this.r[b] + i, this.r[a]);
          break;
        case "BEQ":
          if (this.r[a] === this.r[b]) next = i;
          break;
        case "BLT":
          if (signed(this.r[a]) < signed(this.r[b])) next = i;
          break;
        case "JMP":
          next = i;
          break;
        case "HALT":
          this.status = "halted";
          next = pc;
          break;
        case "CONF": {
          if (!this.bank || i >= Object.keys(this.bank.answers).length)
            fail("Decision slot unavailable");
          // Use the stable descriptor slot projection, not response key ordering.
          if (this.mem[0xe000 + i * 32] === 3)
            fail("TEST has a yes probability, not a confidence");
          this.r[a] = this.read(0xe000 + i * 32 + 2);
          break;
        }
        case "CHOOSE":
        case "SCORE":
        case "TEST":
        case "JUDGE": {
          const descriptor = validateDescriptor(this.descriptors[i]);
          const required = { CHOOSE: "choice", SCORE: "score", TEST: "noul" }[
            op
          ];
          if (
            required &&
            (Object.keys(descriptor.questions).length !== 1 ||
              Object.values(descriptor.questions)[0].type !== required)
          )
            fail(op + " requires one " + required + " question");
          const snapshot = freeze(
            validateDescriptor(
              structuredClone({
                ...descriptor,
                state: { ...descriptor.state, ...this.context },
              }),
            ),
          );
          this.status = "judging";
          let result, timer;
          try {
            if (this.replay) {
              const rec = this.replay[this.replayIndex];
              if (
                !rec ||
                JSON.stringify(rec.descriptor) !== JSON.stringify(snapshot)
              )
                fail("Replay snapshot mismatch");
              result = rec.result;
            } else
              result = await Promise.race([
                this.judge(snapshot, { instruction: op, descriptorId: i }),
                new Promise((_, reject) => {
                  timer = setTimeout(
                    () => reject(Error("JUDGE timeout; reset to recover")),
                    this.timeout,
                  );
                }),
              ]);
          } finally {
            clearTimeout(timer);
          }
          if (epoch !== this.epoch) return;
          result = validateResult(snapshot, result);
          const page = new Uint16Array(256);
          Object.entries(snapshot.questions).forEach(([id, q], idx) => {
            const answer = result.answers[id],
              base = idx * 32;
            page[base] = q.type === "choice" ? 1 : q.type === "score" ? 2 : 3;
            page[base + 1] =
              q.type === "choice"
                ? Object.keys(q.criteria).indexOf(answer.choice) + 1
                : Math.round(
                    (q.type === "score"
                      ? answer.score / (q.criteria.length - 1)
                      : answer.noul) * 10000,
                  );
            page[base + 2] = Math.round(
              (answer.confidence ?? answer.noul) * 10000,
            );
            (q.type === "choice"
              ? Object.keys(q.criteria)
              : q.type === "score"
                ? q.criteria.map((_, i) => String(i))
                : []
            ).forEach(
              (key, j) =>
                (page[base + 3 + j] = Math.round(
                  answer.probabilities[key] * 10000,
                )),
            );
          });
          this.mem.set(page, 0xe000);
          this.bank = freeze(result);
          this.decisions.push({ descriptor: snapshot, result });
          if (op !== "JUDGE") this.r[a] = page[1];
          if (this.replay) this.replayIndex++;
          this.status = "ready";
          break;
        }
      }
      if (next < 0 || next >= this.words.length) fail("PC outside program");
      this.pc = next;
      this.trace.push({
        pc,
        op,
        registers: [...this.r],
        next,
        display: [...this.mem.slice(0xf000, 0xf006)],
        decision: SEMANTIC_OPS.includes(op)
          ? this.decisions.length - 1
          : undefined,
      });
    } catch (e) {
      this.status = "fault";
      this.error = e.message;
      this.trace.push({ pc, fault: e.message });
    }
  }
  export() {
    return {
      version: 1,
      program: this.words,
      descriptors: this.descriptors,
      decisions: this.decisions,
      trace: this.trace,
    };
  }
}
