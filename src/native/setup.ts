import { BrowserWindow, ipcMain, nativeImage } from "electron";

import setupHtml from "../setup.html?raw";
import gamedLogoAsset from "../assets/gamed-logo.png?asset";

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

export function showSetupWindow(): Promise<{ url: string; invite: string | null }> {
  return new Promise((resolve) => {
    setupWindow = new BrowserWindow({
      width: 480,
      height: 520,
      resizable: false,
      frame: true,
      title: "Gameserver Chat",
      icon: nativeImage.createFromDataURL(gamedLogoAsset),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    setupWindow.setMenu(null);

    const html = setupHtml.replace("__GAMED_LOGO__", gamedLogoAsset);
    const dataUrl =
      "data:text/html;charset=utf-8," + encodeURIComponent(html);
    setupWindow.loadURL(dataUrl);

    ipcMain.once("gamed-connect", (_, url: string, invite: string | null) => {
      config.instanceUrl = url;
      setupWindow?.close();
      setupWindow = null;
      resolve({ url, invite });
    });

    setupWindow.on("closed", () => {
      setupWindow = null;
    });
  });
}
