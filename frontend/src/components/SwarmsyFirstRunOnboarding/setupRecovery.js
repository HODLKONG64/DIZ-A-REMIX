export function getSparkySetupRecovery(status = null) {
  if (status?.success === false) {
    return {
      title: "SPARKY could not finish checking the app",
      description:
        "Nothing has been lost. Try the automatic fix again. If it still cannot connect, restart SWARMSY and retry.",
      buttonLabel: "Try the fix again",
    };
  }

  if (!status?.workspace?.exists) {
    return {
      title: "Let's get SPARKY ready",
      description:
        "SPARKY needs a workspace before you can begin. SWARMSY can create and prepare it for you.",
      buttonLabel: "Set up SPARKY",
    };
  }

  if (status?.sparkyPrompt?.missing) {
    return {
      title: "SPARKY needs a quick repair",
      description:
        "The workspace exists, but SPARKY's identity guide is not active. SWARMSY can repair it without changing your saved ideas.",
      buttonLabel: "Fix SPARKY",
    };
  }

  if (status?.workspace?.ready) return null;

  return {
    title: "SPARKY is nearly ready",
    description:
      "One setup step is still unfinished. Let SWARMSY complete it automatically.",
    buttonLabel: "Finish setup",
  };
}
