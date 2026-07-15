const fs = require("fs");
const path = require("path");
const vm = require("vm");

const frontendRoot = path.resolve(__dirname, "../../../frontend/src");

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), "utf8");
}

function loadDashboardHelpers() {
  const source = read(
    "components/SwarmsyFirstRunOnboarding/projectDashboard.js"
  )
    .replace(/import[\s\S]*?from ".*?";\r?\n/g, "")
    .replace(/export function /g, "function ");

  const script = new vm.Script(`${source}
module.exports = {
  buildProjectDashboardSnapshot,
  getProjectDashboardNextAction,
  projectDashboardStatusCards
};`);
  const sandbox = {
    module: { exports: {} },
    exports: {},
    buildIdentityIdeaSparkyMessage: (idea) => `idea:${idea?.id}`,
    buildMemoryLockStarterMessage: (content) => `lock:${content}`,
    buildProofReviewReopenMessage: (review) => `proof:${review?.id}`,
    normalizeProofReviews: (reviews = []) =>
      reviews
        .map((review) => ({ ...review }))
        .sort((left, right) => {
          if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
          return Number(right.version || 0) - Number(left.version || 0);
        }),
  };
  vm.createContext(sandbox);
  script.runInContext(sandbox);
  return sandbox.module.exports;
}

describe("SWARMSY returning-user project dashboard", () => {
  it("summarises active project state and saved counts", () => {
    const { buildProjectDashboardSnapshot, projectDashboardStatusCards } =
      loadDashboardHelpers();
    const snapshot = buildProjectDashboardSnapshot({
      session: { id: 7, mode: "face" },
      ideas: [
        { id: 2, title: "Saved identity", status: "saved" },
        { id: 3, title: "New proposal", status: "proposed" },
      ],
      locks: [
        { id: 4, isActive: false, content: "old" },
        { id: 5, isActive: true, content: "active" },
      ],
      reviews: [
        { id: 8, version: 1, isActive: false, content: "old proof" },
        { id: 9, version: 2, isActive: true, content: "active proof" },
      ],
    });

    expect(snapshot.currentIdea.id).toBe(3);
    expect(snapshot.activeLock.id).toBe(5);
    expect(snapshot.activeReview.id).toBe(9);
    expect(snapshot.counts).toEqual({ ideas: 2, locks: 2, reviews: 2 });
    expect(projectDashboardStatusCards(snapshot).map((card) => card.label)).toEqual([
      "Identity",
      "Questions",
      "Memory Locks",
      "Proof Reviews",
    ]);
  });

  it("prioritises unfinished intake before all other saved work", () => {
    const { buildProjectDashboardSnapshot, getProjectDashboardNextAction } =
      loadDashboardHelpers();
    const snapshot = buildProjectDashboardSnapshot({
      session: { id: 10, mode: "hidden" },
      ideas: [{ id: 2, title: "Idea", status: "saved" }],
      locks: [{ id: 3, isActive: true, content: "lock" }],
      reviews: [{ id: 4, version: 1, isActive: true, content: "proof" }],
    });

    expect(getProjectDashboardNextAction(snapshot)).toMatchObject({
      kind: "intake",
      label: "Continue your questions",
      value: { id: 10, mode: "hidden" },
    });
  });

  it("continues a saved identity before proof or memory", () => {
    const { buildProjectDashboardSnapshot, getProjectDashboardNextAction } =
      loadDashboardHelpers();
    const snapshot = buildProjectDashboardSnapshot({
      ideas: [{ id: 11, title: "Identity", status: "saved" }],
      locks: [{ id: 12, isActive: true, content: "lock" }],
      reviews: [{ id: 13, version: 1, isActive: true, content: "proof" }],
    });

    expect(getProjectDashboardNextAction(snapshot)).toMatchObject({
      kind: "continue-idea",
      value: { id: 11 },
      message: "idea:11",
    });
  });

  it("uses only existing authenticated SWARMSY APIs", () => {
    const panel = read(
      "components/SwarmsyFirstRunOnboarding/ProjectDashboard.jsx"
    );

    expect(panel).toContain("SwarmsyOnboarding.activeIntakeSession");
    expect(panel).toContain("SwarmsyOnboarding.identityIdeas");
    expect(panel).toContain("SwarmsyOnboarding.memoryLocks");
    expect(panel).toContain("listProofReviews");
    expect(panel).not.toContain("/admin/");
  });

  it("replaces the old welcome card while preserving Proof Review history", () => {
    const returningHome = read(
      "components/SwarmsyFirstRunOnboarding/ReturningUserHome.jsx"
    );

    expect(returningHome).toContain("ProjectDashboard");
    expect(returningHome).toContain("ProofReviewHistoryPanel");
    expect(returningHome).toContain("onContinueIntake={onContinueIntake}");
    expect(returningHome).toContain("onContinueIdea={onContinueIdea}");
    expect(returningHome).toContain("onShowChoices={onShowChoices}");
  });
});
