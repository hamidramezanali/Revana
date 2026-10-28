# Architecture decisions

| Area | Decision |
|---|---|
| Repo | Single repo: `frontend/`, `backend/`, `contracts/` |
| Backend | Python, FastAPI, versioned under `/v1` |
| Hosting | Vercel, one project per folder |
| Auth | Auth0 with Google and Apple; bearer access tokens validated by the backend |
| Database | Managed pooled Postgres in an EU region (not yet added) |
| LLM | OpenAI, called only from the backend behind a provider interface (not yet added) |
| Clients | Web now; Expo/React Native later, so the API stays bearer-token and client-agnostic |
| Data | All answers and chat are kept; stored as new versions, never overwritten |

## Conventions

- **Contract first.** `contracts/openapi.json` is generated from the backend and committed. Clients generate
  their types from it.
- **Errors.** Every non-2xx response is `{"error": {"code": "...", "message": "..."}}`. Messages never echo
  user-submitted values.
- **Sensitive data.** Answers and chats can be health-adjacent. Do not log their contents.

## Roadmap

1. Repo restructure and backend scaffold (done)
2. Database and migrations
3. Auth0 integration and user provisioning
4. Assessment persistence
5. OpenAI question service
6. Chat
7. Plan generation
8. Frontend integration
9. Privacy and operations (export, deletion, rate limits, retention)
