import { CheckCircle, SpinnerGap } from "@phosphor-icons/react";

export default function SparkySetupRecovery({
  step,
  busy = false,
  result = null,
  onFix,
}) {
  if (!step) return null;

  return (
    <section
      aria-labelledby="sparky-setup-recovery-title"
      className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100 light:text-amber-900"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">
            SPARKY setup
          </p>
          <h2
            id="sparky-setup-recovery-title"
            className="mt-2 text-2xl font-semibold"
          >
            {step.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 opacity-90">
            {step.description}
          </p>
          {result?.message && (
            <p
              role={result.tone === "error" ? "alert" : "status"}
              className="mt-3 text-sm font-medium"
            >
              {result.message}
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={onFix}
          className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <SpinnerGap className="animate-spin" size={18} />
          ) : (
            <CheckCircle size={18} weight="fill" />
          )}
          {busy ? "SPARKY is fixing this..." : step.buttonLabel}
        </button>
      </div>
    </section>
  );
}
