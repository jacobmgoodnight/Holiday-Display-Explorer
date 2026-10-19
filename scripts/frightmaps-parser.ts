import { load } from "cheerio";
import { displaySchema, type Display } from "../src/data.ts";

export const FRIGHTMAPS_METRO = "https://frightmaps.com/metro/indianapolis";

/** Public directory cards only. Never recover locations from scripts, images or names. */
export function parseFrightMaps(html: string): Display[] {
  const $ = load(html);
  const title = $("h1").first().text();
  const year = Number(title.match(/\b(20\d{2})\b/)?.[1]);
  if (!/Indianapolis/i.test(title) || !year)
    throw Error("FrightMaps guide title changed");
  const cards = $('a.card[href^="/houses/"]');
  if (!cards.length || cards.length > 2000)
    throw Error("FrightMaps directory layout changed");
  const ids = new Set<string>();
  return cards.toArray().map((element) => {
    const card = $(element);
    const url = new URL(card.attr("href")!, FRIGHTMAPS_METRO);
    if (
      url.origin !== "https://frightmaps.com" ||
      !url.pathname.startsWith("/houses/indiana/")
    )
      throw Error("Unexpected FrightMaps listing link");
    const id = url.pathname.slice("/houses/".length).replaceAll("/", ":");
    if (ids.has(id)) throw Error("Duplicate FrightMaps listing");
    ids.add(id);
    const town =
      card.attr("data-haunt-city-name")?.trim() ||
      card.find(".ct").text().split(",")[0].trim();
    if (!town) throw Error("FrightMaps town is missing");
    const admission = card.find(".haunt-admission").text().trim();
    return displaySchema.parse({
      id,
      name: card.find(".nm").text().trim(),
      town,
      season: "Halloween",
      year,
      cost: /^Free admission$/i.test(admission)
        ? "Free"
        : /^Paid admission$/i.test(admission)
          ? "Paid"
          : "Unknown",
      // Generic "Halloween Haunt" does not establish residential vs paid attraction.
      type: "Unknown",
      address: "",
      lat: null,
      lng: null,
      verification: "unverified",
      lastConfirmed: null,
      sources: [{ name: "FrightMaps", url: url.href, recordId: id }],
      conflicts: [
        "City-level discovery only. Open the source listing and confirm the location before adding it to a driving tour. Guide year does not confirm operation.",
      ],
    });
  });
}
