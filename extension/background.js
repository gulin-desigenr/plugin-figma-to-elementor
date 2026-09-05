chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Não foi possível habilitar o painel lateral.", error));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ping") {
    sendResponse({ ok: true, source: "figmentor-bridge" });
    return false;
  }

  return false;
});
