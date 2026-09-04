# Fork Notes

Private customization fork of cloudflare/cloudflare-os.

Never open PRs to upstream. Pull updates via git rebase of `acme-main` onto the desired upstream commit.

## ACME customizations (clean re-port on 2026-09-04 against upstream 8727352)

This branch (`sprint-6-clean-report`) is a clean re-port of the ACME customizations onto upstream `8727352`, replacing the previous branch (`sprint-6-upstream-mcp-upgrade-kernel` / `75873e5`) which carried significant formatting churn.

### Sprint 3 — Tier metadata

`GatewayMetadata` in `ai-models.ts` carries `user`, `tier`, composite `source`, and `automated` (max 5 AI Gateway metadata entries). Tier is derived from Access groups via `tiers.ts` and threaded through `overseer.ts` (`startAgent`/`#runAgentTurn`/`generateThreadTitle`).

### Sprint 5 — Per-tier model allowlist

`user.ts` filters `listModels()` by tier allowlist, enforces allowlist in `getChatContext()`, and applies tier default model in `getExternalMessageChatContext()`. Config comes from `TIERS_CONFIG` env var (JSON). `tiers.ts` is the single accessor surface.

### CI

`.github/workflows/ci.yml` runs kernel lint/build/test on `acme-main`.

## Rollback plan

Rollback uses immutable tags — never force-push or reset shared branches. Instead, check out the pre-upgrade tag on a dedicated rollback branch and redeploy from there.

### Immutable rollback points

| Repo                   | Tag                               | SHA                                        |
| ---------------------- | --------------------------------- | ------------------------------------------ |
| cloudflare-os (kernel) | `pre-upstream-mcp-upgrade-kernel` | `1bb03f02bc0dd7003e3b67776783210d5626611d` |
| acme-os (starter)      | `pre-upstream-mcp-upgrade`        | `0fca6919624ccbead1f37048b215acca2f68b2d2` |

### Kernel rollback

```bash
# Create a dedicated rollback branch from the immutable tag — do NOT reset acme-main.
cd cloudflare-os
git checkout -b rollback/pre-upstream-mcp-upgrade-kernel pre-upstream-mcp-upgrade-kernel
# Redeploy from this branch (see starter rollback below for the submodule pointer).
```

### Starter rollback

```bash
# Create a dedicated rollback branch from the immutable tag — do NOT reset main.
cd acme-os
git checkout -b rollback/pre-upstream-mcp-upgrade pre-upstream-mcp-upgrade
# The submodule pointer in this tag points to kernel 1bb03f02.
# Redeploy: pnpm deploy
```

### Production Worker rollback (fast, no code change)

Use `wrangler deployments rollback` for each affected Worker to instantly revert to the previous version:

```bash
CLOUDFLARE_ACCOUNT_ID=904dd3d810f6f1dd3801d8b940bd747a \
  npx wrangler deployments rollback --name acme-os-router
CLOUDFLARE_ACCOUNT_ID=904dd3d810f6f1dd3801d8b940bd747a \
  npx wrangler deployments rollback --name acme-os-workshop
CLOUDFLARE_ACCOUNT_ID=904dd3d810f6f1dd3801d8b940bd747a \
  npx wrangler deployments rollback --name acme-os-context
CLOUDFLARE_ACCOUNT_ID=904dd3d810f6f1dd3801d8b940bd747a \
  npx wrangler deployments rollback --name acme-os-scheduler
CLOUDFLARE_ACCOUNT_ID=904dd3d810f6f1dd3801d8b940bd747a \
  npx wrangler deployments rollback --name acme-os-custom-gk
CLOUDFLARE_ACCOUNT_ID=904dd3d810f6f1dd3801d8b940bd747a \
  npx wrangler deployments rollback --name acme-os-gk-mcp-portal
CLOUDFLARE_ACCOUNT_ID=904dd3d810f6f1dd3801d8b940bd747a \
  npx wrangler deployments rollback --name acme-os-error-reporter
```

Pre-upgrade version IDs (for manual pinning if needed):

| Worker                 | Pre-upgrade version ID                 |
| ---------------------- | -------------------------------------- |
| acme-os-router         | `370a06e5-8227-4daa-b3b6-9f50447d33a2` |
| acme-os-workshop       | `6a24f442-f985-4438-9932-c40ae80f1af8` |
| acme-os-context        | `aeb522c2-eb2c-453f-a8cc-e0e040f28bb2` |
| acme-os-scheduler      | (did not exist)                        |
| acme-os-custom-gk      | `96d6d364-7ff8-4630-a310-f931023d2405` |
| acme-os-gk-mcp-portal  | `d58db997-6af7-494e-a6aa-263867c7cca3` |
| acme-os-error-reporter | `89a3e154-41b1-4ceb-9d22-8171591a436c` |

## Removed hacks

- Workshop `server.ts` `/gatekeeper/*` dispatch (reverted, router handles it).
- `GATEKEEPER_HTTP_MCP_PORTAL` binding (router uses default-export HTTP binding).
