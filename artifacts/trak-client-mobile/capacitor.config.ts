import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.trakai.client",
  appName: "TrakAI Client",
  webDir: "dist/public",
  plugins: { PushNotifications: { presentationOptions: ["badge", "sound", "alert"] } },
};
export default config;