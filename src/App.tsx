import { useEffect, useMemo, useRef, useState } from "react";
import {
  Compass,
  MapPin,
  Heart,
  Route,
  Search,
  SlidersHorizontal,
  Plus,
  X,
  ArrowRight,
  Navigation,
  Download,
  Upload,
  House,
  TreePine,
  Sparkles,
  Map as MapIcon,
  List,
  LocateFixed,
  ChevronUp,
  ChevronDown,
  Trash2,
  Check,
  ExternalLink,
  Info,
} from "lucide-react";
import {
  adapters,
  availability,
  displaySchema,
  distance,
  extractLocation,
  hasPoint,
  mergeDisplays,
  readLocal,
  safeUrl,
  sources,
  status,
  type Display,
  type Point,
} from "./data";
import {
  getMatrix,
  navigationSegments,
  optimize,
  sharedTour,
  timeline,
  type Matrix,
  type Plan,
} from "./route";
import { DisplayMap } from "./Map";
import { demo } from "./demo";
const region = { lat: 39.785, lng: -85.94 };
const defaultPlan: Plan = {
  ids: [],
  start: region,
  end: null,
  roundTrip: true,
  departure: new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16),
  minutes: 5,
  overrides: {},
  name: "An evening of neighborhood magic",
  progress: 0,
};
function useLocal<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readLocal(key, initial));
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      window.dispatchEvent(new Event("storage-failed"));
    }
  }, [key, value]);
  return [value, setValue] as const;
}
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fmt = (d: Date | null) =>
  d
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "Unavailable";
export default function App() {
  const [local, setLocal] = useLocal<Display[]>("hde-displays", []),
    [favorites, setFavorites] = useLocal<string[]>("hde-favorites", []),
    [plan, setPlan] = useLocal<Plan>("hde-plan", defaultPlan),
    [saved, setSaved] = useLocal<{ plan: Plan; displays: Display[] }[]>(
      "hde-tours",
      [],
    );
  const [prefs, setPrefs] = useLocal("hde-preferences", {
    season: "All",
    demo: true,
  });
  const [remote, setRemote] = useState<Display[]>([]),
    [loading, setLoading] = useState(true),
    [config, setConfig] = useState({
      routingEndpoint: "",
      submissionUrl: "",
      contactEmail: "",
    });
  const [tab, setTab] = useState("Explore"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState(""),
    [filters, setFilters] = useState(false),
    [mobileView, setMobileView] = useState("List"),
    [radius, setRadius] = useState(50),
    [center, setCenter] = useState<Point>(region),
    [flags, setFlags] = useState<string[]>([]),
    [modal, setModal] = useState(""),
    [message, setMessage] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [pinning, setPinning] = useState(false),
    [roadResult, setRoadResult] = useState<{ matrix: Matrix; key: string }>(),
    [busy, setBusy] = useState(false),
    [budget, setBudget] = useState(90),
    [install, setInstall] = useState<any>(null);
  const [draft, setDraft] = useState({
      name: "",
      address: "",
      town: "",
      lat: "",
      lng: "",
      season: "Halloween",
      type: "Residential yard display",
      source: "",
    }),
    [confirmed, setConfirmed] = useState(false),
    [paste, setPaste] = useState(""),
    [imported, setImported] = useState<Display[]>([]),
    [drag, setDrag] = useState<number | null>(null);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine),
      storage = () =>
        setMessage(
          "Device storage is full or disabled. Changes may not survive closing the app.",
        ),
      prompt = (e: Event) => {
        e.preventDefault();
        setInstall(e);
      };
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    window.addEventListener("storage-failed", storage);
    window.addEventListener("beforeinstallprompt", prompt);
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/displays.json`)
        .then((r) => {
          if (!r.ok) throw Error();
          return r.text();
        })
        .then((t) => {
          const rows = JSON.parse(t);
          if (!Array.isArray(rows)) throw Error("Invalid site data");
          setRemote(rows.map((d) => displaySchema.parse(d)));
        }),
      fetch(`${import.meta.env.BASE_URL}config.json`)
        .then((r) => r.json())
        .then(setConfig),
    ])
      .catch(() =>
        setMessage(
          "Could not refresh site data. Your saved displays remain available.",
        ),
      )
      .finally(() => setLoading(false));
    if (location.hash.startsWith("#tour=")) {
      try {
        const raw = JSON.parse(decodeURIComponent(location.hash.slice(6)));
        if (
          raw.version !== 1 ||
          !Array.isArray(raw.stops) ||
          raw.stops.length > 20
        )
          throw Error();
        const stops = raw.stops.map((d: unknown) => displaySchema.parse(d));
        setLocal((old) => mergeDisplays([...old, ...stops]));
        setPlan({
          ...defaultPlan,
          ids: stops.map((d: Display) => d.id),
          name: String(raw.name || "Shared tour").slice(0, 100),
          minutes: Number.isFinite(raw.minutes)
            ? Math.min(180, Math.max(0, raw.minutes))
            : 5,
        });
        setTab("My tour");
        setMessage(
          "Shared stops loaded. Choose your own starting point before navigating.",
        );
        history.replaceState(
          null,
          "",
          location.pathname + location.search + "#tour",
        );
      } catch {
        setMessage("This shared tour link is invalid.");
      }
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("storage-failed", storage);
      window.removeEventListener("beforeinstallprompt", prompt);
    };
  }, []);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector(".modal") as HTMLElement | null;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal("");
        return;
      }
      if (e.key === "Tab" && dialog) {
        const elements = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            "button:not([disabled]),a[href],input,select,textarea,summary",
          ),
        ).filter((el) => el.offsetParent !== null);
        const first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [modal]);
  const data = useMemo(
    () => mergeDisplays([...remote, ...local, ...(prefs.demo ? demo : [])]),
    [remote, local, prefs.demo],
  );
  const stops = plan.ids
    .map((id) => [...data, ...demo].find((d) => d.id === id))
    .filter((d): d is Display => !!d);
  const routeKey = (p: Plan, ds: Display[]) =>
    JSON.stringify([
      p.ids,
      p.start,
      p.end,
      p.roundTrip,
      ds.map((d) => [d.id, d.lat, d.lng]),
    ]);
  const currentKey = routeKey(plan, stops);
  const latestKey = useRef(currentKey);
  latestKey.current = currentKey;
  const matrix = roadResult?.key === currentKey ? roadResult.matrix : undefined;
  const filtered = data.filter(
    (d) =>
      (prefs.season === "All" ||
        d.season === prefs.season ||
        d.season === "Both") &&
      `${d.name} ${d.town} ${d.address} ${d.zip}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!hasPoint(d) || distance(center, d) <= radius) &&
      (tab !== "Favorites" || favorites.includes(d.id)) &&
      flags.every((f) =>
        f === "Residential"
          ? ["Residential yard display", "Synchronized light show"].includes(
              d.type,
            )
          : f === "Free"
            ? d.cost === "Free"
            : f === "Drive-by"
              ? ["Drive-by", "Both"].includes(d.access)
              : f === "Music"
                ? d.music === true
                : f === "Family-friendly"
                  ? d.scare === "Family-friendly"
                  : f === "Open now"
                    ? availability(d, new Date()) === "Open"
                    : availability(d, new Date()) === "Unknown",
      ),
  );
  const updatePlan = (patch: Partial<Plan>) =>
    setPlan((p) => ({ ...p, ...patch }));
  function toggleStop(d: Display) {
    if (plan.ids.includes(d.id)) {
      updatePlan({ ids: plan.ids.filter((id) => id !== d.id), progress: 0 });
      return;
    }
    if (plan.ids.length >= 20) {
      setMessage("Tours support up to 20 stops.");
      return;
    }
    if (!hasPoint(d)) {
      setMessage(
        "This display needs confirmed coordinates before adding it to a tour.",
      );
      return;
    }
    updatePlan({ ids: [...plan.ids, d.id], progress: 0 });
  }
  function locate(forStart = false) {
    if (!navigator.geolocation) {
      setMessage("Location is unavailable. Set a map pin instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const point = { lat: p.coords.latitude, lng: p.coords.longitude };
        setCenter(point);
        if (forStart) updatePlan({ start: point });
        setMessage("Location set. No location history is recorded.");
      },
      () =>
        setMessage(
          "Location permission was declined or unavailable. Use a map pin or coordinates.",
        ),
      { timeout: 10000 },
    );
  }
  async function calculate(suggest = false) {
    if (!plan.departure || isNaN(Date.parse(plan.departure))) {
      setMessage("Choose a valid departure date and time.");
      return;
    }
    setBusy(true);
    setRoadResult(undefined);
    const requestKey = currentKey;
    try {
      let chosen = suggest
        ? filtered
            .filter(hasPoint)
            .filter((d) => distance(plan.start, d) <= radius)
            .slice(0, 20)
        : stops;
      if (!chosen.length) throw Error("Add at least one display to your tour.");
      const end = plan.roundTrip ? plan.start : plan.end;
      let road: Matrix | undefined;
      try {
        if (config.routingEndpoint)
          road = await getMatrix(
            [plan.start, ...chosen.filter(hasPoint), ...(end ? [end] : [])],
            config.routingEndpoint,
          );
      } catch {
        setMessage(
          "Road routing failed. Showing approximate geographic ordering; driving times are unavailable.",
        );
      }
      let ordered = optimize(chosen, plan.start, end, road);
      if (road) {
        const index = [
          0,
          ...ordered.map((d) => chosen.findIndex((s) => s.id === d.id) + 1),
          ...(end ? [chosen.length + 1] : []),
        ];
        road = {
          durations: index.map((i) => index.map((j) => road!.durations[i][j])),
          distances: index.map((i) => index.map((j) => road!.distances[i][j])),
        };
        if (suggest) {
          while (
            ordered.length &&
            timeline(ordered, plan, road).total! > budget
          ) {
            const removed = ordered.length;
            ordered = ordered.slice(0, -1);
            const keep: number[] = road.durations
              .map((_, i) => i)
              .filter((i) => i !== removed);
            road = {
              durations: keep.map((i) =>
                keep.map((j) => road!.durations[i][j]),
              ),
              distances: keep.map((i) =>
                keep.map((j) => road!.distances[i][j]),
              ),
            };
          }
        }
      } else if (suggest) {
        ordered = ordered.slice(
          0,
          Math.max(1, Math.floor(budget / Math.max(1, plan.minutes))),
        );
        setMessage(
          "Suggested by distance and viewing time only. The outing budget cannot be checked without road routing.",
        );
      }
      if (latestKey.current !== requestKey) {
        setMessage(
          "Tour changed while routing. Optimize again for the new stops.",
        );
        return;
      }
      const nextPlan = { ...plan, ids: ordered.map((d) => d.id), progress: 0 };
      setPlan(nextPlan);
      setRoadResult(
        road ? { matrix: road, key: routeKey(nextPlan, ordered) } : undefined,
      );
      if (!road && !suggest)
        setMessage(
          "Approximate geographic order ready. Road driving times and arrival windows are unavailable.",
        );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function reorder(from: number, to: number) {
    if (to < 0 || to >= stops.length) return;
    const ids = [...plan.ids];
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    updatePlan({ ids, progress: 0 });
  }
  const schedule = timeline(stops, plan, matrix);
  const end = plan.roundTrip ? plan.start : plan.end;
  const segments = navigationSegments(stops.filter(hasPoint), plan.start, end);
  const demoTour = stops.some((d) => d.demo);
  const next = stops[plan.progress];
  function addManual() {
    try {
      if (!confirmed)
        throw Error(
          "Confirm the location or explicitly confirm that coordinates are unknown.",
        );
      const d = displaySchema.parse({
        id: crypto.randomUUID(),
        name: draft.name,
        address: draft.address,
        town: draft.town,
        lat: draft.lat ? Number(draft.lat) : null,
        lng: draft.lng ? Number(draft.lng) : null,
        season: draft.season,
        type: draft.type,
        sources: [{ name: "Manual entry", url: draft.source }],
      });
      setLocal((v) => mergeDisplays([...v, d]));
      setModal("");
      setMessage("Display saved on this device as unverified.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const card = (d: Display) => (
    <article
      key={d.id}
      id={d.id}
      className={`display-card ${selected === d.id ? "active" : ""}`}
      onClick={() => setSelected(d.id)}
    >
      <div
        className={`card-art ${d.season === "Christmas" ? "christmas" : "halloween"}`}
        aria-hidden="true"
      >
        <span className="art-star">✦</span>
        <House size={48} strokeWidth={1.15} />
        <span className="art-tree">{d.season === "Christmas" ? "♧" : "☾"}</span>
        <span className="art-tag">
          {d.demo ? "DEMO DISPLAY" : d.season.toUpperCase()}
        </span>
      </div>
      <div className="card-body">
        <div className="card-top">
          <span className="eyebrow">{d.town || "Town unknown"}</span>
          <button
            className={
              "icon-button " + (favorites.includes(d.id) ? "hearted" : "")
            }
            aria-label={`${favorites.includes(d.id) ? "Unfavorite" : "Favorite"} ${d.name}`}
            onClick={(e) => {
              e.stopPropagation();
              setFavorites((v) =>
                v.includes(d.id) ? v.filter((id) => id !== d.id) : [...v, d.id],
              );
            }}
          >
            <Heart
              size={19}
              fill={favorites.includes(d.id) ? "currentColor" : "none"}
            />
          </button>
        </div>
        <h3>{d.name}</h3>
        <p className="small">
          {d.type} · {d.access}
        </p>
        <div className="badges">
          <span
            className={
              status(d) === "Confirmed this season" ? "verified" : "neutral"
            }
          >
            {status(d)}
          </span>
          <span>{d.cost}</span>
        </div>
        <p className="small">
          {hasPoint(d)
            ? `${distance(center, d).toFixed(1)} mi away · straight-line`
            : "Location needs confirmation"}
        </p>
        <p className="small">
          {d.hours.length
            ? d.hours.map((h) => `${h.open}–${h.close}`).join(", ") +
              " · " +
              d.timezone
            : "Hours unknown · check before visiting"}
        </p>
        <details onClick={(e) => e.stopPropagation()}>
          <summary>Details & sources</summary>
          <p>{d.address}</p>
          <p>
            {d.scare} ·{" "}
            {d.music
              ? "Music synchronized " + d.fm
              : "Music " + (d.music === false ? "not listed" : "unknown")}
          </p>
          <p>
            Dates: {d.startDate || "unknown"} – {d.endDate || "unknown"}
          </p>
          <p>
            Confirmed: {d.lastConfirmed || "unknown"} · Imported:{" "}
            {d.lastImported || "not imported"}
          </p>
          <p>{d.parking || "Parking notes not supplied"}</p>
          <p>{d.accessibility || "Accessibility notes not supplied"}</p>
          {d.sources.map((s, i) =>
            s.url ? (
              <a key={i} href={safeUrl(s.url)} target="_blank" rel="noreferrer">
                {s.name} ↗{" "}
              </a>
            ) : (
              <span key={i}>{s.name}</span>
            ),
          )}
          {d.photos?.map((photo, i) => (
            <p key={"photo" + i}>
              <a href={safeUrl(photo.url)} target="_blank" rel="noreferrer">
                Authorized photo · {photo.credit}
              </a>
            </p>
          ))}
          {d.conflicts.map((c) => (
            <p className="warning" key={c}>
              {c}
            </p>
          ))}
        </details>
        <button
          className={"add-button " + (plan.ids.includes(d.id) ? "added" : "")}
          onClick={(e) => {
            e.stopPropagation();
            toggleStop(d);
          }}
        >
          {plan.ids.includes(d.id) ? <Check size={16} /> : <Plus size={16} />}{" "}
          {plan.ids.includes(d.id) ? "Added to tour" : "Add to tour"}
        </button>
      </div>
    </article>
  );
  return (
    <>
      <header>
        <a className="brand" href="#explore" onClick={() => setTab("Explore")}>
          <span className="brand-mark">
            <Compass />
          </span>
          <span>
            Holiday Display<span className="brand-sub">EXPLORER</span>
          </span>
        </a>
        <nav>
          {["Explore", "Favorites", "My tour"].map((t, i) => (
            <button
              className={tab === t ? "current" : ""}
              key={t}
              onClick={() => setTab(t)}
            >
              {i === 0 ? (
                <Compass size={18} />
              ) : i === 1 ? (
                <Heart size={18} />
              ) : (
                <Route size={18} />
              )}
              <span>{t}</span>
              {t === "My tour" && <b>{plan.ids.length}</b>}
            </button>
          ))}
        </nav>
        <button
          className="header-add"
          onClick={() => setModal("Add a display")}
        >
          <Plus size={18} /> Add a display
        </button>
      </header>
      <main>
        <section className="hero">
          <div>
            <div className="eyebrow">
              <span className="green-dot" /> LITTLE DETOURS. BIG MEMORIES.
            </div>
            <h1>
              Find your next <em>“wow.”</em>
            </h1>
            <p>Discover neighborhood magic. Make a night of it.</p>
          </div>
          <div className="region">
            <MapPin size={18} />
            <div>
              Central Indiana
              <span>New Palestine · Greenfield · McCordsville & beyond</span>
            </div>
          </div>
        </section>
        {!online && (
          <div className="notice">
            You’re offline. Saved displays and tours work; map tiles, road
            routing, and navigation need internet.
          </div>
        )}
        {message && (
          <div className="notice" role="status">
            {message}
            <button aria-label="Dismiss message" onClick={() => setMessage("")}>
              <X size={16} />
            </button>
          </div>
        )}
        <div className="demo-bar">
          <Info size={17} />
          <span>
            {prefs.demo
              ? "You’re exploring demo displays. These are fictional, not places to visit."
              : "Real listings only. Add your own discoveries or import an authorized dataset."}
          </span>
          <button onClick={() => setPrefs((p) => ({ ...p, demo: !p.demo }))}>
            {prefs.demo ? "Hide demo" : "Try demo"}
          </button>
        </div>
        {tab !== "My tour" ? (
          <>
            <section className="toolbar">
              <div className="season-tabs">
                {["All", "Halloween", "Christmas"].map((s) => (
                  <button
                    key={s}
                    className={prefs.season === s ? "selected" : ""}
                    onClick={() => setPrefs((p) => ({ ...p, season: s }))}
                  >
                    {s === "All" ? (
                      <Sparkles size={16} />
                    ) : s === "Christmas" ? (
                      <TreePine size={16} />
                    ) : (
                      <House size={16} />
                    )}{" "}
                    {s === "All" ? "All seasons" : s}
                  </button>
                ))}
              </div>
              <label className="search">
                <Search size={19} />
                <input
                  aria-label="Search town, ZIP or address"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Town, ZIP code, or address"
                />
              </label>
              <button
                className={filters ? "filter-button selected" : "filter-button"}
                onClick={() => setFilters(!filters)}
              >
                <SlidersHorizontal size={17} /> Filters {flags.length || ""}
              </button>
              <button
                className="icon-button"
                aria-label="Use my location"
                onClick={() => locate()}
              >
                <LocateFixed size={20} />
              </button>
            </section>
            {filters && (
              <section className="filter-panel">
                {[
                  "Residential",
                  "Free",
                  "Drive-by",
                  "Music",
                  "Family-friendly",
                  "Open now",
                  "Unknown hours",
                ].map((f) => (
                  <label key={f}>
                    <input
                      type="checkbox"
                      checked={flags.includes(f)}
                      onChange={() =>
                        setFlags((a) =>
                          a.includes(f) ? a.filter((v) => v !== f) : [...a, f],
                        )
                      }
                    />
                    {f}
                  </label>
                ))}
                <label>
                  Within{" "}
                  <select
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                  >
                    {[5, 10, 25, 50, 100, 5000].map((n) => (
                      <option key={n} value={n}>
                        {n === 5000 ? "Any distance" : n + " miles"}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="small">
                  Distances from{" "}
                  {center === region
                    ? "Central Indiana"
                    : `${center.lat.toFixed(3)}, ${center.lng.toFixed(3)}`}
                  . Unknown locations remain in the list. Open now requires
                  reliable seasonal hours.
                </p>
              </section>
            )}
            <div className="results-title">
              <div>
                <h2>
                  {tab === "Favorites"
                    ? "Your little collection"
                    : "A little magic, close to home"}
                </h2>
                <span>
                  {loading
                    ? "Loading displays…"
                    : `${filtered.length} displays to explore`}{" "}
                  · {prefs.demo ? "Demo mode" : "Community discoveries"}
                </span>
              </div>
              <div className="view-switch">
                {["List", "Map"].map((v) => (
                  <button
                    key={v}
                    className={mobileView === v ? "selected" : ""}
                    onClick={() => setMobileView(v)}
                  >
                    {v === "List" ? <List size={16} /> : <MapIcon size={16} />}{" "}
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <section
              className={`explore-grid mobile-${mobileView.toLowerCase()}`}
            >
              <div className="list-panel">
                {filtered.length ? (
                  filtered.map(card)
                ) : (
                  <div className="empty">
                    <Compass size={36} />
                    <h3>No displays here yet</h3>
                    <p>
                      Try another season or fewer filters, explore the source
                      guides, or add a display you know.
                    </p>
                    <button
                      onClick={() => {
                        setFlags([]);
                        setQuery("");
                        setPrefs((p) => ({ ...p, season: "All" }));
                      }}
                    >
                      Reset filters
                    </button>
                  </div>
                )}
              </div>
              <div className="map-panel">
                <DisplayMap
                  displays={filtered}
                  selected={selected}
                  onSelect={(id) => {
                    setSelected(id);
                    setMobileView("List");
                    setTimeout(
                      () =>
                        document.getElementById(id)?.scrollIntoView({
                          behavior: "smooth",
                          block: "nearest",
                        }),
                      0,
                    );
                  }}
                  center={center}
                  pinning={pinning}
                  onPin={(p) => {
                    updatePlan({ start: p });
                    setPinning(false);
                    setMessage("Starting map pin set.");
                  }}
                />
                <div className="map-label">
                  <span className="green-dot" />{" "}
                  {prefs.demo
                    ? "Illustrative locations · demo"
                    : "Explore your neighborhood"}
                </div>
                <div className="map-footer">
                  <MapPin size={17} />
                  <span>
                    Good neighbors make great nights.
                    <small>View from the road. Keep driveways clear.</small>
                  </span>
                </div>
              </div>
            </section>
            <div className="tour-banner">
              <div className="banner-icon">
                <Route />
              </div>
              <div>
                <h3>Your next family tradition starts here.</h3>
                <p>Add a few favorites. We’ll help you connect the dots.</p>
              </div>
              <button className="primary" onClick={() => setTab("My tour")}>
                Build my tour <ArrowRight size={17} />
              </button>
            </div>
          </>
        ) : (
          <section className="tour-layout">
            <div>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">YOUR EVENING, YOUR WAY</span>
                  <h2>Let’s take the scenic way.</h2>
                </div>
                <button onClick={() => setTab("Explore")}>
                  <Plus size={16} /> Add stops
                </button>
              </div>
              <label>
                Tour name
                <input
                  value={plan.name}
                  maxLength={100}
                  onChange={(e) => updatePlan({ name: e.target.value })}
                />
              </label>
              <div className="form-grid">
                <label>
                  Starting point (lat, lng or Maps link)
                  <input
                    key={`${plan.start.lat},${plan.start.lng}`}
                    defaultValue={`${plan.start.lat}, ${plan.start.lng}`}
                    onBlur={(e) => {
                      const result = extractLocation(e.target.value);
                      if (result.point) updatePlan({ start: result.point });
                      else
                        setMessage(
                          "Address geocoding is not configured. Paste coordinates from Maps or choose a map pin.",
                        );
                    }}
                  />
                </label>
                <label>
                  Departure · device timezone
                  <input
                    type="datetime-local"
                    value={plan.departure}
                    onChange={(e) => updatePlan({ departure: e.target.value })}
                  />
                </label>
              </div>
              <div className="button-row">
                <button onClick={() => locate(true)}>
                  <LocateFixed size={16} /> Current location
                </button>
                <button
                  onClick={() => {
                    setPinning(!pinning);
                  }}
                >
                  <MapPin size={16} />{" "}
                  {pinning ? "Cancel map pin" : "Choose map pin"}
                </button>
              </div>
              {pinning && (
                <div className="pin-map">
                  <p>Tap the map to confirm your starting point.</p>
                  <DisplayMap
                    displays={[]}
                    selected=""
                    onSelect={() => {}}
                    center={plan.start}
                    pinning
                    onPin={(p) => {
                      updatePlan({ start: p });
                      setPinning(false);
                    }}
                  />
                </div>
              )}
              <div className="form-grid">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={plan.roundTrip}
                    onChange={(e) =>
                      updatePlan({ roundTrip: e.target.checked })
                    }
                  />{" "}
                  Round trip to start
                </label>
                {!plan.roundTrip && (
                  <label>
                    Ending point · blank ends at last stop
                    <input
                      placeholder="latitude, longitude"
                      defaultValue={
                        plan.end ? `${plan.end.lat}, ${plan.end.lng}` : ""
                      }
                      onBlur={(e) => {
                        if (!e.target.value) updatePlan({ end: null });
                        else {
                          const point = extractLocation(e.target.value).point;
                          if (point) updatePlan({ end: point });
                          else setMessage("Confirm ending coordinates.");
                        }
                      }}
                    />
                  </label>
                )}
                <label>
                  Default viewing minutes
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={plan.minutes}
                    onChange={(e) =>
                      updatePlan({
                        minutes: Math.max(
                          0,
                          Math.min(180, Number(e.target.value)),
                        ),
                      })
                    }
                  />
                </label>
              </div>
              <details className="suggest">
                <summary>Help me choose a tour</summary>
                <div className="form-grid">
                  <label>
                    Radius from start (miles)
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={radius}
                      onChange={(e) =>
                        setRadius(
                          Math.max(1, Math.min(100, Number(e.target.value))),
                        )
                      }
                    />
                  </label>
                  <label>
                    Outing budget (minutes)
                    <input
                      type="number"
                      min="15"
                      max="600"
                      value={budget}
                      onChange={(e) =>
                        setBudget(
                          Math.max(15, Math.min(600, Number(e.target.value))),
                        )
                      }
                    />
                  </label>
                </div>
                <p className="small">
                  Uses your current explore filters, up to 20 stops. Without
                  road routing, only viewing time can be budgeted.
                </p>
                <button disabled={busy} onClick={() => calculate(true)}>
                  Suggest a tour
                </button>
              </details>
              <div className="stops-heading">
                <h3>{stops.length} stops · make it your own</h3>
                <button
                  className="primary"
                  disabled={busy || !stops.length}
                  onClick={() => calculate()}
                >
                  <Sparkles size={16} />
                  {busy ? "Calculating…" : "Optimize order"}
                </button>
              </div>
              {!stops.length && (
                <div className="empty">
                  <Route size={32} />
                  <h3>A great night starts with one stop.</h3>
                  <p>Add displays from Explore to get started.</p>
                </div>
              )}
              {schedule.rows.map(({ d, arrival, viewing, state }, i) => (
                <div
                  key={d.id}
                  className="stop"
                  draggable
                  onDragStart={() => setDrag(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (drag !== null) reorder(drag, i);
                    setDrag(null);
                  }}
                >
                  <span className="stop-number">{i + 1}</span>
                  <div className="stop-info">
                    <h3>{d.name}</h3>
                    <p>
                      {d.town} · {d.demo ? "Fictional demo" : status(d)}
                    </p>
                    <p>
                      {arrival
                        ? `Arrive ${fmt(arrival)} · ${state}`
                        : "Arrival unavailable · hours not evaluated"}
                    </p>
                    {state === "Closed" && (
                      <span className="warning">
                        Expected closed. Remove this stop or reorder it.
                      </span>
                    )}
                    <label className="viewing">
                      View for{" "}
                      <input
                        type="number"
                        min="0"
                        max="180"
                        aria-label={`Viewing minutes for ${d.name}`}
                        value={viewing}
                        onChange={(e) =>
                          updatePlan({
                            overrides: {
                              ...plan.overrides,
                              [d.id]: Math.min(
                                180,
                                Math.max(0, Number(e.target.value)),
                              ),
                            },
                          })
                        }
                      />{" "}
                      min
                    </label>
                  </div>
                  <div className="stop-actions">
                    <button
                      aria-label={`Move ${d.name} up`}
                      disabled={i === 0}
                      onClick={() => reorder(i, i - 1)}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      aria-label={`Move ${d.name} down`}
                      disabled={i === stops.length - 1}
                      onClick={() => reorder(i, i + 1)}
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      aria-label={`Remove ${d.name}`}
                      onClick={() => toggleStop(d)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {schedule.rows.some((r) => r.state === "Closed") && (
                <button
                  onClick={() =>
                    updatePlan({
                      ids: schedule.rows
                        .filter((r) => r.state !== "Closed")
                        .map((r) => r.d.id),
                      progress: 0,
                    })
                  }
                >
                  Remove expected closed stops
                </button>
              )}
            </div>
            <aside className="tour-summary">
              <span className="eyebrow">THE NIGHT AHEAD</span>
              <h2>Your tour at a glance</h2>
              <p className="estimate">
                {matrix
                  ? "Road-based optimized estimate"
                  : "Approximate geographic ordering"}
              </p>
              <div className="stats">
                <div>
                  <b>{stops.length}</b>
                  <span>stops</span>
                </div>
                <div>
                  <b>{schedule.viewing}m</b>
                  <span>viewing</span>
                </div>
              </div>
              <dl>
                <dt>Driving time</dt>
                <dd>
                  {schedule.drive === null
                    ? "Unavailable"
                    : Math.round(schedule.drive) + " min"}
                </dd>
                <dt>Road distance</dt>
                <dd>
                  {schedule.miles === null
                    ? "Unavailable"
                    : schedule.miles.toFixed(1) + " mi"}
                </dd>
                <dt>Total outing</dt>
                <dd>
                  {schedule.total === null
                    ? "Unavailable"
                    : Math.round(schedule.total) + " min"}
                </dd>
                <dt>{plan.roundTrip ? "Return" : "Finish"}</dt>
                <dd>{fmt(schedule.finish)}</dd>
              </dl>
              <p className="small">
                {matrix
                  ? "Based on typical roads, not live traffic. Check every source before leaving."
                  : "Configure a road-routing provider for driving estimates and arrival checks. Coordinate distance is not driving time."}
              </p>
              <p className="warning">
                {
                  stops.filter((d) => status(d) !== "Confirmed this season")
                    .length
                }{" "}
                unverified / previous-season stops. Unknown hours do not mean
                open.
              </p>
              <div className="button-stack">
                <button
                  disabled={!stops.length}
                  className="primary"
                  onClick={() => {
                    setSaved((v) => [
                      ...v.filter((s) => s.plan.name !== plan.name),
                      { plan, displays: stops },
                    ]);
                    setMessage(
                      "Tour and display details saved on this device.",
                    );
                  }}
                >
                  <Download size={17} /> Save tour offline
                </button>
                <button
                  disabled={!stops.length}
                  onClick={async () => {
                    const url =
                      location.href.split("#")[0] + sharedTour(stops, plan);
                    try {
                      await navigator.clipboard.writeText(url);
                      setMessage(
                        "Tour link copied. Starting and ending points are excluded.",
                      );
                    } catch {
                      setPaste(url);
                      setModal("Copy tour link");
                    }
                  }}
                >
                  Share stops · private start excluded
                </button>
              </div>
              <h3>Ready when you are</h3>
              {matrix && (
                <p className="small">
                  Routing © openrouteservice / HeiGIT, map data © OpenStreetMap
                  contributors.
                </p>
              )}
              {demoTour ? (
                <p className="warning">
                  Navigation is disabled for fictional demo displays. Add real,
                  confirmed locations to navigate.
                </p>
              ) : (
                <>
                  {segments.map((url, i) => (
                    <a
                      className="nav-link"
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation size={16} /> Google Maps · segment {i + 1} of{" "}
                      {segments.length}
                    </a>
                  ))}
                  {next && hasPoint(next) && (
                    <>
                      <p>Next: {next.name}</p>
                      <a
                        className="nav-link"
                        href={`https://maps.apple.com/?daddr=${next.lat},${next.lng}&dirflg=d`}
                      >
                        Apple Maps · next stop
                      </a>
                      <a
                        className="nav-link"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${next.lat},${next.lng}&travelmode=driving`}
                      >
                        Google Maps · next stop
                      </a>
                      <button
                        onClick={() =>
                          updatePlan({ progress: plan.progress + 1 })
                        }
                      >
                        Mark stop visited
                      </button>
                    </>
                  )}
                  {stops.length > 0 && plan.progress >= stops.length && (
                    <button onClick={() => updatePlan({ progress: 0 })}>
                      Tour complete · reset progress
                    </button>
                  )}
                </>
              )}
              <p className="small">
                Navigation needs internet and may recalculate. Segments preserve
                planned stops; check the preview before leaving. Set up while
                parked.
              </p>
              <details>
                <summary>Saved tours ({saved.length})</summary>
                {saved.map((s, i) => (
                  <div className="saved-row" key={i}>
                    <button
                      onClick={() => {
                        setLocal((v) => mergeDisplays([...v, ...s.displays]));
                        setPlan(s.plan);
                        setMessage(
                          "Saved tour restored. Reoptimize for fresh road estimates.",
                        );
                      }}
                    >
                      {s.plan.name}
                    </button>
                    <button
                      aria-label={`Delete ${s.plan.name}`}
                      onClick={() =>
                        setSaved((v) => v.filter((_, j) => i !== j))
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </details>
            </aside>
          </section>
        )}
        <footer>
          <div>
            <span className="brand-mini">
              <Compass size={18} /> A little wonder, responsibly.
            </span>
            <p>
              Stay on public roads. Respect neighbors, quiet hours, and posted
              signs.
            </p>
          </div>
          <div className="footer-links">
            <button onClick={() => setModal("Sources & data")}>
              Sources & data
            </button>
            <button onClick={() => setModal("Import displays")}>Import</button>
            <button onClick={() => setModal("Install & offline")}>
              Install app
            </button>
            <button onClick={() => setModal("Privacy & corrections")}>
              Privacy & corrections
            </button>
          </div>
        </footer>
      </main>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal("")}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-heading">
              <h2>{modal}</h2>
              <button
                autoFocus
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setModal("")}
              >
                <X />
              </button>
            </div>
            {modal === "Add a display" && (
              <>
                <p>
                  Save a discovery on this device. New entries remain
                  unverified.
                </p>
                <label>
                  Paste an address or Google Maps link
                  <input
                    value={paste}
                    onChange={(e) => setPaste(e.target.value)}
                  />
                </label>
                <button
                  onClick={() => {
                    const found = extractLocation(paste);
                    setDraft((d) => ({
                      ...d,
                      address: found.address,
                      lat: found.point ? String(found.point.lat) : "",
                      lng: found.point ? String(found.point.lng) : "",
                    }));
                    setConfirmed(false);
                    setMessage(
                      "Check the extracted location. Short Maps links need opening in Maps; they cannot be expanded here.",
                    );
                  }}
                >
                  Extract location
                </button>
                {(
                  ["name", "address", "town", "lat", "lng", "source"] as const
                ).map((k) => (
                  <label key={k}>
                    {
                      {
                        name: "Display name",
                        address: "Street address",
                        town: "Town",
                        lat: "Latitude (optional)",
                        lng: "Longitude (optional)",
                        source: "Source URL (optional)",
                      }[k]
                    }
                    <input
                      value={draft[k]}
                      onChange={(e) => {
                        setDraft({ ...draft, [k]: e.target.value });
                        setConfirmed(false);
                      }}
                    />
                  </label>
                ))}
                <div className="form-grid">
                  <label>
                    Season
                    <select
                      value={draft.season}
                      onChange={(e) =>
                        setDraft({ ...draft, season: e.target.value })
                      }
                    >
                      {["Halloween", "Christmas", "Both"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Display type
                    <select
                      value={draft.type}
                      onChange={(e) =>
                        setDraft({ ...draft, type: e.target.value })
                      }
                    >
                      {[
                        "Residential yard display",
                        "Synchronized light show",
                        "Home haunt",
                        "Business",
                        "Attraction",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />{" "}
                  I checked this location, or intentionally left coordinates
                  unknown.
                </label>
                <button className="primary" onClick={addManual}>
                  Save display
                </button>
              </>
            )}
            {modal === "Sources & data" && (
              <>
                <p>
                  No third-party display feeds are connected. These are
                  reference links only. Browse an original source, then manually
                  add a discovery you are allowed to use.
                </p>
                {sources.map(([name, url]) => (
                  <a
                    className="source-link"
                    key={name}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>
                      {name}
                      <small>Reference only · not imported</small>
                    </span>
                    <ExternalLink size={16} />
                  </a>
                ))}
                <p>
                  Connected inputs: manual entry, validated CSV / JSON, and the
                  site owner’s reviewed static dataset. Photos are not imported.
                  Today’s import never counts as seasonal confirmation.
                </p>
                <button onClick={() => setModal("Add a display")}>
                  Add a discovery
                </button>
              </>
            )}
            {modal === "Import displays" && (
              <>
                <p>
                  Import authorized CSV or a JSON array. Validate first, then
                  add locally. Nothing here writes to GitHub or publishes
                  submissions.
                </p>
                <input
                  type="file"
                  accept=".json,.csv"
                  aria-label="Import file"
                  onChange={async (e) => {
                    setImported([]);
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      if (f.size > 2000000) throw Error("File limit is 2 MB");
                      const adapter = adapters.find((a) =>
                        f.name.toLowerCase().endsWith("." + a.id),
                      );
                      if (!adapter) throw Error("Choose JSON or CSV");
                      setImported(adapter.parse(await f.text()));
                      setMessage(
                        "Validated. Review the import preview before adding.",
                      );
                    } catch (err) {
                      setMessage((err as Error).message);
                    }
                  }}
                />
                {imported.length > 0 && (
                  <>
                    <p>{imported.length} validated records</p>
                    <div className="import-preview">
                      {imported.map((d) => (
                        <p key={d.id}>
                          {d.name} · {status(d)}{" "}
                          {d.conflicts.length
                            ? "· conflicts require review"
                            : ""}
                        </p>
                      ))}
                    </div>
                    <button
                      className="primary"
                      onClick={() => {
                        setLocal((v) => mergeDisplays([...v, ...imported]));
                        setImported([]);
                        setModal("");
                        setMessage(
                          "Imported locally. Export a reviewed file to prepare a repository update.",
                        );
                      }}
                    >
                      Add these displays locally
                    </button>
                  </>
                )}
                <button
                  onClick={() =>
                    download(
                      "displays.json",
                      local.filter((d) => !d.demo),
                    )
                  }
                >
                  <Download size={16} /> Export local real displays
                </button>
                <p>
                  Owner workflow: review the downloaded file, commit it as
                  public/data/displays.json, then deploy through GitHub Actions.
                </p>
                <a
                  href={`${import.meta.env.BASE_URL}data/example.json`}
                  download
                >
                  Download JSON example
                </a>
              </>
            )}
            {modal === "Install & offline" && (
              <>
                <p>
                  On iPhone: open in Safari, tap Share, then Add to Home Screen
                  → Add.
                </p>
                {install && (
                  <button
                    className="primary"
                    onClick={() => {
                      install.prompt();
                      setInstall(null);
                    }}
                  >
                    Install Holiday Display Explorer
                  </button>
                )}
                <p>
                  The app shell and reviewed site dataset are cached after the
                  first online load. Favorites, manual imports, and saved tours
                  stay on this device. Open a saved tour while offline to see
                  its stops.
                </p>
                <p>
                  Map tiles are not downloaded for offline use. New road
                  estimates and external navigation need internet. Clearing
                  browser data removes saved information.
                </p>
              </>
            )}
            {modal === "Privacy & corrections" && (
              <>
                <p>
                  No account or analytics. Location is requested only when you
                  tap the location button. Your current starting point is stored
                  with your local tour, without location history. Shared links
                  contain display stops, never your private starting or ending
                  point.
                </p>
                <p>
                  Online maps send visible map tile requests to OpenStreetMap.
                  Configured road routing receives tour coordinates. External
                  navigation has its own privacy policy.
                </p>
                {config.contactEmail &&
                /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(config.contactEmail) ? (
                  <a href={`mailto:${config.contactEmail}`}>
                    Request a homeowner removal or correction
                  </a>
                ) : (
                  <p className="warning">
                    Homeowner contact is not configured. The site owner must add
                    a contact email before publishing real listings.
                  </p>
                )}
                {safeUrl(config.submissionUrl) && (
                  <a
                    className="source-link"
                    href={safeUrl(config.submissionUrl)}
                  >
                    Submit a display or correction ↗
                  </a>
                )}
                <button
                  onClick={() => {
                    setLocal([]);
                    setFavorites([]);
                    setSaved([]);
                    setPlan(defaultPlan);
                    setMessage(
                      "Local displays, favorites, saved tours, and route progress cleared.",
                    );
                  }}
                >
                  Clear my local data
                </button>
              </>
            )}
            {modal === "Copy tour link" && (
              <textarea
                readOnly
                value={paste}
                onFocus={(e) => e.target.select()}
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}
