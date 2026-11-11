import { useEffect, useState } from "react"

export type Screen = "welcome" | "timeline" | "goals" | "details" | "safety" | "analysis" | "dashboard"

const screens: Screen[] = [
  "welcome",
  "timeline",
  "goals",
  "details",
  "safety",
  "analysis",
  "dashboard",
]

export const dashboardTabs = ["Today", "My plan", "Coach", "Profile"] as const

export type DashboardTab = typeof dashboardTabs[number]

const tabPaths: Record<DashboardTab, string> = {
  Today: "today",
  "My plan": "plan",
  Coach: "coach",
  Profile: "profile",
}

function currentScreen(): Screen {
  const name = window.location.hash.replace(/^#\//, "").split("/")[0]

  if (name === "timeline") return "goals"

  if (name === "analysis") return "dashboard"

  return screens.includes(name as Screen) ? name as Screen : "welcome"
}

export function navigate(screen: Screen, replace = false) {
  const hash = `#/${screen}${screen === "dashboard" ? "/today" : ""}`

  if (replace) {
    window.history.replaceState(null, "", hash)

    window.dispatchEvent(new HashChangeEvent("hashchange"))
  } else if (window.location.hash !== hash) window.location.hash = hash
}

export function useScreenNavigation(): [Screen, (screen: Screen) => void] {
  const [screen, setScreen] = useState(currentScreen)

  useEffect(() => {
    const changed = () => setScreen(currentScreen())

    window.addEventListener("hashchange", changed)

    return () => window.removeEventListener("hashchange", changed)
  }, [])

  return [screen, navigate]
}

export function useDashboardNavigation(): [DashboardTab, (
  tab: DashboardTab,
) => void] {
  const read = (): DashboardTab =>
    window.location.hash === "#/dashboard/insights"
      ? "Profile"
      : (dashboardTabs.find(
          (tab) => window.location.hash === `#/dashboard/${tabPaths[tab]}`,
        ) ?? "Today")

  const [tab, setTab] = useState<DashboardTab>(read)

  useEffect(() => {
    const changed = () => setTab(read())

    window.addEventListener("hashchange", changed)

    return () => window.removeEventListener("hashchange", changed)
  }, [])

  return [
    tab,
    (tab) => {
      window.location.hash = `/dashboard/${tabPaths[tab]}`
    },
  ]
}
