const BEARER = /^Bearer (\S+)$/i;

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  return BEARER.exec(header.trim())?.[1] ?? null;
}
