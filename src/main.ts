import { IUpdateInfo, updateElectronApp } from "update-electron-app";

import { BrowserWindow, Notification, app, shell } from "electron";
import started from "electron-squirrel-startup";

import { autoLaunch } from "./native/autoLaunch";
import { config } from "./native/config";
import { initDiscordRpc } from "./native/discordRpc";
import { needsSetup, showSetupWindow } from "./native/setup";
import { initTray } from "./native/tray";
import { BUILD_URL, createMainWindow, mainWindow } from "./native/window";

// Squirrel-specific logic
// create/remove shortcuts on Windows when installing / uninstalling
// we just need to close out of the app immediately
if (started) {
  app.quit();
}

// disable hw-accel if so requested
if (!config.hardwareAcceleration) {
  app.disableHardwareAcceleration();
}

// ensure only one copy of the application can run
const acquiredLock = app.requestSingleInstanceLock();

const onNotifyUser = (_info: IUpdateInfo) => {
  const notification = new Notification({
    title: "Update Available",
    body: "Restart the app to install the update.",
    silent: true,
  });

  notification.show();
};

if (acquiredLock) {
  // start auto update logic
  updateElectronApp({ onNotifyUser });

  // create and configure the app when electron is ready
  app.on("ready", async () => {
    let instanceUrl: string | undefined;

    // show setup picker on first run (no saved instance URL)
    if (needsSetup()) {
      const result = await showSetupWindow();
      const dest = result.invite
        ? `${result.url}/invite/${result.invite}`
        : result.url;
      instanceUrl = dest;
    }

    // create window and application contexts
    createMainWindow(instanceUrl);

    // re-show setup if the instance URL fails to load
    async function handleChangeServer() {
      config.instanceUrl = "";
      mainWindow.hide();
      const result = await showSetupWindow();
      config.instanceUrl = result.url;
      const dest = result.invite
        ? `${result.url}/invite/${result.invite}`
        : result.url;
      mainWindow.loadURL(dest);
      mainWindow.show();
    }

    mainWindow.webContents.once("did-fail-load", (_, errorCode) => {
      if (errorCode === -3) return; // ERR_ABORTED — user-triggered, ignore
      handleChangeServer();
    });

    // enable auto start on Windows and MacOS
    if (config.firstLaunch) {
      if (process.platform === "win32" || process.platform === "darwin") {
        autoLaunch.enable();
      }
      config.firstLaunch = false;
    }

    initTray(handleChangeServer);
    initDiscordRpc();

    // Windows specific fix for notifications
    if (process.platform === "win32") {
      app.setAppUserModelId("chat.stoat.notifications");
    }
  });

  // focus the window if we try to launch again
  app.on("second-instance", () => {
    mainWindow.show();
    mainWindow.restore();
    mainWindow.focus();
  });

  // macOS specific behaviour to keep app active in dock:
  // (irrespective of the minimise-to-tray option)

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // ensure URLs launch in external context
  app.on("web-contents-created", (_, contents) => {
    // prevent navigation out of build URL origin
    contents.on("will-navigate", (event, navigationUrl) => {
      if (new URL(navigationUrl).origin !== BUILD_URL.origin) {
        event.preventDefault();
      }
    });

    // handle links externally
    contents.setWindowOpenHandler(({ url }) => {
      if (
        url.startsWith("http:") ||
        url.startsWith("https:") ||
        url.startsWith("mailto:")
      ) {
        setImmediate(() => {
          shell.openExternal(url);
        });
      }

      return { action: "deny" };
    });
  });
} else {
  app.quit();
}
