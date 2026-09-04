# Fork Notes

Private customization fork of cloudflare/cloudflare-os.

Never open PRs to upstream. Pull updates via git rebase of acme-main onto the desired upstream commit.

## ACME customizations (re-ported on 2026-09-04 against upstream 8727352)

- **Sprint 3 — Tier metadata**: `GatewayMetadata` in `ai-models.ts` carries `user`, `tier`, composite `source`, and `automated` (max 5 AI Gateway metadata entries). Tier is derived from Access groups via `tiers.ts` and threaded through `overseer.ts` (`startAgent`/`#runAgentTurn`/`generateThreadTitle`).
- **Sprint 5 — Per-tier model allowlist**: `user.ts` filters `listModels()` by tier allowlist, enforces allowlist in `getChatContext()`, and applies tier default model in `getExternalMessageChatContext()`. Config comes from `TIERS_CONFIG` env var (JSON). `tiers.ts` is the single accessor surface.
- **Model catalog**: `claude-fable-5` enabled (upstream omits for ZDR). Additional Workers AI models: `deepseek-v4-flash-0731`, `kimi-k2.6`, `llama-4-scout-17b`, `gemma-4-26b`, `nemotron-3-120b`, `llama-3.3-70b-fast`.
- **CI**: `.github/workflows/ci.yml` runs kernel lint/build/test on `acme-main`.

## Removed hacks

- Workshop `server.ts` `/gatekeeper/*` dispatch (reverted, router handles it).
- `GATEKEEPER_HTTP_MCP_PORTAL` binding (router uses default-export HTTP binding).
