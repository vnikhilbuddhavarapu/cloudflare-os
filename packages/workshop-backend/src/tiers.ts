import type { JWTPayload } from "jose";

/** A model entry in a tier's allowlist: either a bare id string or an object with a custom label. */
export type TierModelEntry = string | { id: string; label?: string };

/** Normalized form: always has `id`, optionally has `label`. */
export type NormalizedTierModel = { id: string; label?: string };

/** Tier-to-groups mapping read from the TIERS_CONFIG env var at runtime. */
export type TierConfig = Readonly<Record<string, {
  groups: readonly string[];
  /** Model ids allowed for this tier. Omitted/null = all models; empty array = none. */
  models?: readonly TierModelEntry[] | null;
  /** Default model id for new chats when the user hasn't chosen one. Must be in `models`. */
  default?: string;
}>>;

/** Fallback when TIERS_CONFIG is not set: everyone gets "restricted" with no model restrictions. */
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

/** Normalize a TierModelEntry (string or object) into {id, label?}. */
export function normalizeModelEntry(entry: TierModelEntry): NormalizedTierModel {
  if (typeof entry === "string") return { id: entry };
  return { id: entry.id, label: entry.label };
}

// ──────────────────────────────────────────────────────────────────────────────
// Model allowlist accessors.
//
// To add/remove models for a tier today: edit config/tiers.json, then redeploy.
// Sprint 8 may replace the file read (TIERS_CONFIG env var) with an admin-config
// DO/KV lookup — all allowlist reads go through these accessors, so only they
// need to change. Do not read config/tiers.json directly at call sites.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Returns the set of allowed model ids for a tier.
 * - `models` omitted or null → undefined (caller treats as "all models allowed").
 * - `models` is an empty array → empty Set (no models allowed).
 * - Otherwise → Set of model ids from the normalized entries.
 */
export function allowedModelsForTier(tier: string, config: TierConfig): Set<string> | undefined {
  const entry = config[tier];
  if (!entry || entry.models == null) return undefined;
  return new Set(entry.models.map(normalizeModelEntry).map(m => m.id));
}

/**
 * Returns the normalized model entries (with optional labels) for a tier.
 * Undefined when the tier has no `models` array (meaning "all models, no label overrides").
 */
export function modelEntriesForTier(tier: string, config: TierConfig): NormalizedTierModel[] | undefined {
  const entry = config[tier];
  if (!entry || entry.models == null) return undefined;
  return entry.models.map(normalizeModelEntry);
}

/**
 * Returns the default model id for a tier, or undefined if none configured.
 * The default MUST be a member of the tier's `models` allowlist (validated in tests).
 */
export function defaultModelForTier(tier: string, config: TierConfig): string | undefined {
  return config[tier]?.default;
}
