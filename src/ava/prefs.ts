/* Preferências visuais da extensão (apenas booleano em storage.local, sem notas
 * nem dados pessoais). Padrão: layout amplo (beta) desligado. */

export const WIDE_LAYOUT_KEY = "eaa_wide_layout";

export async function getWideLayout(): Promise<boolean> {
  try {
    const area = chrome.storage?.local;
    if (!area) return false;
    const res = await area.get({ [WIDE_LAYOUT_KEY]: false });
    return res[WIDE_LAYOUT_KEY] === true;
  } catch {
    return false;
  }
}

export async function setWideLayout(enabled: boolean): Promise<void> {
  const area = chrome.storage?.local;
  if (!area) return;
  await area.set({ [WIDE_LAYOUT_KEY]: enabled });
}

export function onWideLayoutChange(cb: (enabled: boolean) => void): () => void {
  if (!chrome.storage?.onChanged) return () => {};
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== "local" || !(WIDE_LAYOUT_KEY in changes)) return;
    cb(changes[WIDE_LAYOUT_KEY].newValue === true);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
