import { chromium } from "playwright";
import { mkdir, writeFile, rename } from "node:fs/promises";
await mkdir("artifacts/raw", { recursive: true });
const browser = await chromium.launch();
const baseCSS = `
@media(min-width:0px){
body{background:#f4f0e6}header,.hero,.isa-section,.compose-section,footer,.causal,.section-heading,.section-description,.preset-row,#notice,.prob-note,.answer-details,.machine-details{display:none!important}
main{margin:0!important;padding:16px!important;max-width:none}.playground{border:0;padding:0;margin:0}.workspace{grid-template-columns:1fr 1fr;gap:16px}.program-panel{margin:0}.panel-heading{height:35px;padding:0 12px;font-size:9px}.program-meta{padding:12px 14px 7px;font-size:11px}.program-guide{padding:0 14px 10px;font-size:10px}
#instructions,#instructions.teaching-list{height:330px;overflow:hidden;padding:7px 0}.instruction{grid-template-columns:18px 43px 114px 1fr;gap:7px;padding:0 12px;font-size:12px;min-height:25px;line-height:25px}.instruction .annotation{font-size:10px;display:block}.instruction .operands{font-size:11px}.execution-explanation{min-height:42px;padding:9px 14px;font-size:10px}.transport{padding:11px 14px}.transport button{padding:8px 12px;font-size:11px}.canvas-wrap{height:355px}.canvas-corner{font-size:11px}.scene-caption>span{font-size:25px}.scene-caption small{font-size:9px}.screen-base{height:25px}.message-area{padding:9px 5px 2px}.message-area>label{font-size:8px}.message-bar input{font-size:11px}.message-presets{margin-top:5px}.message-presets button{font-size:9px;min-height:24px}.display-panel{padding:8px}.display-panel .panel-heading{height:28px}
.decision-panel{display:grid;grid-template-columns:175px 1fr;gap:20px;margin-top:20px;padding:16px;min-height:180px}.decision-intro h3{font-size:24px}.decision-intro .eyebrow{font-size:7px}.decision-intro p{font-size:10px}.fan-header{font-size:8px;margin-bottom:12px}.decision{padding:9px 12px}.decision b{font-size:17px;margin:7px 0}.decision small{font-size:8px}.decision-bottom{padding-top:12px}.commit{font-size:8px}.metrics b{font-size:9px}.metrics small{font-size:7px}
}`;
const shots = [
  {
    id: "hook",
    duration: 3,
    mode: "instructions",
    action: async (p) => {
      await p.locator('[data-op="ADD"].opcode-key').click();
      await p.waitForTimeout(450);
      await p.locator('[data-op="JUDGE"].opcode-key').click();
    },
  },
  {
    id: "build",
    duration: 6,
    mode: "console",
    action: async (p) => {
      await p.locator("#run").click();
      await p.waitForFunction(() => window.jrisc.vm.pc === 5);
      await p.locator("#run").click();
    },
  },
  {
    id: "batch",
    duration: 8,
    mode: "judgment",
    prepare: async (p) => {
      await p.locator("#run").click();
      await p.waitForFunction(() => window.jrisc.vm.pc === 5);
    },
    action: async (p) => {
      await p.waitForTimeout(500);
      await p.locator("#send").click();
      await p.waitForFunction(
        () =>
          window.jrisc.vm.decisions.length === 1 &&
          window.jrisc.vm.mem[0xf001] !== 0,
      );
      await p.waitForTimeout(800);
      await p.locator("#run").click();
    },
  },
  {
    id: "twist",
    duration: 8,
    mode: "judgment",
    prepare: async (p) => {
      await p.locator("#run").click();
      await p.waitForFunction(() => window.jrisc.vm.pc === 5);
    },
    action: async (p) => {
      await p.locator("#message").fill("");
      await p
        .locator("#message")
        .pressSequentially("Everything is falling apart! I am furious!", {
          delay: 34,
        });
      await p.locator("#send").click();
      await p.waitForFunction(
        () =>
          window.jrisc.vm.decisions.length === 1 &&
          window.jrisc.vm.mem[0xf001] !== 0,
      );
    },
  },
  {
    id: "end",
    duration: 5,
    mode: "hero",
    prepare: async (p) => {
      await p.evaluate(() => document.getElementById("run").click());
      await p.waitForTimeout(900);
    },
    action: async (p) => {},
  },
];
const manifest = [];
for (const shot of shots) {
  const context = await browser.newContext({
    viewport: { width: 1080, height: 780 },
    deviceScaleFactor: 1,
    recordVideo: { dir: "artifacts/raw", size: { width: 1080, height: 780 } },
  });
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://localhost:4173");
  await p.addStyleTag({
    content:
      baseCSS +
      (shot.mode === "instructions"
        ? `
.playground{display:none!important}.isa-section{display:block!important;border:0;padding:14px 4px}.isa-section .section-heading{display:flex!important;margin-bottom:28px}.isa-section h2{font-size:38px}.isa-section .section-heading p{font-size:14px}.opcode-grid{gap:16px 12px}.opcode-key{height:125px;padding:20px}.opcode-key strong{font-size:27px}.opcode-key .key-label{font-size:12px}.opcode-legend{font-size:12px;margin:25px 0 18px}.instruction-explainer{margin-top:30px;grid-template-columns:140px 1fr;padding:28px;min-height:220px}.explainer-example{grid-column:2;border:0;padding:0}.explainer-copy h3{font-size:20px}.explainer-copy p{font-size:15px}.explainer-id strong{font-size:30px}.explainer-example code{font-size:16px}.explainer-example span{font-size:12px}
`
        : shot.mode === "hero"
          ? `
.program-panel,.decision-panel,.message-area{display:none!important}.workspace{display:block}.canvas-wrap{height:650px}.display-panel{max-width:950px;margin:0 auto}.display-panel .panel-heading{height:35px;font-size:12px}.scene-caption>span{font-size:39px}.scene-caption small{font-size:14px}.screen-base{height:30px}
`
          : ""),
  });
  await p.evaluate(() => {
    const dot = document.createElement("div");
    dot.id = "capture-cursor";
    dot.style.cssText =
      "position:fixed;z-index:99999;width:22px;height:22px;border:2px solid #e7ffc0;border-radius:50%;pointer-events:none;left:-100px;top:-100px;box-shadow:0 0 0 5px #d5fa7318";
    document.body.append(dot);
    document.addEventListener("mousemove", (e) => {
      dot.style.left = e.clientX - 11 + "px";
      dot.style.top = e.clientY - 11 + "px";
    });
  });
  if (shot.prepare) await shot.prepare(p);
  await p.evaluate(() => document.fonts.ready);
  const start = Date.now();
  await shot.action(p);
  const elapsed = Date.now() - start;
  if (elapsed > shot.duration * 1000)
    throw Error(shot.id + " action exceeds edit slot");
  await p.waitForTimeout(shot.duration * 1000 - elapsed);
  await p.screenshot({ path: `artifacts/raw/${shot.id}.png` });
  const state = await p.evaluate(() => ({
    ...window.jrisc.vm.export(),
    config: window.jrisc.program.config,
    compiler: window.jrisc.compiler,
  }));
  await writeFile(
    `artifacts/raw/${shot.id}-trace.json`,
    JSON.stringify(state, null, 2),
  );
  const video = p.video();
  await context.close();
  await rename(await video.path(), `artifacts/raw/${shot.id}.webm`);
  if (errors.length) throw Error(errors.join("\n"));
  manifest.push({
    id: shot.id,
    duration: shot.duration,
    actionElapsedMs: elapsed,
    mode: shot.mode,
  });
  console.log("Recorded", shot.id, elapsed + " ms action");
}
await writeFile("artifacts/raw/edit.json", JSON.stringify(manifest, null, 2));
// Transparent caption overlays keep the underlying product footage intact.
const overlayPage = await browser.newPage({
  viewport: { width: 1080, height: 1080 },
  deviceScaleFactor: 1,
});
const captions = {
  hook: [
    "16 instructions.",
    "One understands.",
    "Meet JUDGE. A new kind of instruction.",
  ],
  build: [
    "Twelve lines.",
    "A heart that reads the room.",
    "The complete program. Every instruction is visible.",
  ],
  batch: [
    "One request.",
    "Four independent judgments.",
    "Input → JUDGE → decision memory → pixels",
  ],
  twist: [
    "Change the words.",
    "The running program reacts.",
    "Ordinary branches. A different feeling.",
  ],
  end: [
    "JRISC",
    "A tiny instruction set, powered by Jev.",
    "What would you program?",
  ],
};
for (const [id, [a, b, c]] of Object.entries(captions)) {
  await overlayPage.setContent(
    `<html><head><style>*{box-sizing:border-box}body{margin:0;background:transparent;font-family:Arial,sans-serif;color:#302f3d}.top{position:absolute;top:0;left:0;width:1080px;height:205px;background:#f4f0e6;padding:24px 42px}.tag{font-size:17px;letter-spacing:4px;color:#8a7686;margin-bottom:13px}.first{font-size:${id === "end" ? 64 : 48}px;font-weight:700;line-height:1.08;letter-spacing:-1.8px}.second{font-size:${id === "end" ? 31 : 46}px;font-weight:600;color:#7254b6;line-height:1.12;letter-spacing:-1.5px;margin-top:4px}.bottom{position:absolute;bottom:0;left:0;width:1080px;height:95px;background:#f4f0e6;padding:14px 42px}.caption{font-size:25px;color:#5c476c}.note{font-size:13px;letter-spacing:1px;color:#8b798b;margin-top:10px}</style></head><body><div class="top"><div class="tag">JRISC / A COMPUTER WITH JUDGMENT</div><div class="first">${a}</div><div class="second">${b}</div></div><div class="bottom"><div class="caption">${c}</div><div class="note">REAL PRODUCT FOOTAGE · LIVE JEV REQUESTS · NO SPEED CHANGES</div></div></body></html>`,
  );
  await overlayPage.screenshot({
    path: `artifacts/raw/${id}-overlay.png`,
    omitBackground: true,
  });
}
await browser.close();
