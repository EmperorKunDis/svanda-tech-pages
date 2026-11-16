# Reproducible event-processing example

This is a new, illustrative Node.js example for the portfolio. It is **not** extracted from PostHub, Tatooine, or any client system and is **not** a benchmark of those products.

Run with Node.js 22 or newer in this directory:

```sh
node --test event-processor.test.mjs
```

The tests exercise duplicate delivery, concurrent calls with the same event ID, bounded retries, and invalid input. Calls with the same ID are assumed to represent the same immutable logical event; payload collisions are not checked. The example keeps completion and in-flight state only in memory. A process restart loses that state; multiple workers do not share it; an effect can partially succeed and still throw. Production use would need a durable unique event key, transaction boundaries around the real side effect, a retry/backoff policy, observability, and tests across process failure and deployment revisions. The test result proves this example's behavior in the stated runtime only.

`measurement-template.json` starts in `measurement-not-performed` state. `measurement-contract.mjs` and its tests illustrate the fields required before a result is marked `measured`: source revision, runtime and hardware, fixture, sample, method, raw-output SHA-256, date and limitations. Run `node --test *.test.mjs`. The template contains no product result; validating its shape does not validate any product's behavior or create a benchmark claim.
