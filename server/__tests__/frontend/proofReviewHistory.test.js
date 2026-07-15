const fs = require("fs");
const path = require("path");
const vm = require("vm");

const frontendRoot = path.resolve(__dirname, "../../../frontend/src");

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), "utf8");
}

function loadHistoryHelpers() {
  const source = read(
    "components/SwarmsyFirstRunOnboarding/proofReviewHistory.js"
  )
    .replace(/import .*?;\r?\n/g, "")
    .replace(/export const /g, "const ")
    .replace(/export async function /g, "async function ")
    .replace(/export function /g, "function ");

  const script = new vm.Script(`${source}
module.exports = {
  normalizeProofReviews,
  proofReviewLabel,
  buildProofReviewReopenMessage,
  buildProofReviewMarkdown
};`);
  const sandbox = {
    module: { exports: {} },
    exports: {},
    API_BASE: "http://localhost:3001/api",
    baseHeaders: () => ({}),
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    Date,
  };
  vm.createContext(sandbox);
  script.runInContext(sandbox);
  return sandbox.module.exports;
}

describe("SWARMSY Proof Review history", () => {
  it("sorts the active review first and then newest versions", () => {
    const { normalizeProofReviews } = loadHistoryHelpers();
    const reviews = normalizeProofReviews([
      { id: 2, version: 2, isActive: false, content: "older" },
      { id: 3, version: 3, isActive: true, content: "active" },
      { id: 1, version: 1, isActive: false, content: "oldest" },
    ]);

    expect(reviews.map((review) => review.id)).toEqual([3, 2, 1]);
    expect(reviews[0].isActive).toBe(true);
  });

  it("builds a proof-safe SPARKY continuation message", () => {
    const { buildProofReviewReopenMessage } = loadHistoryHelpers();
    const message = buildProofReviewReopenMessage({
      version: 4,
      isActive: true,
      source: "generated",
      content: "Claim A needs a dated source.",
    });

    expect(message).toContain("Continue from this saved SWARMSY Proof Review");
    expect(message).toContain("Proof Review v4");
    expect(message).toContain("Claim A needs a dated source.");
    expect(message).toContain("Do not invent proof");
    expect(message).toContain("completed work and verified result");
  });

  it("exports the selected review with status and source metadata", () => {
    const { buildProofReviewMarkdown } = loadHistoryHelpers();
    const markdown = buildProofReviewMarkdown({
      version: 2,
      isActive: false,
      source: "uploaded",
      content: "Evidence summary",
      createdAt: "2026-07-15T12:00:00.000Z",
    });

    expect(markdown).toContain("# Proof Review v2");
    expect(markdown).toContain("Status: Earlier version");
    expect(markdown).toContain("Source: uploaded");
    expect(markdown).toContain("Evidence summary");
  });

  it("uses the authenticated workspace Proof Review list route", () => {
    const source = read(
      "components/SwarmsyFirstRunOnboarding/proofReviewHistory.js"
    );

    expect(source).toContain(
      "/swarmsy/workspaces/${encodeURIComponent(slug)}/proof-reviews"
    );
    expect(source).toContain("baseHeaders()");
    expect(source).not.toContain("/admin/");
  });

  it("renders history, export, active state and SPARKY continuation", () => {
    const panel = read(
      "components/SwarmsyFirstRunOnboarding/ProofReviewHistoryPanel.jsx"
    );
    const returningHome = read(
      "components/SwarmsyFirstRunOnboarding/ReturningUserHome.jsx"
    );

    expect(panel).toContain("Proof Review history");
    expect(panel).toContain("Active");
    expect(panel).toContain("Export");
    expect(panel).toContain("Continue with SPARKY");
    expect(panel).toContain("selectedReview.content");
    expect(returningHome).toContain("ProofReviewHistoryPanel");
    expect(returningHome).toContain(
      "onContinueWithSparky={(message) => onContinueIdea?.(message)}"
    );
  });
});
