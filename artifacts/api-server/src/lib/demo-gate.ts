export function canSeedDemoAccounts(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "test" || (env.NODE_ENV === "development" && env.ENABLE_DEMO_DATA === "true");
}