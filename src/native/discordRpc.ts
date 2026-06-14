import { Client } from "discord-rpc";

import { config } from "./config";

// internal state
let rpc: Client;

export async function initDiscordRpc() {
  // Discord IPC socket never exists in snap or flatpak environments
  if (process.env.SNAP || process.env.FLATPAK_ID) return;

  if (!config.discordRpc) return;

  // clean up existing client if one exists
  rpc?.removeAllListeners();

  try {
    rpc = new Client({ transport: "ipc" });

    rpc.on("ready", () =>
      rpc.setActivity({
        state: "stoat.chat",
        details: "Chatting with others",
        largeImageKey: "qr",
        largeImageText: "Join Stoat!",
        buttons: [
          {
            label: "Join Stoat",
            url: "https://stoat.chat/",
          },
        ],
      }),
    );

    rpc.on("disconnected", reconnect);
    // socket-level errors are emitted on the client; catch them to avoid
    // unhandled rejection warnings when Discord is not running
    rpc.on("error", () => reconnect());

    await rpc.login({ clientId: "872068124005007420" });
  } catch (err) {
    reconnect();
  }
}

const reconnect = () => setTimeout(() => initDiscordRpc(), 1e4);

export async function destroyDiscordRpc() {
  rpc?.destroy();
}
