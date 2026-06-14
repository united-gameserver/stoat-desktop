import { BrowserWindow, ipcMain } from "electron";

import setupHtml from "../setup.html?raw";

import { config } from "./config";

const DEFAULT_INSTANCE = "https://test.chat.gamed.net";

export const DEFAULT_INSTANCE_URL = DEFAULT_INSTANCE;

let setupWindow: BrowserWindow | null = null;

export function needsSetup(): boolean {
  return (
    !config.instanceUrl &&
    !process.argv.includes("--force-server") &&
    !process.argv.some((a) => a.startsWith("--force-server="))
  );
}

export function getInstanceUrl(): string {
  const forceArg = process.argv.find((a) => a.startsWith("--force-server="));
  if (forceArg) return forceArg.split("=")[1];

  const forceIdx = process.argv.indexOf("--force-server");
  if (forceIdx !== -1 && process.argv[forceIdx + 1]) {
    return process.argv[forceIdx + 1];
  }

  return config.instanceUrl || DEFAULT_INSTANCE;
}

export function showSetupWindow(): Promise<{ url: string }> {
  return new Promise((resolve) => {
    setupWindow = new BrowserWindow({
      width: 420,
      height: 240,
      resizable: false,
      frame: true,
      title: "Connect to server",
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    setupWindow.setMenu(null);

    const html = setupHtml;
    const dataUrl =
      "data:text/html;charset=utf-8," + encodeURIComponent(html);
    setupWindow.loadURL(dataUrl);

    ipcMain.once("gamed-connect", (_, url: string) => {
      // Persist only the origin so future launches go to the home page
      try {
        config.instanceUrl = new URL(url).origin;
      } catch {
        config.instanceUrl = url;
      }
      setupWindow?.close();
      setupWindow = null;
      resolve({ url });
    });

    setupWindow.on("closed", () => {
      setupWindow = null;
    });
  });
}
