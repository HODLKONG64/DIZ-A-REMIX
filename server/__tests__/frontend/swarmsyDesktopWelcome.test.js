const fs = require("fs");
const path = require("path");

function read(relativePath) {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../frontend/src", relativePath),
    "utf8"
  );
}

describe("SWARMSY desktop welcome", () => {
  it("keeps local AI optional and hands users to AnythingLLM", () => {
    const app = read("App.jsx");
    const welcome = read("components/SwarmsyDesktopWelcome/index.jsx");

    expect(app).toContain("<SwarmsyDesktopWelcome />");
    expect(welcome).toContain("Ollama is optional");
    expect(welcome).toContain("Use AnythingLLM provider settings");
    expect(welcome).toContain("Continue to AnythingLLM");
    expect(welcome).toContain("does not replace or restrict AnythingLLM");
  });
});
