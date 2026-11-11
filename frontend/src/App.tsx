import { CoachConversation, type CoachAnswer } from "./CoachConversation"

import { CareProfile } from "./CareProfile"

import { BodyEditor } from "./CareWorkspace"

import { useEffect, useState } from "react"

import { Brand, Button, Icon, SafetyStrip, type IconName } from "./ui"

import {
  AgentDashboard,
  AgentError,
  agentRequest,
  forgetToken,
  savedToken,
  startJourney,
  type Journey,
} from "./Agent"

import { AppDialog } from "./ProfileSettings"

import { navigate, useScreenNavigation, type Screen } from "./navigation"

type Goal = "skin" | "hair" | "body" | "energy" | "other"

function scrollToTop() {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches

  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" })
}

const goalData: { id: Goal; title: string; icon: IconName }[] = [
  { id: "skin", title: "Face & skin", icon: "skin" },

  { id: "hair", title: "Hair", icon: "hair" },

  { id: "body", title: "Weight & body habits", icon: "heart" },
]

type Profile = {
  deadlineType: "event" | "journey"

  targetDate: string

  goals: Goal[]

  ownWords: string

  sensitivities: string[]

  limitations: string

  budget: string

  effort: string
}

const initialProfile: Profile = {
  deadlineType: "journey",

  targetDate: "",

  goals: [],

  ownWords: "",

  sensitivities: [],

  limitations: "",

  budget: "Not specified",

  effort: "Practical alternatives tailored to my request",
}

const order: Screen[] = ["welcome", "goals", "details", "safety", "dashboard"]

function OnboardingShell({
  children,
  screen,
  setScreen,
}: {
  children: React.ReactNode
  screen: Screen
  setScreen: (screen: Screen) => void
}) {
  const index = order.indexOf(screen)

  return (
    <div className="onboarding">
      <header className="onboarding-header">
        <Brand />
        {screen !== "welcome" && screen !== "analysis" && (
          <>
            <div className="stepper">
              {["Focus", "Understand", "Review"].map((item, i) => (
                <span
                  className={
                    i <= (screen === "goals" ? 0 : screen === "details" ? 1 : 2)
                      ? "active"
                      : ""
                  }
                  key={item}
                >
                  <i />
                  {item}
                </span>
              ))}
            </div>
            <span className="save-exit">Saved after each agent answer</span>
          </>
        )}
      </header>
      <div className="onboarding-body">{children}</div>
      {screen !== "welcome" && <SafetyStrip />}
      {screen !== "welcome" &&
        screen !== "analysis" &&
        screen !== "details" &&
        screen !== "safety" && (
          <button
            className="back-link"
            onClick={() => setScreen(order[Math.max(0, index - 1)])}
            type="button"
          >
            ← Back
          </button>
        )}
    </div>
  )
}

function Welcome({
  onStart,
  returning = false,
}: {
  onStart: () => void
  returning?: boolean
}) {
  return (
    <div className="welcome">
      <div className="welcome-copy">
        <h1>
          Care that fits
          <br />
          <em>your life.</em>
        </h1>
        <Button className="primary large" onClick={onStart}>
          {returning ? "Return to my plan" : "Begin your journey"}{" "}
          <Icon name="arrow" />
        </Button>
      </div>
      <div className="welcome-visual">
        <img
          alt="Natural portrait representing personal wellbeing"
          src="https://images.unsplash.com/photo-1632765854612-9b02b6ec2b15?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1080"
        />
      </div>
    </div>
  )
}

function Goals({
  profile,
  setProfile,
  next,
}: {
  profile: Profile
  setProfile: (p: Profile) => void
  next: () => void
}) {
  const toggle = (id: Goal) =>
    setProfile({
      ...profile,
      goals: profile.goals.includes(id)
        ? profile.goals.filter((g) => g !== id)
        : [...profile.goals, id],
    })

  return (
    <div className="question-page wide-question">
      <span className="eyebrow">YOUR FOCUS · 1 OF 3</span>
      <h2>What would you like to improve?</h2>
      <p>Choose one or several areas.</p>
      <div className="goal-grid">
        {goalData.map((goal) => (
          <button
            aria-pressed={profile.goals.includes(goal.id)}
            className={profile.goals.includes(goal.id) ? "selected" : ""}
            key={goal.id}
            onClick={() => toggle(goal.id)}
            type="button"
          >
            <span className="goal-icon">
              <Icon name={goal.icon} />
            </span>
            <strong>{goal.title}</strong>
            <i>
              {profile.goals.includes(goal.id) && (
                <Icon name="check" size={15} />
              )}
            </i>
          </button>
        ))}
      </div>
      <label className="text-field">
        <span>
          Tell us in your own words <small>OPTIONAL</small>
        </span>
        <textarea
          maxLength={2000}
          onChange={(e) => setProfile({ ...profile, ownWords: e.target.value })}
          placeholder="For example: My face looks tired even when I sleep, and my hair feels dry after washing…"
          value={profile.ownWords}
        />
      </label>
      <label className="text-field">
        <span>
          Working toward a date? <small>OPTIONAL</small>
        </span>
        <input
          type="date"
          min={new Date().toLocaleDateString("en-CA")}
          value={profile.targetDate}
          onChange={(event) =>
            setProfile({
              ...profile,
              targetDate: event.target.value,
              deadlineType: event.target.value ? "event" : "journey",
            })
          }
        />
      </label>
      <Button
        className="primary continue"
        disabled={!profile.goals.length}
        onClick={next}
      >
        Continue <Icon name="arrow" />
      </Button>
    </div>
  )
}

function Safety({
  profile,
  setProfile,
  next,
  journey,
  onBack,
  onProfileEdit,
  onBodyEdit,
}: {
  profile: Profile
  setProfile: (p: Profile) => void
  next: () => void
  journey: Journey
  onBack: () => void
  onProfileEdit: (
    edit: Omit<import("./api.generated").ApiProfileEdit, "revision">,
  ) => void
  onBodyEdit: (body: import("./api.generated").ApiBodyContext) => void
}) {
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => setConfirmed(false), [journey.profile_revision])

  return (
    <div className="question-page wide-question">
      <span className="eyebrow">REVIEW · 3 OF 3</span>
      <h2>Does this sound like you?</h2>
      <p>
        {journey.context.description ||
          "Your selected goals are the starting point."}
      </p>
      <p>
        <strong>Focus: </strong>
        {journey.context.goals
          .map((goal) => (goal === "body" ? "Weight & body habits" : goal))
          .join(", ")}
        {journey.context.target_date
          ? ` · working toward ${journey.context.target_date}`
          : ""}
      </p>
      <CareProfile
        expanded
        journey={journey}
        busy={false}
        onEdit={onProfileEdit}
      />
      <BodyEditor
        key={journey.profile_revision}
        journey={journey}
        busy={false}
        onSave={onBodyEdit}
      />
      <section className="workspace-panel">
        <h3>Anything else to account for?</h3>
        <label>
          Allergies, limitations or preferences (optional)
          <textarea
            rows={3}
            maxLength={800}
            value={profile.limitations}
            onChange={(event) =>
              setProfile({ ...profile, limitations: event.target.value })
            }
            placeholder="Only information relevant to the plan…"
          />
        </label>
        <label>
          Plan style
          <select
            value={profile.effort}
            onChange={(event) =>
              setProfile({ ...profile, effort: event.target.value })
            }
          >
            <option>Three coordinated habits</option>
            <option>A balanced weekly routine</option>
          </select>
        </label>
      </section>
      <label className="agent-consent">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        I’ve reviewed this starting point. Keep relevant profile notes and clear
        temporary answers after my plan is created. Unknowns and hypotheses stay
        separate.
      </label>
      <div className="agent-buttons">
        <Button className="primary" disabled={!confirmed} onClick={next}>
          Create my plan
        </Button>
        <Button className="secondary" onClick={onBack}>
          Back to questions
        </Button>
      </div>
    </div>
  )
}

function App() {
  const [screen, setScreen] = useScreenNavigation()

  const [profile, setProfile] = useState(initialProfile)

  const [journey, setJourney] = useState<Journey | null>(null)

  const [busy, setBusy] = useState(false)

  const [error, setError] = useState("")

  const [coachNote, setCoachNote] = useState("")

  const [consent, setConsent] = useState(false)

  const [configured, setConfigured] = useState<boolean | null>(null)

  const [restoring, setRestoring] = useState(true)

  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const run = async (task: () => Promise<void>) => {
    if (busy) return

    setBusy(true)
    setError("")

    try {
      await task()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    scrollToTop()
  }, [screen])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      let connectionReady = false

      try {
        const status = await agentRequest<{ configured: boolean }>("status")

        connectionReady = status.configured

        if (!cancelled) setConfigured(status.configured)

        if (savedToken()) {
          const saved = await agentRequest<Journey>("session")

          if (cancelled) return

          setJourney(saved)

          setProfile({
            ...initialProfile,
            goals: saved.context.goals,
            ownWords: saved.context.description,

            targetDate: saved.context.target_date,
            deadlineType: saved.context.target_date ? "event" : "journey",

            ...(saved.preferences ?? {}),
          })

          const route = window.location.hash

          const canResume =
            saved.plans.length &&
            [
              "#/welcome",
              "#/analysis",
              "#/dashboard/today",
              "#/dashboard/plan",
              "#/dashboard/coach",
              "#/dashboard/profile",
              "#/dashboard/insights",
            ].includes(route)

          if (!canResume)
            navigate(saved.plans.length ? "dashboard" : "details", true)
        }
      } catch (e) {
        if (!cancelled) {
          setConfigured(connectionReady)
          setError(
            e instanceof Error ? e.message : "Could not restore your journey.",
          )
        }
      } finally {
        if (!cancelled) setRestoring(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (restoring) return

    if (
      journey?.plans.length &&
      !["welcome", "analysis", "dashboard"].includes(screen)
    )
      navigate("dashboard", true)
    else if (
      journey &&
      !journey.plans.length &&
      ["timeline", "goals"].includes(screen)
    )
      navigate("details", true)
    else if (
      !journey?.plans.length &&
      ["analysis", "dashboard"].includes(screen)
    )
      navigate(journey ? "details" : "welcome", true)
  }, [screen, journey, restoring])

  const buildPlan = () =>
    void run(async () => {
      if (!journey) return

      const saved = await agentRequest<Journey>("plan", {
        revision: journey.revision,

        preferences: {
          sensitivities: profile.sensitivities,
          limitations: profile.limitations,
          budget: profile.budget,
          effort: profile.effort,
        },
        confirm_profile: true,
      })

      setJourney(saved)
      setScreen("dashboard")
    })

  const sendCoach = (message: string, answer?: CoachAnswer) =>
    void run(async () => {
      if (!journey) return

      const usePhotos = !!answer?.photos?.length

      setJourney(
        await agentRequest<Journey>(
          usePhotos ? "answers" : "coach",
          usePhotos
            ? { revision: journey.revision, ...answer, answer: message }
            : {
                revision: journey.revision,
                message,
                ...(answer
                  ? {
                      question_id: answer.question_id,
                      selected_option_ids: answer.selected_option_ids,
                      skipped: answer.skipped,
                    }
                  : {}),
              },
        ),
      )

      setCoachNote("")
    })

  const deleteJourney = () =>
    void run(async () => {
      await agentRequest("session", undefined, "DELETE")

      forgetToken()
      setJourney(null)
      setProfile(initialProfile)
      setConsent(false)

      setDeleteConfirm(false)
      setError("")
      navigate("goals", true)
    })

  if (restoring)
    return (
      <main className="question-page">
        <p role="status">Restoring your journey…</p>
      </main>
    )

  return (
    <>
      {error && (
        <div className="agent-banner">
          <AgentError error={error} />
          <Button
            className="secondary"
            disabled={busy}
            onClick={() => window.location.reload()}
          >
            Reload saved journey
          </Button>
          {!journey && savedToken() && (
            <>
              <p className="agent-small">
                If this backend no longer has your journey, you can forget this
                browser link and start again. This does not delete data from
                another backend or a backup.
              </p>
              <Button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  forgetToken()
                  setError("")
                  setScreen("welcome")
                }}
              >
                Forget browser link and start again
              </Button>
            </>
          )}
        </div>
      )}
      {deleteConfirm && (
        <AppDialog
          title="Delete profile and start over?"
          busy={busy}
          onClose={() => setDeleteConfirm(false)}
        >
          <p>
            This permanently deletes your current answers, photo notes, plans,
            kept actions and progress from this backend. You’ll start again from
            the first questions.
          </p>
          <p>
            Export first if you want a copy. Existing exports, backups and data
            already sent to OpenAI are separate.
          </p>
          <div className="agent-buttons">
            <Button
              className="secondary"
              disabled={busy}
              onClick={() => setDeleteConfirm(false)}
            >
              Keep my profile
            </Button>
            <Button className="danger" disabled={busy} onClick={deleteJourney}>
              {busy ? "Deleting…" : "Delete & start over"}
            </Button>
          </div>
          {error && <AgentError error={error} />}
        </AppDialog>
      )}
      {screen === "dashboard" && journey && journey.plans.length > 0 ? (
        <AgentDashboard
          journey={journey}
          update={setJourney}
          busy={busy}
          run={(task) => void run(task)}
          onDelete={() => setDeleteConfirm(true)}
          onBack={() => setScreen("welcome")}
        />
      ) : (
        <OnboardingShell screen={screen} setScreen={setScreen}>
          {screen === "welcome" && (
            <>
              <Welcome
                returning={!!journey?.plans.length}
                onStart={() =>
                  setScreen(journey?.plans.length ? "dashboard" : "goals")
                }
              />
              {configured === false && (
                <p className="agent-banner">
                  The coaching service is not ready. Check the setup message
                  above, then reload to retry.
                </p>
              )}
            </>
          )}
          {screen === "goals" && (
            <Goals
              profile={profile}
              setProfile={setProfile}
              next={() => setScreen("details")}
            />
          )}
          {screen === "details" &&
            (!journey ? (
              <div className="question-page">
                <span className="eyebrow">YOUR BEAUTY AGENT</span>
                <h2>A few questions, shaped around you.</h2>
                <p>
                  Revana asks at most six focused questions across your goals.
                  Skip any question or finish early; missing information stays
                  unknown.
                </p>
                <label className="agent-consent">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />{" "}
                  I am 18 or older and agree to send my selected goals and
                  answers to OpenAI for personalized guidance. My journey is
                  saved by this Revana deployment; an access token is saved in
                  this browser. I can export or delete it.
                </label>
                <Button
                  className="primary"
                  disabled={busy || !consent || configured === false}
                  onClick={() =>
                    void run(async () => {
                      setJourney(
                        await startJourney({
                          goals: profile.goals.length
                            ? profile.goals
                            : ["skin"],
                          description: profile.ownWords.slice(0, 2000),
                          target_date: profile.targetDate,
                        }),
                      )
                    })
                  }
                >
                  {busy
                    ? "Preparing your first question…"
                    : "Start my assessment"}
                </Button>
              </div>
            ) : (
              <div className="question-page wide-question">
                <CoachConversation
                  onEditAnswer={(_index, answer) =>
                    void run(async () =>
                      setJourney(
                        await agentRequest<Journey>("answers", answer),
                      ),
                    )
                  }
                  journey={journey}
                  busy={busy}
                  note={coachNote}
                  onNoteChange={setCoachNote}
                  onSend={sendCoach}
                  onPhotoReview={(event_index, observations, discard) =>
                    void run(async () =>
                      setJourney(
                        await agentRequest<Journey>("photo-notes", {
                          revision: journey.revision,
                          event_index,
                          observations,
                          discard,
                        }),
                      ),
                    )
                  }
                  onFinish={() => setScreen("safety")}
                />
                <CareProfile
                  journey={journey}
                  busy={busy}
                  onEdit={(edit) =>
                    void run(async () =>
                      setJourney(
                        await agentRequest<Journey>("profile", {
                          ...edit,
                          revision: journey.revision,
                        }),
                      ),
                    )
                  }
                />
              </div>
            ))}
          {screen === "safety" && journey && (
            <fieldset className="agent-fieldset" disabled={busy}>
              <Safety
                profile={profile}
                setProfile={setProfile}
                journey={journey}
                onBack={() => setScreen("details")}
                onBodyEdit={(body) =>
                  void run(async () =>
                    setJourney(
                      await agentRequest<Journey>("body-context", {
                        revision: journey.revision,
                        body,
                      }),
                    ),
                  )
                }
                onProfileEdit={(edit) =>
                  void run(async () =>
                    setJourney(
                      await agentRequest<Journey>("profile", {
                        ...edit,
                        revision: journey.revision,
                      }),
                    ),
                  )
                }
                next={buildPlan}
              />
              {busy && (
                <p className="agent-banner" role="status">
                  Building your personal plan…
                </p>
              )}
            </fieldset>
          )}
          {journey && !journey.plans.length && (
            <div className="agent-banner">
              <Button
                className="secondary"
                disabled={busy}
                onClick={() => setDeleteConfirm(true)}
              >
                Delete profile & start over
              </Button>
            </div>
          )}
        </OnboardingShell>
      )}
    </>
  )
}

export default App
