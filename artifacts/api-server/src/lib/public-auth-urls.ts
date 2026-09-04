function baseUrl(): string {
  return (process.env.AUTH_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
}

export function authPageUrl(
  role: "coach" | "client",
  page: "reset-password" | "verify-email",
  token: string,
): string {
  const artifactPath = role === "client" ? "/client" : "";
  return `${baseUrl()}${artifactPath}/${page}?token=${encodeURIComponent(token)}`;
}

export function clientInviteUrl(token: string): string {
  return `${baseUrl()}/client/join/${encodeURIComponent(token)}`;
}