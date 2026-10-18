import { z } from "zod";
import Papa from "papaparse";
const text = z.string().trim().max(2000);
export const safeUrl = (s: string) => {
  try {
    const u = new URL(s);
    return ["https:", "http:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
};
const source = z.object({
  name: text,
  url: z
    .string()
    .refine((v) => !v || !!safeUrl(v), "Use an http(s) source URL")
    .default(""),
  recordId: text.optional(),
});
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
const hour = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const displaySchema = z
  .object({
    id: text.min(1),
    name: text.min(1),
    address: text.default(""),
    town: text.default(""),
    zip: text.default(""),
    lat: z.number().min(-90).max(90).nullable().default(null),
    lng: z.number().min(-180).max(180).nullable().default(null),
    season: z
      .enum(["Halloween", "Christmas", "Both", "Unknown"])
      .default("Unknown"),
    type: z
      .enum([
        "Residential yard display",
        "Synchronized light show",
        "Home haunt",
        "Business",
        "Attraction",
        "Unknown",
      ])
      .default("Unknown"),
    cost: z
      .enum(["Free", "Paid", "Donation optional", "Unknown"])
      .default("Unknown"),
    access: z
      .enum(["Drive-by", "Walk-through", "Both", "Unknown"])
      .default("Unknown"),
    startDate: date.nullable().default(null),
    endDate: date.nullable().default(null),
    hours: z
      .array(
        z.object({
          days: z.array(z.number().int().min(0).max(6)).min(1),
          open: hour,
          close: hour,
        }),
      )
      .default([]),
    timezone: z
      .string()
      .default("America/Indiana/Indianapolis")
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Invalid timezone"),
    scare: z
      .enum(["Family-friendly", "Mild", "Scary", "Unknown"])
      .default("Unknown"),
    music: z.boolean().nullable().default(null),
    fm: text.default(""),
    viewingMinutes: z.number().min(0).max(180).nullable().default(null),
    accessibility: text.default(""),
    parking: text.default(""),
    sources: z.array(source).default([]),
    lastImported: date.nullable().default(null),
    lastConfirmed: date.nullable().default(null),
    year: z.number().int().min(2000).max(2200).nullable().default(null),
    verification: z.enum(["confirmed", "unverified"]).default("unverified"),
    photos: z
      .array(
        z.object({
          url: z
            .string()
            .refine((v) => !!safeUrl(v), "Use an http(s) image URL"),
          credit: text,
          permission: text.min(1),
          authorized: z.literal(true),
        }),
      )
      .max(10)
      .default([]),
    demo: z.boolean().default(false),
    conflicts: z.array(text).default([]),
  })
  .refine(
    (d) => (d.lat === null) === (d.lng === null),
    "Provide both coordinates",
  )
  .refine(
    (d) => !d.startDate || !d.endDate || d.startDate <= d.endDate,
    "End date precedes start date",
  );
export type Display = z.infer<typeof displaySchema>;
export type Point = { lat: number; lng: number };
export const hasPoint = <T extends { lat: number | null; lng: number | null }>(
  d: T,
): d is T & Point => d.lat !== null && d.lng !== null;
export function status(d: Display, year = new Date().getFullYear()) {
  if (d.year !== null && d.year < year) return "From a previous season";
  return d.verification === "confirmed" &&
    !d.conflicts.length &&
    d.year === year &&
    d.lastConfirmed?.startsWith(String(year))
    ? "Confirmed this season"
    : "Unverified";
}
export function distance(a: Point, b: Point) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) *
      Math.cos(b.lat * r) *
      Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function availability(
  d: Display,
  at: Date,
): "Open" | "Closed" | "Unknown" {
  if (
    !d.hours.length ||
    !d.startDate ||
    !d.endDate ||
    status(
      d,
      Number(
        new Intl.DateTimeFormat("en", {
          timeZone: d.timezone,
          year: "numeric",
        }).format(at),
      ),
    ) !== "Confirmed this season"
  )
    return "Unknown";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: d.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const day = `${parts.year}-${parts.month}-${parts.day}`,
    time = `${parts.hour}:${parts.minute}`;
  const weekday = new Date(day + "T12:00:00Z").getUTCDay();
  if (
    day >= d.startDate &&
    day <= d.endDate &&
    d.hours.some(
      (h) =>
        h.days.includes(weekday) &&
        (h.close > h.open ? time >= h.open && time < h.close : time >= h.open),
    )
  )
    return "Open";
  const prev = new Date(day + "T12:00:00Z");
  prev.setUTCDate(prev.getUTCDate() - 1);
  const pd = prev.toISOString().slice(0, 10);
  if (
    pd >= d.startDate &&
    pd <= d.endDate &&
    d.hours.some(
      (h) =>
        h.close <= h.open &&
        h.days.includes((weekday + 6) % 7) &&
        time < h.close,
    )
  )
    return "Open";
  return "Closed";
}
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(
      /\b(street|road|avenue|drive|lane)\b/g,
      (x) =>
        ({ street: "st", road: "rd", avenue: "ave", drive: "dr", lane: "ln" })[
          x
        ]!,
    )
    .replace(/[^a-z0-9]/g, "");
export function mergeDisplays(records: Display[]) {
  const out: Display[] = [];
  for (const d of records) {
    const old = out.find(
      (a) =>
        a.demo === d.demo &&
        ((a.demo && a.id === d.id) ||
          (!a.demo &&
            ((d.address &&
              normalize(a.address + a.town) ===
                normalize(d.address + d.town)) ||
              (hasPoint(a) &&
                hasPoint(d) &&
                distance(a, d) < 0.025 &&
                normalize(a.name) === normalize(d.name))))),
    );
    if (!old) {
      out.push({ ...d });
      continue;
    }
    const conflicts = [...old.conflicts, ...d.conflicts];
    for (const key of ["startDate", "endDate", "hours"] as const)
      if (JSON.stringify(old[key]) !== JSON.stringify(d[key]))
        conflicts.push(`Conflicting ${key}: review source records`);
    old.conflicts = [...new Set(conflicts)];
    old.sources = [...old.sources, ...d.sources].filter(
      (s, i, a) =>
        a.findIndex(
          (t) =>
            t.url === s.url && t.name === s.name && t.recordId === s.recordId,
        ) === i,
    );
    if (old.conflicts.length) old.verification = "unverified";
  }
  return out;
}
export interface ImportAdapter {
  id: string;
  parse: (raw: string) => Display[];
}
function validate(rows: unknown[]) {
  if (rows.length > 2000) throw Error("Maximum 2,000 records per import");
  const ids = new Set<string>();
  return mergeDisplays(
    rows.map((row, i) => {
      const result = displaySchema.safeParse(row);
      if (!result.success)
        throw Error(
          `Row ${i + 1}: ${result.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`,
        );
      if (ids.has(result.data.id))
        throw Error(`Row ${i + 1}: duplicate ID ${result.data.id}`);
      ids.add(result.data.id);
      return {
        ...result.data,
        lastImported: new Date().toISOString().slice(0, 10),
      };
    }),
  );
}
export const adapters: ImportAdapter[] = [
  {
    id: "json",
    parse: (raw) => {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) throw Error("Expected an array");
      return validate(data);
    },
  },
  {
    id: "csv",
    parse: (raw) => {
      const parsed = Papa.parse<Record<string, string>>(raw, {
        header: true,
        skipEmptyLines: true,
      });
      if (parsed.errors.length) throw Error(parsed.errors[0].message);
      return validate(
        parsed.data.map((row) => {
          const r: Record<string, unknown> = {};
          for (const [k, rawValue] of Object.entries(row)) {
            const v=rawValue.trim();
            if (!v) continue;
            r[k] = ["lat", "lng", "year", "viewingMinutes"].includes(k)
              ? Number(v)
              : ["music", "demo"].includes(k)
                ? v === "true"
                  ? true
                  : v === "false"
                    ? false
                    : null
                : ["hours", "sources", "photos", "conflicts"].includes(k)
                  ? JSON.parse(v)
                  : v;
          }
          return r;
        }),
      );
    },
  },
];
export function extractLocation(raw: string): {
  address: string;
  point?: Point;
} {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    /* retain input */
  }
  const match =
    decoded.match(
      /(?:@|!3d|[?&](?:q|query|ll)=)(-?\d+\.\d+)[,!](?:4d)?(-?\d+\.\d+)/,
    ) || decoded.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
  if (match) {
    const point = { lat: Number(match[1]), lng: Number(match[2]) };
    if (Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180)
      return { address: "", point };
  }
  try {
    const u = new URL(raw);
    return {
      address: u.searchParams.get("query") || u.searchParams.get("q") || "",
    };
  } catch {
    return { address: raw };
  }
}
export function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export const sources = [
  ["FrightMaps", "https://frightmaps.com/discover"],
  ["ChristmasPrism", "https://www.christmasprism.com/"],
  [
    "Indy with Kids · Halloween",
    "https://indywithkids.com/decorated-halloween-houses/",
  ],
  [
    "Indy with Kids · Christmas",
    "https://indywithkids.com/christmas-lights-list-indianapolis-central-indiana/",
  ],
  ["Indy Christmas Lights", "https://indychristmaslights.com/"],
];

