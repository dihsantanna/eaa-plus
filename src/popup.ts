import "./styles/popup.css";
import { getWideLayout, setWideLayout } from "./ava/prefs.ts";

const toggle = document.getElementById("wide-toggle") as HTMLInputElement | null;
const status = document.getElementById("eaa-pop-status");
const ver = document.getElementById("eaa-pop-ver");

if (ver) {
  try {
    ver.textContent = `v${chrome.runtime.getManifest().version}`;
  } catch {
    ver.textContent = "";
  }
}

const label = (wide: boolean): string => (wide ? "Layout Amplo ativo." : "Layout clássico ativo.");

async function init(): Promise<void> {
  if (!toggle) return;
  const current = await getWideLayout();
  toggle.checked = current;
  if (status) status.textContent = label(current);

  toggle.addEventListener("change", async () => {
    const next = toggle.checked;
    try {
      await setWideLayout(next);
      if (status) status.textContent = label(next);
    } catch {
      if (status) status.textContent = "Erro ao salvar.";
    }
  });
}

void init();
