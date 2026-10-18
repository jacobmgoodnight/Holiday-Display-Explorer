import {
  availability,
  distance,
  hasPoint,
  type Display,
  type Point,
} from "./data";
export type Matrix = { durations: number[][]; distances: number[][] };
export type Plan = {
  ids: string[];
  start: Point;
  end: Point | null;
  roundTrip: boolean;
  departure: string;
  minutes: number;
  overrides: Record<string, number>;
  name: string;
  progress: number;
};
export function optimize(
  stops: Display[],
  start: Point,
  end: Point | null,
  matrix?: Matrix,
) {
  const points = [start, ...stops.filter(hasPoint), ...(end ? [end] : [])];
  if (stops.some((s) => !hasPoint(s)))
    throw Error("Confirm coordinates for every stop");
  const cost = (a: number, b: number) =>
    matrix ? matrix.durations[a][b] : distance(points[a], points[b]);
  let remaining = stops.map((_, i) => i + 1),
    order: number[] = [],
    last = 0;
  while (remaining.length) {
    remaining.sort((a, b) => cost(last, a) - cost(last, b));
    last = remaining.shift()!;
    order.push(last);
  }
  const score = (o: number[]) =>
    [0, ...o, ...(end ? [points.length - 1] : [])].reduce(
      (sum, n, i, a) => (i ? sum + cost(a[i - 1], n) : 0),
      0,
    );
  for (let pass = 0; pass < 20; pass++) {
    let improved = false;
    for (let i = 0; i < order.length - 1; i++)
      for (let j = i + 1; j < order.length; j++) {
        const candidate = [
          ...order.slice(0, i),
          ...order.slice(i, j + 1).reverse(),
          ...order.slice(j + 1),
        ];
        if (score(candidate) < score(order) - 0.001) {
          order = candidate;
          improved = true;
        }
      }
    if (!improved) break;
  }
  return order.map((i) => stops[i - 1]);
}
const cache = new Map<string, { time: number; data: Matrix }>();
export async function getMatrix(
  points: Point[],
  endpoint: string,
): Promise<Matrix> {
  if (points.length > 22) throw Error("Limit tours to 20 stops");
  const key = JSON.stringify(points);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < 900000) return hit.data;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locations: points.map((p) => [p.lng, p.lat]) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw Error("Routing provider unavailable");
  const data = (await res.json()) as Matrix;
  for (const field of ["durations", "distances"] as const)
    if (
      !Array.isArray(data[field]) ||
      data[field].length !== points.length ||
      data[field].some(
        (r) =>
          !Array.isArray(r) ||
          r.length !== points.length ||
          r.some((v) => typeof v !== "number" || !Number.isFinite(v) || v < 0),
      )
    )
      throw Error("Unreachable stop or invalid road matrix");
  if (cache.size > 20) cache.clear();
  cache.set(key, { time: Date.now(), data });
  return data;
}
export function timeline(stops: Display[], plan: Plan, matrix?: Matrix) {
  let elapsed = 0,
    drive = 0,
    meters = 0;
  const rows = stops.map((d, i) => {
    if (matrix) {
      elapsed += matrix.durations[i][i + 1] / 60;
      drive += matrix.durations[i][i + 1] / 60;
      meters += matrix.distances[i][i + 1];
    }
    const arrival = matrix
      ? new Date(new Date(plan.departure).getTime() + elapsed * 60000)
      : null;
    const viewing = plan.overrides[d.id] ?? d.viewingMinutes ?? plan.minutes;
    elapsed += viewing;
    return {
      d,
      arrival,
      viewing,
      state: arrival ? availability(d, arrival) : "Unknown",
    };
  });
  if (matrix && (plan.roundTrip || plan.end)) {
    drive += matrix.durations[stops.length][stops.length + 1] / 60;
    elapsed += matrix.durations[stops.length][stops.length + 1] / 60;
    meters += matrix.distances[stops.length][stops.length + 1];
  }
  return {
    rows,
    drive: matrix ? drive : null,
    miles: matrix ? meters / 1609.344 : null,
    total: matrix ? elapsed : null,
    viewing: rows.reduce((a, r) => a + r.viewing, 0),
    finish: matrix
      ? new Date(new Date(plan.departure).getTime() + elapsed * 60000)
      : null,
  };
}
const coord = (p: Point) => `${p.lat},${p.lng}`;
export function navigationSegments(
  stops: Point[],
  start: Point,
  end: Point | null,
) {
  const destinations = [...stops, ...(end ? [end] : [])],
    result: string[] = [];
  let origin = start;
  for (let i = 0; i < destinations.length; i += 4) {
    const chunk = destinations.slice(i, i + 4);
    const params = new URLSearchParams({
      api: "1",
      travelmode: "driving",
      origin: coord(origin),
      destination: coord(chunk[chunk.length - 1]),
    });
    if (chunk.length > 1)
      params.set("waypoints", chunk.slice(0, -1).map(coord).join("|"));
    result.push(`https://www.google.com/maps/dir/?${params}`);
    origin = chunk[chunk.length - 1];
  }
  return result;
}
export function sharedTour(stops: Display[], plan: Plan) {
  return (
    "#tour=" +
    encodeURIComponent(
      JSON.stringify({
        version: 1,
        name: plan.name,
        minutes: plan.minutes,
        stops: stops.map(
          ({
            id,
            name,
            address,
            town,
            lat,
            lng,
            season,
            type,
            cost,
            access,
            demo,
            sources,
          }) => ({
            id,
            name,
            address,
            town,
            lat,
            lng,
            season,
            type,
            cost,
            access,
            demo,
            sources,
          }),
        ),
      }),
    )
  );
}
