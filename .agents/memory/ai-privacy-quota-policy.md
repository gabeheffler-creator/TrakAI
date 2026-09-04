---
name: AI privacy and quota policy
description: Durable decisions for auditing, daily caps, and burst protection across AI-assisted features.
---

All application AI features must use the shared server gateway. Usage auditing stores caller identity, feature, provider/model, outcome, token counts, duration, and timestamp, but never prompts, client details, images, image URLs, or raw model output.

Daily AI caps are global per authenticated actor across features and count provider attempts, including provider failures and invalid responses. Malformed requests rejected before a provider call do not consume the daily cap. Burst limits are independent from the daily cap.

**Why:** Counting attempts protects cost even when a provider is degraded, while metadata-only records preserve operational visibility without creating a second store of sensitive coaching or nutrition content. A global actor cap is simpler and prevents one feature from bypassing another feature's budget.

**How to apply:** Route every future AI feature through the gateway, add a distinct feature identifier and configurable model default, derive the caller from authenticated server state, and provide a non-AI fallback in the UI. Treat the in-memory burst limiter as per-process; use shared edge or datastore-backed burst limiting before horizontally scaling the API.