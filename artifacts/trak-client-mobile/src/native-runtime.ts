import { App } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { KeychainAccess, SecureStorage } from "@aparajita/capacitor-secure-storage";

const role = "client" as const;
const storagePrefix = "com.trakai.client.";
const originalFetch = window.fetch.bind(window);
let accessToken: string | null = null;
let refreshToken: string | null = null;
let currentDeviceToken: string | null = null;
let registeredPushToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let listeners: PluginListenerHandle[] = [];

function apiUrl(input: RequestInfo | URL) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const parsed = new URL(url, window.location.origin);
  if (!parsed.pathname.startsWith("/api") || parsed.origin !== window.location.origin) return url;
  const base = import.meta.env.VITE_NATIVE_API_BASE_URL;
  if (!base) throw new Error("VITE_NATIVE_API_BASE_URL is required for native builds");
  return `${base.replace(/\/$/, "")}${parsed.pathname}${parsed.search}`;
}

async function persist(tokens: { accessToken: string; refreshToken: string }) {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  await SecureStorage.set("refresh-token", refreshToken, true, false, KeychainAccess.whenUnlockedThisDeviceOnly);
}

async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  await SecureStorage.remove("refresh-token");
}

async function clearPushToken() {
  currentDeviceToken = null;
  registeredPushToken = null;
  await SecureStorage.remove("push-token");
}

async function performRefresh() {
  if (!refreshToken) return false;
  const response = await originalFetch(apiUrl("/api/auth/token/refresh"), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) { await clearTokens(); return false; }
  await persist(await response.json());
  return true;
}

function refresh() {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function nativeFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const source = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const sourceUrl = new URL(source, window.location.origin);
  if (!sourceUrl.pathname.startsWith("/api") || sourceUrl.origin !== window.location.origin) return originalFetch(input, init);
  const path = sourceUrl.pathname;
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
  let body = init.body;
  let url = apiUrl(source);
  if (path === `/api/auth/${role}/login`) {
    url = apiUrl("/api/auth/token/login");
    const credentials = typeof body === "string" ? JSON.parse(body) : {};
    body = JSON.stringify({ ...credentials, role, deviceLabel: "TrakAI iOS" });
    headers.set("Content-Type", "application/json");
  } else if (path === "/api/auth/logout") {
    await unregisterPushToken().catch(() => undefined);
    url = apiUrl("/api/auth/token/revoke");
    body = JSON.stringify({ refreshToken, deviceToken: registeredPushToken });
    headers.set("Content-Type", "application/json");
  }
  if (accessToken && !path.startsWith("/api/auth/token/")) headers.set("Authorization", `Bearer ${accessToken}`);
  const request = () => originalFetch(url, { ...init, body, headers });
  return request().then(async response => {
    if (path === `/api/auth/${role}/login` && response.ok) {
      const tokens = await response.clone().json();
      await persist(tokens);
      if (currentDeviceToken) void registerPushToken(currentDeviceToken).catch(() => undefined);
      return new Response(JSON.stringify({ id: tokens.id, name: tokens.name, role: tokens.role }), {
        status: response.status,
        statusText: response.statusText,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (path === "/api/auth/logout") {
      if (response.ok) await clearPushToken();
      await clearTokens();
    }
    if (response.status !== 401 || headers.has("X-Trak-Retry") || path.startsWith("/api/auth/token/")) return response;
    headers.set("X-Trak-Retry", "1");
    return (await refresh()) ? request() : response;
  });
}

function route(url: string) {
  const link = new URL(url, window.location.origin);
  let path = link.pathname;
  if (link.protocol === "trakai-client:" && link.host) path = `/${link.host}${path === "/" ? "" : path}`;
  if (!path.startsWith("/") || path.startsWith("//")) return;
  window.history.pushState({}, "", `${path}${link.search}${link.hash}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

async function registerPushToken(token: string) {
  currentDeviceToken = token;
  await SecureStorage.set("push-token", token, true, false, KeychainAccess.whenUnlockedThisDeviceOnly);
  // The APNs endpoint is intentionally authenticated by the bearer session; it never accepts an actor id.
  await window.fetch("/api/push-tokens", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceToken: token }),
  });
  registeredPushToken = token;
}
async function unregisterPushToken() {
  const token = currentDeviceToken ?? registeredPushToken;
  if (!token) return;
  const response = await window.fetch("/api/push-tokens", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceToken: token }),
  });
  if (!response.ok) throw new Error("Failed to unregister native push token");
  await clearPushToken();
}

export async function initializeNativeRuntime() {
  if (!Capacitor.isNativePlatform()) return () => {};
  if (!import.meta.env.VITE_NATIVE_API_BASE_URL) throw new Error("VITE_NATIVE_API_BASE_URL is required for native builds");
  await SecureStorage.setKeyPrefix(storagePrefix);
  await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
  refreshToken = await SecureStorage.getItem("refresh-token");
  currentDeviceToken = await SecureStorage.getItem("push-token");
  window.fetch = nativeFetch;
  if (refreshToken) await refresh();
  listeners = await Promise.all([
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void refresh().then(ok => {
        if (ok && currentDeviceToken) void registerPushToken(currentDeviceToken);
      }).catch(() => undefined);
    }),
    App.addListener("appUrlOpen", ({ url }) => route(url)),
    PushNotifications.addListener("registration", ({ value }) => { void registerPushToken(value).catch(() => undefined); }),
    PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const target = notification.data?.url ?? notification.data?.route;
      if (typeof target === "string") route(target);
    }),
  ]);
  const launchUrl = await App.getLaunchUrl();
  if (launchUrl?.url) route(launchUrl.url);
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive === "granted") await PushNotifications.register();
  return async () => { await Promise.all(listeners.map(listener => listener.remove())); listeners = []; };
}
