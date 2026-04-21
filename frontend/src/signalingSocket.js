import io from "socket.io-client";

/**
 * Socket.IO URL:
 * - If `VITE_SOCKET_URL` is set → use it (second ngrok tunnel or separate API host).
 * - Otherwise → page origin so one public URL (e.g. ngrok → Vite) works; Vite proxies `/socket.io` to Express.
 */
export function resolveSignalingUrl() {
  const fromEnv = import.meta.env.VITE_SOCKET_URL;
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
    return fromEnv.trim();
  }
  if (typeof globalThis !== "undefined" && globalThis.location?.origin) {
    return globalThis.location.origin;
  }
  return "http://localhost:5000";
}

/** Resolved once per page load (fine for footer label). */
export const SIGNALING_URL = resolveSignalingUrl();

/** Avoid duplicate Socket.IO clients when Vite HMR re-evaluates UI modules. */
const GLOBAL_KEY = "__videoCallSignalingSocket_v1";

export function getSignalingSocket() {
  const g = globalThis;
  if (g[GLOBAL_KEY]) {
    return g[GLOBAL_KEY];
  }
  const url = resolveSignalingUrl();
  const socket = io(url, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
  });
  g[GLOBAL_KEY] = socket;
  return socket;
}
