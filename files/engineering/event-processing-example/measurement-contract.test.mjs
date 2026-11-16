import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateMeasurement } from "./measurement-contract.mjs";

const template = JSON.parse(readFileSync(new URL("./measurement-template.json", import.meta.url)));

test("unperformed template is valid without pretending to report a result", () => {
  assert.deepEqual(validateMeasurement(template), []);
  assert.match(validateMeasurement({ ...template, value: 9 }).join(" "), /cannot contain a value/);
});

test("a measured result requires reproducibility and raw-output integrity fields", () => {
  const fake = { ...template, status: "measured", value: 42 };
  const errors = validateMeasurement(fake).join(" ");
  for (const required of [
    "sourceCommit",
    "observedAt",
    "sampleSize",
    "runtime",
    "hardware",
    "fixture",
    "method",
    "rawOutputSha256",
    "limitations",
  ])
    assert.match(errors, new RegExp(required));
});
