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

### Kernel rollback

To roll back the kernel to the previous known-good state:

```bash
cd cloudflare-os
git checkout acme-main
# The previous kernel commit was 75873e5 (sprint-6-upstream-mcp-upgrade-kernel)
# The clean re-port is f172864 (sprint-6-clean-report)
git reset --hard 75873e5
git push origin acme-main --force
```

### Starter rollback

To roll back the starter submodule pointer:

```bash
cd acme-os
git checkout main
# The previous starter commit was 6467e70 (pointing to kernel 75873e5)
git reset --hard 6467e70
git push origin main --force
```

### Production Worker rollback

Use `wrangler deployments rollback` for each affected Worker, or pin to the version IDs captured before the upgrade:

| Worker | Pre-upgrade version ID |
|--------|----------------------|
| router | (captured via `wrangler deployments list`) |
| workshop-backend | (captured via `wrangler deployments list`) |
| gatekeeper-* | (captured via `wrangler deployments list`) |

## Removed hacks

- Workshop `server.ts` `/gatekeeper/*` dispatch (reverted, router handles it).
- `GATEKEEPER_HTTP_MCP_PORTAL` binding (router uses default-export HTTP binding).
