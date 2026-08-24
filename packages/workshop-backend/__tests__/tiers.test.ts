import { describe, expect, it } from "vitest";
import { deriveTier, flattenGroups, parseTierConfig, allowedModelsForTier, modelEntriesForTier, defaultModelForTier, normalizeModelEntry } from "../src/tiers.js";
import type { JWTPayload } from "jose";

const CONFIG = {
  frontier: { groups: ["ai-admins"] },
  standard: { groups: ["ai-users"] },
  restricted: { groups: [] },
};

describe("flattenGroups", () => {
  it("reads groups from custom.groups", () => {
    const payload: JWTPayload = {
      email: "u@example.com",
      custom: { groups: ["ai-admins", "ai-users"] },
    };
    expect(flattenGroups(payload)).toEqual(["ai-admins", "ai-users"]);
  });

  it("reads groups from top-level groups as fallback", () => {
    const payload: JWTPayload = { groups: ["ai-users"] };
    expect(flattenGroups(payload)).toEqual(["ai-users"]);
  });

  it("returns empty array when groups absent", () => {
    expect(flattenGroups({ email: "u@example.com" })).toEqual([]);
  });

  it("returns empty array when custom.groups is not an array", () => {
    expect(flattenGroups({ custom: { groups: "not-array" } })).toEqual([]);
  });

  it("filters non-string entries", () => {
    const payload: JWTPayload = {
      custom: { groups: ["ai-admins", 42, null, "ai-users"] },
    };
    expect(flattenGroups(payload)).toEqual(["ai-admins", "ai-users"]);
  });
});

describe("deriveTier", () => {
  it("returns frontier when a frontier group is present", () => {
    expect(deriveTier(["ai-admins"], CONFIG)).toBe("frontier");
  });

  it("returns standard when only a standard group is present", () => {
    expect(deriveTier(["ai-users"], CONFIG)).toBe("standard");
  });

  it("returns restricted when no groups match", () => {
    expect(deriveTier(["some-other-group"], CONFIG)).toBe("restricted");
  });

  it("returns restricted for empty groups", () => {
    expect(deriveTier([], CONFIG)).toBe("restricted");
  });

  it("frontier wins over standard when both are present", () => {
    expect(deriveTier(["ai-users", "ai-admins"], CONFIG)).toBe("frontier");
  });

  it("match is case-sensitive", () => {
    expect(deriveTier(["AI-ADMINS"], CONFIG)).toBe("restricted");
  });

  it("ignores tiers absent from config", () => {
    expect(deriveTier(["ai-admins"], { standard: { groups: ["ai-users"] } })).toBe("restricted");
  });
});

describe("parseTierConfig", () => {
  it("parses valid JSON", () => {
    const raw = JSON.stringify(CONFIG);
    expect(parseTierConfig(raw)).toEqual(CONFIG);
  });

  it("returns default when undefined", () => {
    expect(parseTierConfig(undefined)).toEqual({
      frontier: { groups: [] },
      standard: { groups: [] },
      restricted: { groups: [] },
    });
  });

  it("returns default when empty string", () => {
    expect(parseTierConfig("")).toEqual({
      frontier: { groups: [] },
      standard: { groups: [] },
      restricted: { groups: [] },
    });
  });

  it("returns default for invalid JSON", () => {
    expect(parseTierConfig("{not json")).toEqual({
      frontier: { groups: [] },
      standard: { groups: [] },
      restricted: { groups: [] },
    });
  });

  it("returns default for non-object JSON", () => {
    expect(parseTierConfig("[1,2,3]")).toEqual({
      frontier: { groups: [] },
      standard: { groups: [] },
      restricted: { groups: [] },
    });
  });
});


const MODEL_CONFIG = {
  frontier: {
    groups: ["ai-admins"],
    default: "@cf/zai-org/glm-5.2",
    models: ["claude-opus-5", "claude-sonnet-5", "@cf/zai-org/glm-5.2"],
  },
  standard: {
    groups: ["ai-users"],
    default: "@cf/zai-org/glm-5.2",
    models: ["@cf/zai-org/glm-5.2", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"],
  },
  restricted: {
    groups: [],
    default: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    models: ["@cf/meta/llama-3.3-70b-instruct-fp8-fast"],
  },
};

describe("normalizeModelEntry", () => {
  it("normalizes a bare string to {id}", () => {
    expect(normalizeModelEntry("claude-opus-5")).toEqual({ id: "claude-opus-5" });
  });

  it("normalizes an object with label", () => {
    expect(normalizeModelEntry({ id: "claude-opus-5", label: "Opus" })).toEqual({
      id: "claude-opus-5", label: "Opus",
    });
  });

  it("normalizes an object without label", () => {
    expect(normalizeModelEntry({ id: "claude-opus-5" })).toEqual({ id: "claude-opus-5" });
  });
});

describe("allowedModelsForTier", () => {
  it("returns the correct set for frontier", () => {
    const allowed = allowedModelsForTier("frontier", MODEL_CONFIG)!;
    expect(allowed.size).toBe(3);
    expect(allowed.has("claude-opus-5")).toBe(true);
    expect(allowed.has("@cf/zai-org/glm-5.2")).toBe(true);
  });

  it("returns the correct set for standard", () => {
    const allowed = allowedModelsForTier("standard", MODEL_CONFIG)!;
    expect(allowed.size).toBe(2);
    expect(allowed.has("@cf/zai-org/glm-5.2")).toBe(true);
    expect(allowed.has("@cf/meta/llama-3.3-70b-instruct-fp8-fast")).toBe(true);
    expect(allowed.has("claude-opus-5")).toBe(false);
  });

  it("returns the correct set for restricted", () => {
    const allowed = allowedModelsForTier("restricted", MODEL_CONFIG)!;
    expect(allowed.size).toBe(1);
    expect(allowed.has("@cf/meta/llama-3.3-70b-instruct-fp8-fast")).toBe(true);
  });

  it("returns undefined (all models) when models is omitted", () => {
    const config = { frontier: { groups: ["ai-admins"] } };
    expect(allowedModelsForTier("frontier", config)).toBeUndefined();
  });

  it("returns undefined (all models) when models is null", () => {
    const config = { frontier: { groups: ["ai-admins"], models: null } };
    expect(allowedModelsForTier("frontier", config)).toBeUndefined();
  });

  it("returns empty set when models is an empty array", () => {
    const config = { frontier: { groups: ["ai-admins"], models: [] } };
    expect(allowedModelsForTier("frontier", config)).toEqual(new Set());
  });

  it("returns undefined for unknown tier", () => {
    expect(allowedModelsForTier("nonexistent", MODEL_CONFIG)).toBeUndefined();
  });
});

describe("modelEntriesForTier", () => {
  it("returns normalized entries with labels", () => {
    const config = {
      frontier: {
        groups: ["ai-admins"],
        models: ["claude-opus-5", { id: "gpt-5", label: "GPT 5 Pro" }],
      },
    };
    const entries = modelEntriesForTier("frontier", config)!;
    expect(entries).toEqual([
      { id: "claude-opus-5" },
      { id: "gpt-5", label: "GPT 5 Pro" },
    ]);
  });

  it("returns undefined when models is omitted", () => {
    expect(modelEntriesForTier("frontier", { frontier: { groups: [] } })).toBeUndefined();
  });
});

describe("defaultModelForTier", () => {
  it("returns the configured default for frontier", () => {
    expect(defaultModelForTier("frontier", MODEL_CONFIG)).toBe("@cf/zai-org/glm-5.2");
  });

  it("returns the configured default for standard", () => {
    expect(defaultModelForTier("standard", MODEL_CONFIG)).toBe("@cf/zai-org/glm-5.2");
  });

  it("returns the configured default for restricted", () => {
    expect(defaultModelForTier("restricted", MODEL_CONFIG)).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  });

  it("returns undefined when no default configured", () => {
    expect(defaultModelForTier("frontier", { frontier: { groups: [] } })).toBeUndefined();
  });

  it("returns undefined for unknown tier", () => {
    expect(defaultModelForTier("nonexistent", MODEL_CONFIG)).toBeUndefined();
  });
});

describe("tier default model validation", () => {
  it("each tier's default is a member of its own models allowlist", () => {
    for (const [tier, entry] of Object.entries(MODEL_CONFIG)) {
      if (entry.default && entry.models) {
        const allowed = allowedModelsForTier(tier, MODEL_CONFIG)!;
        expect(allowed.has(entry.default)).toBe(true);
      }
    }
  });

  it("fails when a tier's default is not in its models", () => {
    const badConfig = {
      frontier: { groups: ["ai-admins"], default: "claude-opus-5", models: ["gpt-5"] },
    };
    const allowed = allowedModelsForTier("frontier", badConfig)!;
    expect(allowed.has("claude-opus-5")).toBe(false);
  });
});
