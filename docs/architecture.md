# Architecture decisions

| Area | Current implementation | Hosted direction |
|---|---|---|
| Repo | `frontend/`, `backend/`, `contracts/` | Same |
| Backend | Python/FastAPI, versioned `/v1` API | Same |
| Frontend | React/TypeScript/Vite; existing visual workflow | Web first; mobile later |
| Hosting | Single-user local, loopback only | Two Vercel projects after hosted readiness |
| Access | Random per-journey bearer capability, hashed in database | Auth0 + ownership enforcement |
| Database | Local durable SQLite | Managed pooled EU Postgres + migrations |
| LLM | Server-side structured OpenAI Responses adapter | Reviewed guidance + evaluations |
| Data | Saved answers, accepted plan versions, pending proposal; export/delete | Defined retention + vendor handling |

## Adaptive agent

Direction and goal selection lead to a consent step, then one question per answer,
with a hard cap of six adaptive assessment questions. Fit/safety controls precede
plan generation. The analysis separates reported facts, hypotheses and uncertainties.
The dashboard supports follow-up check-ins with at most three questions and a proposed
plan revision that must be accepted before replacing the current plan.

The backend owns question budgets, active-question IDs, input bounds and revision
checks. LLM generation completes before database writes; failure leaves saved state
unchanged. Atomic compare-and-swap writes reject stale/replayed mutations. Accepted
plans remain versioned. The provider is replaceable in tests; demo responses are not
used as a live fallback.

## Contract and errors

`contracts/openapi.json` is generated from the backend. Serialized frontend response
types in `frontend/src/api.generated.ts` are generated from the same schemas. Regenerate
both after changing models/endpoints; tests verify freshness.

Non-2xx responses use `{"error": {"code": "...", "message": "..."}}`. Validation errors
include field locations only. Never log answers, chats, tokens, keys or upstream bodies.
Agent responses use `Cache-Control: no-store`.

## Deployment boundary

The local agent requires development mode and refuses Vercel startup. Bind the API to
`127.0.0.1`; the agent also checks the request host, local peer and browser origin.
These checks are a local boundary, not hosted account authentication. Never expose
this SQLite/capability implementation as a public multi-user service. Hosted readiness
requires Auth0, per-resource authorization, durable Postgres, rate/spend controls,
privacy/retention operations and deployment validation.

See [the agent roadmap](agent-roadmap.md) for milestones, launch instructions,
data behavior, operating limits and outstanding validation gates.
