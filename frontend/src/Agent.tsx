import { completedToday } from "./progress"

import { useEffect, useRef, useState } from "react"

import { ProfileSettings, AppDialog } from "./ProfileSettings"

import { PhotoReview } from "./PhotoReview"

import { QuestionCard } from "./QuestionCard"

import { PlanActions, actionLists, type CoachAnswer } from "./PlanActions"

import { ActionCard } from "./ActionCard"

import { CareProfile } from "./CareProfile"

import {
  GoalEditor,
  BodyEditor,
  ProgressPanel,
  Milestones,
  ScheduledActions,
  Meals,
  ServiceLinks,
  localDate,
  weekday,
  dayNames,
  type ProgressDraft,
} from "./CareWorkspace"

import type {
  ApiProgressRequest,
  ApiMeal,
  ApiProfileEdit,
} from "./api.generated"

import { dashboardTabs, useDashboardNavigation } from "./navigation"

import { Brand, Button, Icon, SafetyStrip } from "./ui"

import type { ApiJourney, ApiContext, ApiAnswerRequest } from "./api.generated"

export type Goal = ApiContext["goals"][number]

export type Journey = ApiJourney

import {agentRequest} from "./agentClient"
export {agentRequest, savedToken, forgetToken, startJourney} from "./agentClient"

export function AgentError({ error }: { error: string }) {
  return error ? (
    <p className="agent-error" role="alert">
      {error}
    </p>
  ) : null
}

export function AdaptiveQuestions({
  journey,
  update,
  onFinish,
  busy,
  run,
}: {
  journey: Journey
  update: (journey: Journey) => void
  onFinish: () => void

  busy: boolean
  run: (task: () => Promise<void>) => void
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const editingEvent =
    editingIndex === null ? null : journey.events[editingIndex]

  const question = editingEvent
    ? (editingEvent.question_snapshot ?? {
        id: `legacy-${editingIndex}`,
        text: editingEvent.question,

        why: "Update your answer so the next question can adapt.",
        options: [],

        selection_mode: "multiple" as const,
        photo_mode: "none" as const,
        input_kind: "text" as const,
        unit: "" as const,
        number_min: null,
        number_max: null,
        profile_key: null,
      })
    : journey.decision.questions[0]

  const pendingPhoto = journey.events.some(
    (event) => event.photo_notes && !event.photo_notes.confirmed,
  )

  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [question?.id, pendingPhoto])

  const count =
    journey.mode === "assessment"
      ? journey.assessment_count
      : journey.checkin_count

  const cycleStart =
    journey.mode === "checkin"
      ? journey.events.reduce(
          (start, event, index) =>
            event.kind === "checkin" ? index + 1 : start,
          journey.events.length,
        )
      : 0

  const editable = journey.events
    .map((event, index) => ({ event, index }))
    .filter(
      ({ event, index }) => event.kind === "answer" && index >= cycleStart,
    )

  const loadOptions = () =>
    run(async () =>
      update(
        await agentRequest<Journey>("question-options", {
          revision: journey.revision,
        }),
      ),
    )

  const submit = (
    payload: Pick<ApiAnswerRequest, "answer" | "selected_option_ids" | "skipped" | "photos" | "photo_consent">,
  ) =>
    run(async () => {
      const next = await agentRequest<Journey>("answers", {
        revision: journey.revision,
        question_id: question.id,
        ...payload,

        ...(editingIndex === null ? {} : { event_index: editingIndex }),
      })

      update(next)

      setEditingIndex(null)
    })

  return (
    <div className="question-page wide-question adaptive-question-page">
      <span className="eyebrow">
        {journey.mode === "assessment"
          ? "GETTING TO KNOW YOU"
          : "YOUR FOLLOW-UP"}{" "}
        ·{" "}
        {editingEvent
          ? "UPDATE AN ANSWER"
          : question
            ? `QUESTION ${count + 1}`
            : `${count} ANSWERED`}
      </span>
      <h2 ref={headingRef} tabIndex={-1}>
        {pendingPhoto
          ? "Check what I noticed."
          : question
            ? question.text
            : "Your starting point is ready."}
      </h2>
      {pendingPhoto ? (
        <PhotoReview
          key={journey.events.length}
          journey={journey}
          busy={busy}
          onReview={(eventIndex, observations, discard) =>
            run(async () =>
              update(
                await agentRequest<Journey>("photo-notes", {
                  revision: journey.revision,
                  event_index: eventIndex,
                  observations,
                  discard,
                }),
              ),
            )
          }
        />
      ) : question ? (
        <>
          <details className="question-explanation">
            <summary>Why we ask</summary>
            <p>{question.why}</p>
          </details>
          {editingEvent && (
            <>
              <p>
                Changing this answer replaces the later questions in this round,
                so they can adapt to your update.
              </p>
              {!!editingEvent.photo_count && (
                <p>
                  Your earlier photo notes for this answer will be replaced.
                  Attach photos again if you want to use them.
                </p>
              )}
              <Button
                className="secondary"
                disabled={busy}
                onClick={() => setEditingIndex(null)}
              >
                Cancel editing
              </Button>
            </>
          )}
          <QuestionCard
            key={`${question.id}-${editingIndex}`}
            question={question}
            busy={busy}
            onSubmit={submit}
            onLoadOptions={editingEvent ? undefined : loadOptions}
            editing={!!editingEvent}
            initialAnswer={
              editingEvent
                ? {
                    selected_options: editingEvent.selected_options,
                    answer: editingEvent.question_snapshot
                      ? editingEvent.answer
                      : [...editingEvent.selected_options, editingEvent.answer]
                          .filter(Boolean)
                          .join(" — "),
                  }
                : undefined
            }
          />
        </>
      ) : (
        <p className="prompt-status" role="status">
          {journey.decision.summary}
        </p>
      )}
      {!editingEvent && (
        <div className="agent-buttons">
          {!!editable.length && (
            <Button
              className="secondary"
              disabled={busy || pendingPhoto}
              onClick={() =>
                setEditingIndex(editable[editable.length - 1].index)
              }
            >
              ← Previous question
            </Button>
          )}
          <Button
            className={question ? "secondary" : "primary"}
            disabled={busy || pendingPhoto}
            onClick={onFinish}
          >
            {journey.mode === "assessment"
              ? "Continue to fit & safety"
              : "Draft an updated plan"}
          </Button>
        </div>
      )}
      {!!editable.length && (
        <details
          className="question-explanation"
          open={editingEvent ? true : undefined}
        >
          <summary>Review or change earlier answers</summary>
          {editable.map(({ event, index }) => (
            <section key={index}>
              <h3>{event.question}</h3>
              <p>
                {event.skipped
                  ? "Skipped"
                  : [event.selected_options.join(", "), event.answer]
                      .filter(Boolean)
                      .join(" — ") || "Photo answer"}
              </p>
              <Button
                className="secondary"
                disabled={busy || pendingPhoto}
                onClick={() => setEditingIndex(index)}
              >
                Change answer {index - cycleStart + 1}
              </Button>
            </section>
          ))}
        </details>
      )}
      <p className="agent-small">
        Your answers shape the next question. We ask only what helps and stop
        when there’s enough to guide you. You can skip or finish whenever you’re
        ready.
      </p>
    </div>
  )
}

export function AgentDashboard({
  journey,
  update,
  busy,
  run,
  onDelete,
  onBack,
}: {
  journey: Journey
  update: (journey: Journey) => void
  busy: boolean

  run: (task: () => Promise<void>) => void
  onDelete: () => void
  onBack: () => void
}) {
  const [tab, setTab] = useDashboardNavigation()

  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" })
    heading.current?.focus({ preventScroll: true })
  }, [tab])

  const [message, setMessage] = useState("")

  const [settingsOpen, setSettingsOpen] = useState(false)

  const [checking, setChecking] = useState(
    journey.mode === "checkin" && !journey.proposal,
  )

  const [day, setDay] = useState(weekday(localDate(journey.body.timezone)))

  const [removeEntry, setRemoveEntry] = useState<string | null>(null)

  const version = journey.plans.at(-1)!

  const plan = version.plan

  const board = actionLists(journey)

  const rejected = new Set(journey.suggestion_board?.rejected_ids ?? [])

  const activeActions = plan.actions
  const today = localDate(journey.body.timezone)

  const completed = completedToday(journey, activeActions)

  const blocked = (id: string) => {
    if (rejected.has(id)) return "You marked this not for you. Ask the coach to propose a replacement."
    const check = journey.workflow.review?.action_checks.find(
      (item) => item.action_id === id,
    )

    return check && check.status !== "compatible"
      ? check.reason
      : journey.workflow.status !== "ready"
        ? "Your context changed. Review this action with your coach before continuing."
        : undefined
  }

  const exportJourney = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(journey, null, 2)], {
        type: "application/json",
      }),
    )
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "revana-profile-and-plan.json"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const editProfile = (edit: Omit<ApiProfileEdit, "revision">) =>
    run(async () =>
      update(
        await agentRequest<Journey>("profile", {
          ...edit,
          revision: journey.revision,
        }),
      ),
    )

  const record = (value: ProgressDraft) =>
    run(async () =>
      update(
        await agentRequest<Journey>("progress", {
          ...value,
          revision: journey.revision,
        }),
      ),
    )

  const complete = (id: string) =>
    record({
      action_id: id,
      status: completed.has(id) ? "not_attempted" : "followed",
      note: "",
      observed_on: today,
    })

  const draft = () =>
    run(async () => {
      update(
        await agentRequest<Journey>("plan", {
          revision: journey.revision,
          preferences: journey.preferences ?? {
            sensitivities: [],
            limitations: "",
            budget: "Not specified",
            effort: "Three coordinated habits",
          },
        }),
      )
      setChecking(false)
    })

  const startReview = (text: string) =>
    run(async () => {
      const next = await agentRequest<Journey>("checkins", {
        revision: journey.revision,
        message: text,
      })
      update(next)
      setMessage("")
      if (next.decision.ready) {
        update(
          await agentRequest<Journey>("plan", {
            revision: next.revision,
            preferences: next.preferences,
          }),
        )
        setChecking(false)
      } else setChecking(true)
    })

  const explore = (text: string, answer?: CoachAnswer) =>
    run(async () => {
      update(
        await agentRequest<Journey>("suggestions", {
          revision: journey.revision,
          message: text,
          ...answer,
        }),
      )
      setMessage("")
    })

  const swap = (meal: ApiMeal, source: ApiMeal) =>
    run(async () =>
      update(
        await agentRequest<Journey>("meal-swap", {
          revision: journey.revision,
          day: meal.day,
          slot: meal.slot,
          source_day: source.day,
          source_slot: source.slot,
        }),
      ),
    )

  const reviewAt = new Date(version.created_at)
  reviewAt.setDate(reviewAt.getDate() + plan.review_days)

  const due =
    today >=
    new Intl.DateTimeFormat("en-CA", {
      timeZone: journey.body.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(reviewAt)

  const titles = {
    Today: "A little care, every day.",
    "My plan": "Your weekly plan.",
    Coach: "What’s changed?",
    Profile: "Your care profile.",
  }

  return (
    <div className="dashboard-app">
      <header className="app-header">
        <button
          type="button"
          className="app-back"
          disabled={busy}
          onClick={() =>
            checking
              ? setChecking(false)
              : tab !== "Today"
                ? setTab("Today")
                : onBack()
          }
        >
          ← Back
        </button>
        <Brand />
        <button
          type="button"
          className="profile-settings-trigger"
          aria-label="Open profile settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Icon name="user" size={21} />
        </button>
      </header>
      <nav className="app-navigation" aria-label="Main navigation">
        {dashboardTabs.map((item, index) => (
          <button
            key={item}
            type="button"
            aria-current={tab === item ? "page" : undefined}
            className={tab === item ? "active" : ""}
            onClick={() => {
              setChecking(false)
              setTab(item)
            }}
          >
            <Icon
              name={(["home", "calendar", "sparkle", "user"] as const)[index]}
              size={21}
            />
            <span>{item}</span>
          </button>
        ))}
      </nav>
      {settingsOpen && (
        <ProfileSettings
          busy={busy}
          onClose={() => setSettingsOpen(false)}
          onExport={exportJourney}
          onRestart={() => {
            setSettingsOpen(false)
            onDelete()
          }}
        />
      )}
      {removeEntry && (
        <AppDialog
          title="Remove this observation?"
          busy={busy}
          onClose={() => setRemoveEntry(null)}
        >
          <p>
            The coach will recheck your plan after this observation is removed.
          </p>
          <div className="agent-buttons">
            <Button className="secondary" onClick={() => setRemoveEntry(null)}>
              Keep observation
            </Button>
            <Button
              className="danger"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  update(
                    await agentRequest<Journey>(
                      `progress/${removeEntry}`,
                      { revision: journey.revision },
                      "DELETE",
                    ),
                  )
                  setRemoveEntry(null)
                })
              }
            >
              Remove observation
            </Button>
          </div>
        </AppDialog>
      )}
      <main className="dash-main">
        <section className="dash-hero">
          <span className="eyebrow">SKIN · HAIR · WEIGHT & BODY HABITS</span>
          <h1 ref={heading} tabIndex={-1}>
            {titles[tab]}
          </h1>
          {tab !== "Profile" && (
            <span className="review-pill">
              Plan {version.version} · review{" "}
              {reviewAt.toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                timeZone: journey.body.timezone,
              })}
            </span>
          )}
        </section>
        {journey.proposal && (
          <section className="plan-proposal" aria-label="Proposed plan">
            <span className="eyebrow">FOR YOUR APPROVAL</span>
            <h2>Proposed changes</h2>
            <p>{journey.proposal.changes}</p>
            <p>{journey.proposal.summary}</p>
            <CareProfile journey={journey} busy={busy} onEdit={editProfile} />
            <p className="agent-small">
              Accepting confirms this profile and plan. Relevant profile notes
              are kept; temporary conversation turns are removed from active
              storage.
            </p>
            <div className="focus-action-list">
              {journey.proposal.actions.map((action) => (
                <ActionCard key={action.id} action={action} />
              ))}
            </div>
            {journey.proposal.meals.length > 0 && (
              <details>
                <summary>Proposed meal schedule</summary>
                {journey.proposal.meals.map((meal) => (
                  <p key={`${meal.day}-${meal.slot}`}>
                    {dayNames[meal.day]} · {meal.slot}: {meal.title}
                  </p>
                ))}
              </details>
            )}
            <div className="agent-buttons">
              <Button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run(async () =>
                    update(
                      await agentRequest<Journey>("accept", {
                        revision: journey.revision,
                        confirm_profile: true,
                      }),
                    ),
                  )
                }
              >
                Accept changes
              </Button>
              <Button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  run(async () =>
                    update(
                      await agentRequest<Journey>("discard-proposal", {
                        revision: journey.revision,
                      }),
                    ),
                  )
                }
              >
                Keep current plan
              </Button>
            </div>
          </section>
        )}
        {checking ? (
          <AdaptiveQuestions
            journey={journey}
            update={update}
            busy={busy}
            run={run}
            onFinish={draft}
          />
        ) : (
          <>
            {tab === "Today" && (
              <>
                <p className="today-date">
                  {new Date(`${today}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                {(due ||
                  journey.workflow.status !== "ready" ||
                  journey.progress.at(-1)?.status === "worse") && (
                  <section className="review-notice">
                    <strong>Time to check what fits.</strong>
                    <p>
                      {journey.workflow.status !== "ready"
                        ? "Your context changed. Recheck affected actions before continuing."
                        : "Review what you tried and what has changed."}
                    </p>
                    <Button
                      className="secondary"
                      onClick={() => setTab("Coach")}
                    >
                      Review with coach
                    </Button>
                  </section>
                )}
                {plan.priority && (
                  <p className="priority-copy">{plan.priority}</p>
                )}
                <ScheduledActions
                  actions={activeActions}
                  day={weekday(today)}
                  busy={busy}
                  completed={completed}
                  blocked={blocked}
                  onComplete={complete}
                />
                <Meals
                  journey={journey}
                  day={weekday(today)}
                  busy={busy}
                  onSwap={swap}
                  onRecord={record}
                />
                <ProgressPanel
                  journey={journey}
                  busy={busy}
                  onRecord={record}
                  onRemove={setRemoveEntry}
                />
                <Milestones journey={journey} />
              </>
            )}
            {tab === "My plan" && (
              <>
                <p>{plan.summary}</p>
                {plan.priority && (
                  <p>
                    <strong>First priority: </strong>
                    {plan.priority}
                  </p>
                )}
                <div
                  className="week-picker"
                  role="group"
                  aria-label="Choose weekday"
                >
                  {dayNames.map((name, index) => (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={day === index}
                      onClick={() => setDay(index)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <ScheduledActions
                  actions={activeActions}
                  day={day}
                  busy={busy}
                  completed={day === weekday(today) ? completed : new Set()}
                  blocked={blocked}
                />
                <Meals
                  key={version.version}
                  journey={journey}
                  day={day}
                  busy={busy}
                  onSwap={swap}
                />
                {plan.deferred.length > 0 && (
                  <details className="workspace-panel">
                    <summary>What we’re leaving for later</summary>
                    <ul>
                      {plan.deferred.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <details className="workspace-panel">
                  <summary>Ideas & your kept list</summary>
                  <PlanActions
                    journey={journey}
                    busy={busy}
                    note={message}
                    onNoteChange={setMessage}
                    onChoice={(action_id, choice) =>
                      run(async () =>
                        update(
                          await agentRequest<Journey>("suggestion-choice", {
                            revision: journey.revision,
                            action_id,
                            choice,
                          }),
                        ),
                      )
                    }
                    onReshuffle={explore}
                    onComplete={complete}
                    onProfileEdit={editProfile}
                  />
                  <Button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      explore(
                        "Offer a few useful alternatives to my current habits, respecting my profile and constraints.",
                      )
                    }
                  >
                    Get new suggestions
                  </Button>
                  {!!board.kept.length && <Button className="primary" disabled={busy} onClick={()=>{setTab("Coach");startReview("Please propose a coordinated plan using my kept ideas and current constraints. Preserve explicitly kept habits and explain any conflicts.");}}>Review my kept ideas for the plan</Button>}
                </details>
                <details className="workspace-panel">
                  <summary>Fit, safety & accepted history</summary>
                  {plan.safety_notes.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                  {journey.plans.map((item) => (
                    <p key={item.version}>
                      Version {item.version} ·{" "}
                      {new Date(item.created_at).toLocaleDateString()}:{" "}
                      {item.plan.changes}
                    </p>
                  ))}
                </details>
                <ServiceLinks />
              </>
            )}
            {tab === "Coach" && (
              <section className="workspace-panel">
                <h2>Let’s review your plan.</h2>
                <p>
                  Tell me what you tried, what changed or what feels difficult.
                  I’ll ask up to three useful questions and prepare changes for
                  your approval.
                </p>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (message.trim()) startReview(message.trim())
                  }}
                >
                  <label htmlFor="checkin-message">Your update</label>
                  <textarea
                    id="checkin-message"
                    maxLength={2000}
                    rows={4}
                    disabled={busy}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="I tried this some days, but my scalp still itches…"
                  />
                  <Button
                    className="primary"
                    type="submit"
                    disabled={busy || !message.trim()}
                  >
                    {busy ? "Reviewing…" : "Review my plan"}
                  </Button>
                </form>
                <ProgressPanel
                  journey={journey}
                  busy={busy}
                  onRecord={record}
                  onRemove={setRemoveEntry}
                />
              </section>
            )}
            {tab === "Profile" && (
              <>
                <p>
                  Your reports, working ideas and unknowns stay separate.
                  Correct anything that does not fit.
                </p>
                <GoalEditor
                  key={`goals-${journey.profile_revision}`}
                  journey={journey}
                  busy={busy}
                  onSave={(goals, target_date) => run(async () => update(await agentRequest<Journey>("goals", {revision: journey.revision, goals, target_date})))}
                />
                <CareProfile
                  expanded
                  journey={journey}
                  busy={busy}
                  onEdit={editProfile}
                />
                <BodyEditor
                  key={journey.profile_revision}
                  journey={journey}
                  busy={busy}
                  onSave={(body) =>
                    run(async () =>
                      update(
                        await agentRequest<Journey>("body-context", {
                          revision: journey.revision,
                          body,
                        }),
                      ),
                    )
                  }
                />
                <details className="workspace-panel">
                  <summary>What remains uncertain</summary>
                  <ul>
                    {plan.uncertainties.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <h3>Working hypotheses</h3>
                  <ul>
                    {plan.hypotheses.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </details>
                <div className="agent-buttons">
                  <Button className="secondary" onClick={exportJourney}>
                    Export my data
                  </Button>
                  <Button
                    className="secondary"
                    disabled={busy}
                    onClick={onDelete}
                  >
                    Delete profile & start over
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </main>
      <SafetyStrip />
    </div>
  )
}
