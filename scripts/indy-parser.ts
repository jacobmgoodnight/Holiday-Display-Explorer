import { load } from "cheerio";
import { displaySchema, type Display } from "../src/data.ts";

export const INDY_GUIDE =
  "https://indywithkids.com/christmas-lights-list-indianapolis-central-indiana/";
export function parseIndyGuide(html: string): Display[] {
  const $ = load(html);
  const title = $("h1").first().text();
  const year = Number(title.match(/\b(20\d{2})\b/)?.[1]);
  if (!year || !/Christmas/i.test(title))
    throw Error("Guide title or season year changed; manual review required");
  const cards = $("article.light-card");
  if (!cards.length || cards.length > 2000)
    throw Error("Guide layout changed; no valid cards");
  const ids = new Set<string>();
  return cards.toArray().map((card) => {
    const c = $(card);
    const link = c.find(".light-title a");
    const url = new URL(link.attr("href") || "", INDY_GUIDE);
    if (
      url.origin !== "https://indywithkids.com" ||
      !url.pathname.startsWith("/light_display/")
    )
      throw Error("Unexpected listing link");
    const id = url.pathname.split("/").filter(Boolean).at(-1)!;
    const recordId = c.find("[data-id]").attr("data-id") || id;
    if (ids.has(id)) throw Error("Duplicate source ID");
    ids.add(id);
    const address = c
      .find(".light-address-small")
      .text()
      .trim()
      .replace(/\s+/g, " ");
    if (!address) throw Error("Listing has no address; review layout");
    const parts = address.split(",").map((p) => p.trim());
    const town =
      parts.length > 1
        ? parts[1].replace(/\s+(?:IN|INDIANA)\b.*$/i, "").trim()
        : "";
    const closed = /CLOSED UNTIL|Unavailable/i.test(c.text());
    return displaySchema.parse({
      id,
      name: link.text().trim(),
      address,
      town,
      zip: address.match(/\b\d{5}(?:-\d{4})?\b/)?.[0] || "",
      season: "Christmas",
      year,
      cost: c.find(".paid-flag-img").length ? "Paid" : "Unknown",
      verification: "unverified",
      lastConfirmed: null,
      sources: [{ name: "Indy with Kids", url: url.href, recordId }],
      conflicts: closed
        ? [
            `Source marks this display closed/unavailable in its ${year} guide. Check the original listing.`,
          ]
        : [],
    });
  });
}

// Only explicit taxonomy and field values; no copied editorial text or images.
export function enrichIndyDisplay(d: Display, html: string): Display {
  const $ = load(html);
  const article = $("article.light_display");
  if (article.length !== 1) throw Error("Detail layout changed");
  const classes = (article.attr("class") || "").split(/\s+/);
  const has = (s: string) => classes.includes(s);
  const music = has("features-musical-synchronized") ? true : null;
  const residential = has("display_type-residential");
  const type = residential
    ? music
      ? "Synchronized light show"
      : "Residential yard display"
    : has("display_type-commercial")
      ? "Attraction"
      : d.type;
  const cost = has("display_type-free")
    ? "Free"
    : has("display_type-paid")
      ? "Paid"
      : d.cost;
  const interaction = $(".det-group")
    .filter((_, el) => $(el).find(".det-label").text().trim() === "Interaction")
    .text();
  const drive = /Drive[- ]?(?:by|through|thru)/i.test(interaction);
  const walk = /Walk[- ]?(?:through|thru)/i.test(interaction);
  const fm =
    article
      .find("strong")
      .filter((_, el) => $(el).text().trim() === "Radio Frequency:")
      .parent()
      .text()
      .match(/Radio Frequency:\s*(\d{2,3}(?:\.\d)?)/)?.[1] || "";
  return displaySchema.parse({
    ...d,
    type,
    cost,
    music,
    fm,
    access:
      drive && walk
        ? "Both"
        : drive
          ? "Drive-by"
          : walk
            ? "Walk-through"
            : "Unknown",
  });
}
