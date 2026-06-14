import { Menu, Tray, nativeImage } from "electron";

import trayIconAsset from "../assets/gamed-tray.png?asset";
import macOsTrayIconAsset from "../assets/gamed-tray.png?asset";
import { version } from "../../package.json";

import { mainWindow, quitApp } from "./window";

// internal tray state
let tray: Tray = null;
let changeServerCallback: (() => void) | null = null;

function createTrayIcon() {
  const image = nativeImage.createFromDataURL(trayIconAsset);
  if (process.platform === "darwin") {
    const resized = image.resize({ width: 20, height: 20 });
    resized.setTemplateImage(true);
    return resized;
  }
  // Linux panel tray icons should be 22×22
  if (process.platform === "linux") {
    return image.resize({ width: 22, height: 22 });
  }
  return image;
}

export function initTray(onChangeServer?: () => void) {
  changeServerCallback = onChangeServer ?? null;
  const trayIcon = createTrayIcon();
  tray = new Tray(trayIcon);
  updateTrayMenu();
  tray.setToolTip("Stoat for Desktop");
  tray.setImage(trayIcon);
  tray.on("click", () => {
    if (mainWindow.isVisible()) {
     mainWindow.hide();
    } else {
     mainWindow.show();
     mainWindow.focus();
    }
  });
}

export function updateTrayMenu() {
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Stoat for Desktop", type: "normal", enabled: false },
      {
        label: "Version",
        type: "submenu",
        submenu: Menu.buildFromTemplate([
          {
            label: version,
            type: "normal",
            enabled: false,
          },
        ]),
      },
      { type: "separator" },
      ...(changeServerCallback
        ? [
            {
              label: "Change server",
              type: "normal" as const,
              click: changeServerCallback,
            },
            { type: "separator" as const },
          ]
        : []),
      {
        label: mainWindow.isVisible() ? "Hide App" : "Show App",
        type: "normal",
        click() {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
          }
        },
      },
      {
        label: "Quit App",
        type: "normal",
        click: quitApp,
      },
    ]),
  );
}
