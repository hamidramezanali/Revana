import type { ApiJourney as Journey } from "./api.generated";

const tokenKey = "revana.journey.token";

export const savedToken = () => localStorage.getItem(tokenKey);

export const forgetToken = () => localStorage.removeItem(tokenKey);

export async function agentRequest<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const token = savedToken();

  const response = await fetch(`/v1/agent/${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),

    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },

    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);

    const fallback =
      response.status === 413
        ? "These photos are too large. Try fewer or smaller photos."
        : response.status === 401 || response.status === 403
          ? "This deployment requires access. Sign in to the deployment and retry."
          : response.status === 404
            ? "The coaching service route is unavailable. Check this deployment’s backend configuration."
            : "The coaching service could not start or respond. Check the backend deployment logs; your saved journey is unchanged.";

    throw new Error(
      typeof data?.error?.message === "string" ? data.error.message : fallback,
    );
  }

  return response.status === 204 ? (undefined as T) : response.json();
}

export async function startJourney(
  context: Journey["context"],
): Promise<Journey> {
  const result = await agentRequest<{ token: string; journey: Journey }>(
    "sessions",
    { context, consent: true },
  );

  localStorage.setItem(tokenKey, result.token);

  return result.journey;
}
