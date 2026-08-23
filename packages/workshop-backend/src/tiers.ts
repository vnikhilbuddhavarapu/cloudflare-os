import type { JWTPayload } from "jose";

/** Tier-to-groups mapping read from the TIERS_CONFIG env var at runtime. */
export type TierConfig = Readonly<Record<string, { groups: readonly string[] }>>;

/** Fallback when TIERS_CONFIG is not set: everyone gets "restricted". */
const DEFAULT_TIER_CONFIG: TierConfig = {
  frontier: { groups: [] },
  standard: { groups: [] },
  restricted: { groups: [] },
};

const DEFAULT_TIER = "restricted";
/** Most-privileged-first precedence. */
const TIER_PRECEDENCE = ["frontier", "standard", "restricted"];

/**
 * Extract group display-name strings from a verified Access JWT payload.
 * Groups appear under `custom.groups` (configured as a custom OIDC claim);
 * a top-level `groups` claim is also accepted as a fallback. Returns an empty
 * array when groups are absent (e.g. trimmed by Access for cookie size).
 */
export function flattenGroups(payload: JWTPayload): string[] {
  const custom = payload.custom;
  if (custom && typeof custom === "object" && Array.isArray((custom as any).groups)) {
    return (custom as any).groups.filter((g: unknown): g is string => typeof g === "string");
  }
  if (Array.isArray(payload.groups)) {
    return payload.groups.filter((g: unknown): g is string => typeof g === "string");
  }
  return [];
}

/**
 * Derive the user's tier from their groups and the configured tier mapping.
 * Exact-string, case-sensitive match. Most-privileged wins (frontier > standard > restricted).
 * No match, empty groups, or missing groups → "restricted" (safe default).
 */
export function deriveTier(groups: readonly string[], config: TierConfig): string {
  const groupSet = new Set(groups);
  for (const tier of TIER_PRECEDENCE) {
    const entry = config[tier];
    if (entry && entry.groups.some(g => groupSet.has(g))) {
      return tier;
    }
  }
  return DEFAULT_TIER;
}

/** Parse the TIERS_CONFIG env var (JSON string). Falls back to default when unset or invalid. */
export function parseTierConfig(raw: string | undefined): TierConfig {
  if (!raw) return DEFAULT_TIER_CONFIG;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as TierConfig;
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_TIER_CONFIG;
}
