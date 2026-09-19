import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_EXAMPLES, demoResponse, makeCartridge } from "../lib/semantic.js";
import { VM, decode, SEMANTIC_OPS } from "../lib/vm.js";
for (const [kind, examples] of Object.entries(DEMO_EXAMPLES)) {
  test(`${kind} demo examples produce identical decisions and machine state on repeated runs`, async () => {
    for (const [, message] of examples) {
      const p = makeCartridge(kind);
      const outcomes = [];
      for (let repeat = 0; repeat < 2; repeat++) {
        const vm = new VM(p.words, {
          descriptors: p.descriptors,
          judge: async (d) => demoResponse(d),
        });
        vm.context = { message };
        let seen = false;
        for (let n = 0; n < 50; n++) {
          if (seen && SEMANTIC_OPS.includes(decode(vm.words[vm.pc]).op)) break;
          if (SEMANTIC_OPS.includes(decode(vm.words[vm.pc]).op)) seen = true;
          await vm.step();
          assert.notEqual(vm.status, "fault", vm.error);
        }
        assert.equal(vm.decisions.length, 1);
        assert.equal(vm.bank.model, "local-demo");
        outcomes.push({
          bank: vm.bank,
          registers: [...vm.r],
          display: [...vm.mem.slice(0xf000, 0xf006)],
        });
      }
      assert.deepEqual(outcomes[0], outcomes[1]);
    }
  });
}
test("demo refuses arbitrary input instead of pretending to infer", () => {
  const d = makeCartridge().descriptors[1];
  assert.throws(
    () => demoResponse({ ...d, state: { message: "not a fixture" } }),
    /demo messages/,
  );
});
