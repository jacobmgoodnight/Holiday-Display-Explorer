import { describe, it, expect } from "vitest";
import { parseIndyGuide, enrichIndyDisplay } from "../scripts/indy-parser";
import { parsePastedDisplays } from "./paste";
import { memorySchema } from "./memories";
import { status } from "./data";

const guide = `<h1>Christmas Lights | 2025</h1><article class="light-card"><h2 class="light-title"><a href="https://indywithkids.com/light_display/test/">Example &amp; Lights</a></h2><button data-id="123"></button><div class="light-address-small">123 Example Rd, Greenfield, IN, 46140</div><div class="light-snippet">Do not copy this description</div><img src="https://example.org/no-permission.jpg" /></article>`;
describe("authorized guide parsing", () => {
  it("extracts only factual fields with stable IDs and the source year", () => {
    const [d] = parseIndyGuide(guide);
    expect(d.id).toBe("test");
    expect(d.sources[0].recordId).toBe("123");
    expect(d.name).toBe("Example & Lights");
    expect(d.town).toBe("Greenfield");
    expect(d.zip).toBe("46140");
    expect(d.year).toBe(2025);
    expect(status(d, 2026)).toBe("From a previous season");
    expect(d.lastConfirmed).toBeNull();
    expect(d.verification).toBe("unverified");
    expect(d.photos).toEqual([]);
    expect(d.type).toBe("Unknown");
    expect(d.lat).toBeNull();
    expect(JSON.stringify(d)).not.toContain("Do not copy");
  });
  it("fails closed on changed layout, unsafe links, missing year and duplicate cards", () => {
    expect(() => parseIndyGuide("<html>Blocked</html>")).toThrow();
    expect(() => parseIndyGuide(guide.replace("2025", ""))).toThrow();
    expect(() =>
      parseIndyGuide(
        guide.replace(
          "https://indywithkids.com/light_display/test/",
          "https://evil.test/",
        ),
      ),
    ).toThrow();
    expect(() => parseIndyGuide(guide + guide)).toThrow("Duplicate");
  });
  it("retains closure warnings and uses only explicit classifications", () => {
    const [d] = parseIndyGuide(
      guide.replace("</article>", "Unavailable</article>"),
    );
    expect(d.conflicts[0]).toContain("closed");
    const next = enrichIndyDisplay(
      d,
      '<article class="light_display display_type-free display_type-residential features-musical-synchronized"><span class="status-badge">Verified / Active</span><span class="last-verified">N/A</span><div><strong>Radio Frequency:</strong> 99.9</div></article>',
    );
    expect(next.cost).toBe("Free");
    expect(next.type).toBe("Synchronized light show");
    expect(next.fm).toBe("99.9");
    expect(next.verification).toBe("unverified");
    expect(next.access).toBe("Unknown");
  });
});
describe("paste review", () => {
  it("parses multiple notes without inventing dates or coordinates", () => {
    const rows = parsePastedDisplays(
      "My lights\n123 Example Road\nTown: Greenfield\nSeason: Christmas\nYear: 2025\n\nOther lights\n456 Example Road",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].year).toBe(2025);
    expect(rows[1].season).toBe("Unknown");
    expect(rows[0].lat).toBeNull();
    expect(rows[0].lastConfirmed).toBeNull();
  });
  it("rejects unsafe source URLs, invalid coordinates and empty discoveries", () => {
    expect(() => parsePastedDisplays("")).toThrow();
    expect(() =>
      parsePastedDisplays(
        "Test\n123 Example Road\nSource: javascript:alert(1)",
      ),
    ).toThrow();
    expect(() =>
      parsePastedDisplays(
        "Test\n123 Example Road\nLatitude: 100\nLongitude: 0",
      ),
    ).toThrow();
  });
});
describe("personal contributions", () => {
  it("bounds ratings, comments and photos, excluding executable SVG", () => {
    expect(memorySchema.parse({ rating: 5 }).rating).toBe(5);
    expect(() => memorySchema.parse({ rating: 6 })).toThrow();
    expect(() =>
      memorySchema.parse({
        photos: [{ id: "a", image: "data:image/svg+xml,<svg/>", caption: "" }],
      }),
    ).toThrow();
    expect(() =>
      memorySchema.parse({
        comments: [{ id: "a", text: "x".repeat(1001), date: "2026-10-18" }],
      }),
    ).toThrow();
  });
});
