import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { adapters, displaySchema, mergeDisplays } from "./data";
import { demo } from "./demo";
describe("publication and examples", () => {
  it("validates the reviewed site dataset and homeowner contact before publishing real records", () => {
    const raw = JSON.parse(
      readFileSync("public/data/displays.json", "utf8").replace(/^\uFEFF/, ""),
    );
    const rows = raw.map((d: unknown) => displaySchema.parse(d));
    expect(new Set(rows.map((d: { id: string }) => d.id)).size).toBe(
      rows.length,
    );
    if (rows.some((d: { demo: boolean }) => !d.demo)) {
      const config = JSON.parse(
        readFileSync("public/config.json", "utf8").replace(/^\uFEFF/, ""),
      );
      expect(config.contactEmail).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    }
  });
  it("keeps all six fictional examples distinct", () =>
    expect(mergeDisplays(demo)).toHaveLength(6));
  it("validates example imports", () => {
    for (const ext of ["json", "csv"])
      expect(
        adapters
          .find((a) => a.id === ext)!
          .parse(
            readFileSync(`examples/displays.${ext}`, "utf8").replace(
              /^\uFEFF/,
              "",
            ),
          ),
      ).toHaveLength(1);
  });
  it("rejects duplicate IDs and unapproved photos", () => {
    expect(() =>
      adapters[0].parse('[{"id":"a","name":"A"},{"id":"a","name":"B"}]'),
    ).toThrow("duplicate ID");
    expect(() =>
      displaySchema.parse({
        id: "a",
        name: "A",
        photos: [
          {
            url: "https://example.org/photo.jpg",
            credit: "Test",
            permission: "",
            authorized: false,
          },
        ],
      }),
    ).toThrow();
  });
  it("preserves unknown classifications rather than guessing", () => {
    const d = displaySchema.parse({ id: "a", name: "A" });
    expect(d.season).toBe("Unknown");
    expect(d.type).toBe("Unknown");
  });
});
