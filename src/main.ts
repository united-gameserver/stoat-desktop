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

  // true while setup picker is open — prevents window-all-closed from quitting
  let setupInProgress = false;

  // create and configure the app when electron is ready
  app.on("ready", async () => {
    let instanceUrl: string | undefined;
    let pendingInvite: string | null = null;

    // show setup picker on first run (no saved instance URL)
    if (needsSetup()) {
      setupInProgress = true;
      const result = await showSetupWindow();
      instanceUrl = result.url;
      pendingInvite = result.invite;
      // keep setupInProgress true until after createMainWindow below
    }

    // create window — do this before clearing setupInProgress so
    // window-all-closed can't fire between the setup window closing and
    // the main window opening
    createMainWindow(instanceUrl);
    setupInProgress = false;

    // navigate to invite URL after SPA has initialized from root
    if (pendingInvite) {
      const inviteUrl = `${instanceUrl}/invite/${pendingInvite}`;
      mainWindow.webContents.once("did-finish-load", () => {
        mainWindow.webContents.loadURL(inviteUrl);
      });
    }

    // watch for initial load failure and re-show setup; cancel once the
    // first load succeeds so invite navigations don't re-trigger this
    const onFailedLoad = (_event: Electron.Event, errorCode: number) => {
      if (errorCode === -3) return; // ERR_ABORTED — user-triggered
      handleChangeServer();
    };
    mainWindow.webContents.once("did-finish-load", () => {
      mainWindow.webContents.off("did-fail-load", onFailedLoad);
    });
    mainWindow.webContents.on("did-fail-load", onFailedLoad);

    // re-show setup (triggered by tray "Change server" or initial load failure)
    async function handleChangeServer() {
      mainWindow.webContents.off("did-fail-load", onFailedLoad);
      setupInProgress = true;
      config.instanceUrl = "";
      mainWindow.hide();
      const result = await showSetupWindow();
      setupInProgress = false;
      config.instanceUrl = result.url;
      if (result.invite) {
        mainWindow.webContents.once("did-finish-load", () => {
          mainWindow.webContents.loadURL(`${result.url}/invite/${result.invite}`);
        });
      }
      mainWindow.loadURL(result.url);
      mainWindow.show();
    }

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
    if (setupInProgress) return; // setup picker open — main window not created yet
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
