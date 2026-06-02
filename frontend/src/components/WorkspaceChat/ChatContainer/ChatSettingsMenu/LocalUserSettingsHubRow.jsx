import { useState } from "react";
import ModalWrapper from "@/components/ModalWrapper";
import SwarmsyLocalUserSettingsHub from "@/components/SwarmsyLocalUserSettingsHub";
import { useLocalUserSettingsHub } from "@/components/SwarmsyLocalUserSettingsHub/useLocalUserSettingsHub";

export default function LocalUserSettingsHubRow({ onClose }) {
  const [open, setOpen] = useState(false);
  const controller = useLocalUserSettingsHub();

  function openHub() {
    setOpen(true);
    onClose?.();
  }

  return (
    <>
      <div
        onClick={openHub}
        className="flex items-center px-2 py-1 rounded cursor-pointer hover:bg-zinc-700 light:hover:bg-slate-200"
      >
        <span className="text-sm font-normal text-white light:text-slate-800">
          Local User Settings Hub
        </span>
      </div>
      <ModalWrapper isOpen={open}>
        <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-theme-sidebar-border bg-theme-bg-primary p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-theme-text-primary">
              Local User Settings Hub
            </h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-theme-sidebar-border bg-theme-bg-secondary px-3 py-1 text-sm text-theme-text-primary"
            >
              Close
            </button>
          </div>
          <SwarmsyLocalUserSettingsHub controller={controller} />
        </div>
      </ModalWrapper>
    </>
  );
}
