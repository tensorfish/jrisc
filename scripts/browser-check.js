import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [],
  calls = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (r.url().includes("/api/")) {
    assert(!r.headers().authorization);
    calls.push(r.url());
  }
  assert(!r.url().includes("api.typesafe.ai"));
});
await page.goto(process.env.JRISC_URL || "http://localhost:4173");
assert.equal(await page.locator(".opcode-key").count(), 20);
await page.locator('[data-op="CHOOSE"].opcode-key').click();
await page.keyboard.press("ArrowRight");
assert.equal(await page.locator("#op-name").textContent(), "SCORE");
for (const kind of ["choose", "score", "test", "batch"]) {
  await page.locator(`[data-preset="${kind}"]`).click();
  await page.waitForFunction(() => window.jrisc.vm.pc === 5);
  const states = [];
  for (let i = 0; i < 2; i++) {
    await page.locator("[data-message]").nth(i).click();
    await page.waitForFunction(
      (n) =>
        window.jrisc.vm.decisions.length === n &&
        window.jrisc.vm.pc === 5 &&
        window.jrisc.vm.status !== "judging",
      i + 1,
      { timeout: 30000 },
    );
    states.push(
      await page.evaluate(() => ({
        palette: window.jrisc.vm.mem[0xf001],
        energy: window.jrisc.vm.mem[0xf004],
        bank: window.jrisc.vm.bank,
        caption: document.getElementById("scene-word").textContent,
      })),
    );
  }
  if (kind === "score") assert(states[1].energy > states[0].energy);
  else assert.notEqual(states[0].palette, states[1].palette);
  if (kind === "batch") assert(states[1].energy > states[0].energy);
  results.push({ kind, states });
  await page.locator(".machine-details").evaluate((el) => (el.open = true));
  await page.locator("#run").click();
  const before = calls.length;
  await page.locator("#replay").click();
  await page.waitForFunction(
    () =>
      window.jrisc.vm.decisions.length === 2 &&
      window.jrisc.vm.pc === 5 &&
      window.jrisc.vm.status !== "judging",
  );
  assert.equal(calls.length, before);
  await page.locator(".machine-details").evaluate((el) => (el.open = false));
}
await page.screenshot({ path: "artifacts/jev-desktop.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "artifacts/jev-mobile.png", fullPage: true });
assert(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
assert.deepEqual(errors, []);
assert.equal(calls.length, 0);
await writeFile(
  "artifacts/jev-demo-check.json",
  JSON.stringify(results, null, 2),
);
console.log(
  "Passed: 20 instructions; all four cartridges change output with fixed demo responses; zero API calls; replay makes no calls; no browser credentials; mobile fits; no page errors.",
);
await browser.close();
