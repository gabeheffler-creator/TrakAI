import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.trakai.coach",
  appName: "TrakAI Coach",
  webDir: "dist/public",
  plugins: { PushNotifications: { presentationOptions: ["badge", "sound", "alert"] } },
};
export default config;