#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const readme = read("README.md");
const roadmap = read(
  "docs/swarmsy/local-user/SWARMSY_LOCAL_USER_ROADMAP.md"
);
const gaps = read("docs/swarmsy/audits/SWARMSY_MVP_KNOWN_GAPS.md");

const shippedMarkers = [
  "durable beginner intake sessions",
  "structured Identity Idea",
  "Memory Lock core storage",
  "Proof Review core storage",
  "returning-user continuation",
];

for (const marker of shippedMarkers) {
  assert.match(
    `${readme}\n${roadmap}\n${gaps}`,
    new RegExp(marker, "i"),
    `documentation should retain shipped marker: ${marker}`
  );
}

const forbiddenStaleClaims = [
  /No Proof Tracker database or viewer/i,
  /No automated 76-question intake beyond chat handoff/i,
  /Dedicated Memory Lock storage, viewer, comparison, and version history\.\s*$/im,
  /Structured intake progress and resume state\.\s*$/im,
];

for (const claim of forbiddenStaleClaims) {
  assert.doesNotMatch(
    `${roadmap}\n${gaps}`,
    claim,
    `stale roadmap claim must not return: ${claim}`
  );
}

assert.match(
  roadmap,
  /Proof Review core storage \| Shipped/i,
  "roadmap should mark Proof Review core storage as shipped"
);
assert.match(
  roadmap,
  /Memory Lock core storage \| Shipped/i,
  "roadmap should mark Memory Lock core storage as shipped"
);
assert.match(
  roadmap,
  /Identity intake persistence \| Shipped/i,
  "roadmap should mark intake persistence as shipped"
);
assert.match(
  gaps,
  /Proof Review history and claim ledger/i,
  "known-gaps audit should describe the remaining Proof Review surface"
);
assert.match(
  gaps,
  /Full project backup, restore and migration/i,
  "known-gaps audit should retain full-project backup as a real gap"
);
assert.match(
  gaps,
  /Windows release acceptance, signing and updates/i,
  "known-gaps audit should retain release-readiness gaps"
);
assert.match(
  readme,
  /Planning documents may lag behind merged runtime work/i,
  "README should remain authoritative over stale planning documents"
);

console.log("SWARMSY documentation truth checks passed.");
