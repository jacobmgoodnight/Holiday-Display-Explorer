import { describe, expect, it } from "vitest";
import { parseFrightMaps } from "../scripts/frightmaps-parser";
const fixture = `<h1>Haunted Houses near Indianapolis (2026)</h1><a class="card" href="/houses/indiana/example" data-haunt-city-name="McCordsville" data-admission="free"><img src="https://example.org/photo.jpg" /><div class="nm">Example House</div><div class="ct">McCordsville, IN · Halloween Haunt</div><span class="haunt-admission">Free admission</span><script>{"lat":39.1,"lng":-86.1}</script></a>`;
describe("FrightMaps public directory adapter", () => {
  it("extracts public discovery facts while keeping exact locations unknown", () => {
    const [d] = parseFrightMaps(fixture);
    expect(d.name).toBe("Example House");
    expect(d.town).toBe("McCordsville");
    expect(d.cost).toBe("Free");
    expect(d.address).toBe("");
    expect(d.lat).toBeNull();
    expect(d.lng).toBeNull();
    expect(d.photos).toEqual([]);
    expect(d.year).toBe(2026);
    expect(d.verification).toBe("unverified");
    expect(d.lastConfirmed).toBeNull();
    expect(d.type).toBe("Unknown");
    expect(d.sources[0].url).toBe(
      "https://frightmaps.com/houses/indiana/example",
    );
  });
  it("does not infer street addresses from a display name or free cost from hidden attributes", () => {
    const [d] = parseFrightMaps(
      fixture
        .replace("Example House", "123 Example Street")
        .replace("Free admission", "Admission not specified"),
    );
    expect(d.address).toBe("");
    expect(d.cost).toBe("Unknown");
  });
  it("rejects changed layouts, duplicates and links outside the expected directory", () => {
    expect(() => parseFrightMaps("<h1>Access denied</h1>")).toThrow();
    expect(() => parseFrightMaps(fixture + fixture)).toThrow("Duplicate");
    expect(() =>
      parseFrightMaps(
        fixture.replace("/houses/indiana/example", "/houses/private/example"),
      ),
    ).toThrow("Unexpected");
  });
});
