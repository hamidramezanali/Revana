import { useEffect, useState } from "react";
import type { ApiJourney as Journey, ApiWorkRequest } from "./api.generated";
export type Topic = NonNullable<ApiWorkRequest["research_topic"]>;
export type City = ApiWorkRequest["research_city"];
const topics: Array<{ id: Topic; domain: string; label: string }> = [
  { id: "nutrition", domain: "body", label: "Meal preparation & nutrition" },
  {
    id: "body_composition",
    domain: "body",
    label: "Body-composition approaches",
  },
  { id: "skin_options", domain: "skin", label: "Skin-care alternatives" },
  { id: "laser_skin", domain: "skin", label: "Laser & light treatments" },
  { id: "pigmentation", domain: "skin", label: "Pigmentation approaches" },
  { id: "hair_options", domain: "hair", label: "Hair-loss approaches" },
  { id: "scalp_care", domain: "hair", label: "Scalp care" },
  { id: "hair_removal", domain: "skin", label: "Hair removal" },
];
const cities: City[] = [
  "",
  "Stockholm",
  "Göteborg",
  "Malmö",
  "Uppsala",
  "Västerås",
  "Örebro",
  "Linköping",
  "Helsingborg",
  "Jönköping",
  "Lund",
  "Umeå",
  "Luleå",
];
export function MethodDiscovery({
  journey,
  busy,
  onSearch,
  onDiscuss,
}: {
  journey: Journey;
  busy: boolean;
  onSearch: (topic: Topic, city: City, services: boolean) => void;
  onDiscuss: (message: string) => void;
}) {
  const available = topics.filter(
    (t) =>
      journey.context.goals.includes(t.domain as "skin" | "hair" | "body") ||
      (t.id === "hair_removal" && journey.context.goals.includes("hair")),
  );
  const [topic, setTopic] = useState<Topic>(available[0]?.id || "skin_options");
  const [city, setCity] = useState<City>("");
  const [services, setServices] = useState(true);
  useEffect(() => {
    if (!available.some((t) => t.id === topic) && available[0])
      setTopic(available[0].id);
  }, [journey.context.goals.join("/")]);
  const reports = journey.workspace?.method_reports || [];
  const report = [...reports]
    .reverse()
    .find(
      (r) =>
        r.topic === topic &&
        r.city === city &&
        r.services_searched === services,
    );
  if (!available.length) return null;
  return (
    <section className="method-discovery">
      <header>
        <p className="eyebrow">BEYOND YOUR CURRENT ROUTINE</p>
        <h2>Explore other approaches</h2>
        <p>
          Compare evidence, practical options and professional approaches. A
          listing does not establish suitability.
        </p>
      </header>
      <div className="discovery-controls">
        <label>
          Topic
          <select
            value={topic}
            disabled={busy}
            onChange={(e) => setTopic(e.target.value as Topic)}
          >
            {available.map((t) => (
              <option value={t.id} key={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Service location
          <select
            value={city}
            disabled={busy || !services}
            onChange={(e) => setCity(e.target.value as City)}
          >
            {cities.map((c) => (
              <option key={c} value={c}>
                {c || "All Sweden"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="discovery-consent">
        <input
          type="checkbox"
          checked={services}
          disabled={busy}
          onChange={(e) => setServices(e.target.checked)}
        />
        Include public Bokadirekt listings
      </label>
      <p className="discovery-privacy">
        Web searches use a generic topic and your selected city. Your answers,
        photos and measurements are not included in search queries.
      </p>
      <button
        className="accent-button"
        disabled={busy}
        onClick={() => onSearch(topic, city, services)}
      >
        {busy
          ? "Agent working…"
          : report
            ? "Search again"
            : "Research approaches"}
      </button>
      {report && (
        <div className="method-report">
          <div className="method-report-heading">
            <span>
              {report.status === "ready"
                ? "Evidence & options"
                : report.status === "limited"
                  ? "Partial results"
                  : "Research unavailable"}
            </span>
            <small>{new Date(report.created_at).toLocaleDateString()}</small>
          </div>
          <p>{report.summary}</p>
          {report.alternatives.map((option, i) => (
            <details className="method-option" key={i}>
              <summary>
                <strong>{option.title}</strong>
                <span>
                  {option.suitability === "assessment_required"
                    ? "Assessment needed"
                    : option.suitability === "not_recommended"
                      ? "Not recommended"
                      : "Consider discussing"}
                </span>
              </summary>
              <p>{option.rationale}</p>
              <h3>Evidence & limits</h3>
              <p>{option.evidence_summary}</p>
              {option.risks.length > 0 && (
                <>
                  <h3>Risks & considerations</h3>
                  <ul>
                    {option.risks.map((risk, k) => (
                      <li key={k}>{risk}</li>
                    ))}
                  </ul>
                </>
              )}
              <p>{option.practical_next_step}</p>
              <div className="method-source-links">
                {option.evidence_ids.map((id) => {
                  const source = report.evidence.find((s) => s.id === id);
                  return source ? (
                    <a
                      key={id}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                    >
                      {source.title} ↗
                    </a>
                  ) : null;
                })}
              </div>
              <button
                className="subtle-button"
                disabled={busy}
                onClick={() =>
                  onDiscuss(
                    `I would like to discuss ${option.title} from research report ${report.id}. Explain the fit, evidence limits and what assessment is needed before proposing changes to my plan.`,
                  )
                }
              >
                Discuss with my agent →
              </button>
            </details>
          ))}
          {services && (
            <section className="method-listings">
              <h3>Public Bokadirekt listings</h3>
              <p>
                Indexed pages only. Check qualifications, suitability, prices
                and availability directly.
              </p>
              {report.listings.length ? (
                report.listings.map((source) => (
                  <a
                    key={source.id}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                  >
                    <strong>{source.title}</strong>
                    <small>
                      Retrieved{" "}
                      {new Date(source.retrieved_at).toLocaleDateString()} ·
                      Open listing ↗
                    </small>
                  </a>
                ))
              ) : (
                <p>
                  No individual provider listing was verified in this search.
                </p>
              )}
              <a
                className="method-browse"
                href={report.browse_url}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                Browse the related Bokadirekt category ↗
              </a>
            </section>
          )}
          {report.limitations.length > 0 && (
            <details className="method-limitations">
              <summary>Research limitations</summary>
              <ul>
                {report.limitations.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </details>
          )}
          <p className="discovery-privacy">
            Research does not change your accepted plan or book a service.
          </p>
        </div>
      )}
    </section>
  );
}
