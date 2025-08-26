const channel = new BroadcastChannel("pump_clone_channel");

export const broadcastService = {
  postMessage(message: any) {
    channel.postMessage(message);
  },
  addEventListener(callback: (event: MessageEvent) => void) {
    channel.addEventListener("message", callback);
  },
  removeEventListener(callback: (event: MessageEvent) => void) {
    channel.removeEventListener("message", callback);
  },
};
