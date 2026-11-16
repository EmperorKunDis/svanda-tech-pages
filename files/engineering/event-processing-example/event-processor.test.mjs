import assert from "node:assert/strict";
import test from "node:test";
import { createEventProcessor } from "./event-processor.mjs";

test("a completed event is not repeated within this process", async () => {
  let calls = 0;
  const processor = createEventProcessor({ effect: async () => ++calls });
  assert.deepEqual(await processor.process({ id: "example-1" }), {
    id: "example-1",
    attempt: 1,
    value: 1,
    duplicate: false,
  });
  assert.equal((await processor.process({ id: "example-1" })).duplicate, true);
  assert.equal(calls, 1);
});

test("simultaneous requests with one ID share the in-flight work", async () => {
  let calls = 0;
  const processor = createEventProcessor({
    effect: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 1));
      return "done";
    },
  });
  const [first, duplicate] = await Promise.all([
    processor.process({ id: "example-2" }),
    processor.process({ id: "example-2" }),
  ]);
  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(calls, 1);
});

test("failed attempts are bounded and do not mark the event complete", async () => {
  let calls = 0;
  const processor = createEventProcessor({
    maxAttempts: 2,
    effect: async () => {
      calls += 1;
      throw new Error("unavailable");
    },
  });
  await assert.rejects(processor.process({ id: "example-3" }), /unavailable/);
  assert.equal(calls, 2);
  await assert.rejects(processor.process({ id: "example-3" }), /unavailable/);
  assert.equal(calls, 4);
});

test("invalid event IDs and retry budgets fail before side effects", async () => {
  assert.throws(() => createEventProcessor({ effect: async () => {}, maxAttempts: 0 }), RangeError);
  const processor = createEventProcessor({ effect: async () => {} });
  await assert.rejects(processor.process({ id: "" }), TypeError);
});

test("a side effect cannot change the tracked ID by mutating its input", async () => {
  let calls = 0;
  const processor = createEventProcessor({
    effect: async (event) => {
      calls += 1;
      event.id = "changed";
      return "ok";
    },
  });
  const event = { id: "original" };
  assert.equal((await processor.process(event)).id, "original");
  assert.equal((await processor.process({ id: "original" })).duplicate, true);
  assert.equal(calls, 1);
});
