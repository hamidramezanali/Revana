import type { ApiJourney, ApiAction } from "./api.generated"

export function profileDate(timezone: string, date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function completedToday(journey: ApiJourney, actions: ApiAction[]) {
  const version = journey.plans.at(-1)!

  const date = profileDate(journey.body.timezone)

  const result = new Set<string>()

  const sameAction = (id: string, previousVersion: number) => {
    const current = actions.find((action) => action.id === id)

    const original = journey.plans
      .find((plan) => plan.version === previousVersion)
      ?.plan.actions.find((action) => action.id === id)

    return (
      !!current &&
      (previousVersion === version.version ||
        (!!original && JSON.stringify(original) === JSON.stringify(current)))
    )
  }

  for (const entry of journey.completions)
    if (
      sameAction(entry.action_id, entry.plan_version) &&
      profileDate(journey.body.timezone, new Date(entry.completed_at)) === date
    )
      result.add(entry.action_id)

  for (const entry of journey.progress)
    if (
      entry.action_id &&
      entry.observed_on === date &&
      sameAction(entry.action_id, entry.plan_version)
    ) {
      if (entry.status === "followed") result.add(entry.action_id)
      else if (
        entry.status === "not_attempted" ||
        entry.status === "inconsistent"
      )
        result.delete(entry.action_id)
    }

  return result
}
