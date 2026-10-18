import { displaySchema } from "./data";
const places = [
  ["Lantern Lane", "New Palestine", 39.724, -85.889, "Halloween"],
  ["The Merry & Bright House", "Greenfield", 39.786, -85.777, "Christmas"],
  ["Pumpkin Porch", "McCordsville", 39.898, -85.925, "Halloween"],
  ["A Little North Pole", "Indianapolis", 39.825, -86.087, "Christmas"],
  ["Moonlight Manor", "New Palestine", 39.741, -85.921, "Halloween"],
  ["Twinkle Together", "Greenfield", 39.801, -85.801, "Christmas"],
];
export const demo = places.map(([name, town, lat, lng, season], i) =>
  displaySchema.parse({
    id: `demo-${i}`,
    name,
    town,
    lat,
    lng,
    season,
    address: "Illustrative map point · not a real display",
    demo: true,
    cost: i === 4 ? "Unknown" : "Free",
    access: i === 4 ? "Walk-through" : "Drive-by",
    type:
      i === 4
        ? "Home haunt"
        : i === 1
          ? "Synchronized light show"
          : "Residential yard display",
    scare: i === 4 ? "Scary" : "Family-friendly",
    music: i === 1,
    viewingMinutes: 5,
    sources: [{ name: "Original demonstration data", url: "" }],
  }),
);
