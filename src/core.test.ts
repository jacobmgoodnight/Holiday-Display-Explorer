import { describe, it, expect, vi } from "vitest";
import {
  adapters,
  availability,
  displaySchema,
  extractLocation,
  mergeDisplays,
  safeUrl,
  status,
} from "./data";
import {
  getMatrix,
  navigationSegments,
  optimize,
  sharedTour,
  timeline,
  type Plan,
} from "./route";
const make = (extra: Record<string, unknown> = {}) =>
  displaySchema.parse({
    id: "a",
    name: "Test display",
    lat: 39.7,
    lng: -85.9,
    ...extra,
  });
const plan: Plan = {
  ids: ["a"],
  start: { lat: 39, lng: -86 },
  end: null,
  roundTrip: true,
  departure: "2026-10-19T23:00:00Z",
  minutes: 5,
  overrides: {},
  name: "Family tour",
  progress: 0,
};
describe("data boundaries", () => {
  it("does not turn an import into a confirmation", () => {
    const d = adapters[0].parse(
      JSON.stringify([{ id: "a", name: "Example", year: 2026 }]),
    )[0];
    expect(d.lastImported).toBeTruthy();
    expect(status(d, 2026)).toBe("Unverified");
  });
  it("distinguishes seasonal evidence", () => {
    expect(
      status(
        make({
          year: 2025,
          verification: "confirmed",
          lastConfirmed: "2025-10-01",
        }),
        2026,
      ),
    ).toBe("From a previous season");
    expect(
      status(
        make({
          year: 2026,
          verification: "confirmed",
          lastConfirmed: "2026-10-01",
        }),
        2026,
      ),
    ).toBe("Confirmed this season");
    expect(status(make({ year: 2026, verification: "confirmed" }), 2026)).toBe(
      "Unverified",
    );
  });
  it("retains unknown coordinates and rejects partial coordinates", () => {
    expect(displaySchema.parse({ id: "x", name: "No point" }).lat).toBeNull();
    expect(() =>
      displaySchema.parse({ id: "x", name: "Bad point", lat: 39 }),
    ).toThrow();
  });
  it("merges normalized addresses and preserves sources and conflicts", () => {
    const records = mergeDisplays([
      make({
        address: "100 Example Street",
        town: "Test",
        sources: [{ name: "A", url: "https://example.org/a" }],
        startDate: "2026-10-01",
      }),
      make({
        id: "b",
        address: "100 Example St.",
        town: "Test",
        sources: [{ name: "B", url: "https://example.org/b" }],
        startDate: "2026-10-02",
      }),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].sources).toHaveLength(2);
    expect(records[0].conflicts).toContain(
      "Conflicting startDate: review source records",
    );
  });
  it("merges nearby matching names but keeps neighboring homes distinct", () => {
    expect(
      mergeDisplays([make(), make({ id: "b", lat: 39.70001 })]),
    ).toHaveLength(1);
    expect(
      mergeDisplays([
        make(),
        make({ id: "b", name: "Different house", lat: 39.70001 }),
      ]),
    ).toHaveLength(2);
  });
  it("never mixes fictional and real records", () =>
    expect(mergeDisplays([make(), make({ id: "b", demo: true })])).toHaveLength(
      2,
    ));
  it("rejects executable source URLs and invalid data", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(() =>
      adapters[0].parse(
        '[{"id":"x","name":"x","sources":[{"name":"bad","url":"javascript:alert(1)"}]}]',
      ),
    ).toThrow();
    expect(() => adapters[1].parse("id,name,lat,lng\nx,Test,91,0")).toThrow();
  });
  it("parses CSV and safe text without executing it", () => {
    const d = adapters[1].parse(
      "id,name,cost,music\nx,<script>hi</script>,Free,false",
    )[0];
    expect(d.name).toBe("<script>hi</script>");
    expect(d.music).toBe(false);
  });
  it("extracts coordinates and asks for short-link confirmation", () => {
    expect(
      extractLocation("https://www.google.com/maps/@39.7,-85.9,14z").point,
    ).toEqual({ lat: 39.7, lng: -85.9 });
    expect(
      extractLocation("https://maps.app.goo.gl/example").point,
    ).toBeUndefined();
  });
});
describe("opening windows", () => {
  const known = make({
    year: 2026,
    verification: "confirmed",
    lastConfirmed: "2026-10-01",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    hours: [{ days: [1], open: "18:00", close: "22:00" }],
  });
  it("evaluates the display timezone", () => {
    expect(availability(known, new Date("2026-10-19T23:00:00Z"))).toBe("Open");
    expect(availability(known, new Date("2026-10-20T03:00:00Z"))).toBe(
      "Closed",
    );
  });
  it("keeps unknown and previous season hours unknown", () => {
    expect(availability(make(), new Date())).toBe("Unknown");
    expect(
      availability({ ...known, year: 2025 }, new Date("2026-10-19T23:00:00Z")),
    ).toBe("Unknown");
  });
  it("handles overnight closing on the following day", () => {
    const night = {
      ...known,
      hours: [{ days: [1], open: "20:00", close: "02:00" }],
    };
    expect(availability(night, new Date("2026-10-20T05:00:00Z"))).toBe("Open");
    expect(availability(night, new Date("2026-10-20T07:00:00Z"))).toBe(
      "Closed",
    );
  });
});
describe("routes and handoff", () => {
  it("preserves all stops and supports endpoints", () => {
    const stops = [
      make(),
      make({ id: "b", lat: 40 }),
      make({ id: "c", lat: 39.8 }),
    ];
    expect(
      new Set(optimize(stops, plan.start, plan.start).map((d) => d.id)),
    ).toEqual(new Set(["a", "b", "c"]));
    expect(optimize(stops, plan.start, { lat: 41, lng: -86 })).toHaveLength(3);
  });
  it("rejects missing locations", () =>
    expect(() =>
      optimize([make({ lat: null, lng: null })], plan.start, null),
    ).toThrow());
  it("does not invent driving durations without roads", () => {
    const result = timeline([make()], plan);
    expect(result.drive).toBeNull();
    expect(result.rows[0].arrival).toBeNull();
    expect(result.total).toBeNull();
  });
  it("adds viewing time, road legs, and return correctly", () => {
    const matrix = {
      durations: [
        [0, 600, 0],
        [600, 0, 900],
        [0, 900, 0],
      ],
      distances: [
        [0, 1000, 0],
        [1000, 0, 2000],
        [0, 2000, 0],
      ],
    };
    const result = timeline([make()], { ...plan, overrides: { a: 8 } }, matrix);
    expect(result.total).toBe(33);
    expect(result.drive).toBe(25);
    expect(result.rows[0].arrival?.toISOString()).toBe(
      "2026-10-19T23:10:00.000Z",
    );
    expect(result.finish?.toISOString()).toBe("2026-10-19T23:33:00.000Z");
    expect(
      timeline([make()], { ...plan, roundTrip: false }, matrix).total,
    ).toBe(15);
    expect(
      timeline(
        [make()],
        { ...plan, roundTrip: false, end: { lat: 40, lng: -86 } },
        matrix,
      ).total,
    ).toBe(30);
  });
  it("segments 20 stops without losing order and includes return", () => {
    const stops = Array.from({ length: 20 }, (_, i) => ({
      lat: 39 + i / 100,
      lng: -86,
    }));
    const urls = navigationSegments(stops, plan.start, plan.start);
    expect(urls).toHaveLength(6);
    let flattened: string[] = [];
    urls.forEach((u, i) => {
      const p = new URL(u).searchParams;
      const waypoints = p.get("waypoints")?.split("|") || [];
      expect(waypoints.length).toBeLessThanOrEqual(3);
      flattened.push(...waypoints, p.get("destination")!);
      if (i)
        expect(p.get("origin")).toBe(
          new URL(urls[i - 1]).searchParams.get("destination"),
        );
      expect(u.length).toBeLessThan(2048);
    });
    expect(flattened).toEqual(
      [...stops, plan.start].map((p) => `${p.lat},${p.lng}`),
    );
  });
  it("excludes private start/end, departure and progress from shared links", () => {
    const decoded = decodeURIComponent(
      sharedTour([make()], {
        ...plan,
        start: { lat: 12.34567, lng: 23.45678 },
        end: { lat: 45.6789, lng: 67.891 },
        progress: 1,
      }),
    );
    expect(decoded).not.toContain("12.34567");
    expect(decoded).not.toContain("45.6789");
    expect(decoded).not.toContain("departure");
    expect(decoded).not.toContain("progress");
  });
  it("fails cleanly on routing errors and disconnected roads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(
      getMatrix([plan.start, { lat: 1, lng: 1 }], "https://example.org"),
    ).rejects.toThrow();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          durations: [
            [0, null],
            [null, 0],
          ],
          distances: [
            [0, 1],
            [1, 0],
          ],
        }),
      }),
    );
    await expect(
      getMatrix([plan.start, { lat: 1, lng: 1 }], "https://example.org"),
    ).rejects.toThrow("Unreachable");
    vi.unstubAllGlobals();
  });
});
