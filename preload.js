
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kay", {
  pickExe: () => ipcRenderer.invoke("pick-exe"),
  diagnose: exe => ipcRenderer.invoke("diagnose", exe),
  launch: config => ipcRenderer.invoke("launch", config),
  installApp: config => ipcRenderer.invoke("install-app", config),
  openFolder: kind => ipcRenderer.invoke("open-folder", kind),
  gamingSetup: () => ipcRenderer.invoke("gaming-setup")
});
