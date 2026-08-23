import { describe, expect, it } from "vitest";
import { deriveTier, flattenGroups, parseTierConfig } from "../src/tiers.js";
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
