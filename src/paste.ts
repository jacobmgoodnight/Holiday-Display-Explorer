import { displaySchema, extractLocation, type Display } from "./data";

// Blank-line-separated notes with explicit labels keep extraction reviewable.
// Also accepts a two-line name/address discovery. Never execute pasted HTML.
export function parsePastedDisplays(raw: string): Display[] {
  if (raw.length > 100000) throw Error("Paste up to 100,000 characters");
  const blocks = raw
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean);
  if (!blocks.length || blocks.length > 100)
    throw Error("Paste 1–100 displays separated by blank lines");
  return blocks.map((block, i) => {
    const fields: Record<string, string> = {};
    const plain: string[] = [];
    for (const line of block
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)) {
      const match = line.match(
        /^(name|address|town|season|year|source|latitude|longitude|maps):\s*(.*)$/i,
      );
      if (match) fields[match[1].toLowerCase()] = match[2];
      else plain.push(line);
    }
    const name = fields.name || plain[0];
    const found = extractLocation(
      fields.maps || fields.address || plain[1] || "",
    );
    if (!name || !(fields.address || found.address || found.point))
      throw Error(
        `Display ${i + 1}: supply a name and address or Maps coordinates`,
      );
    const season =
      ["Halloween", "Christmas", "Both"].find(
        (s) => s.toLowerCase() === fields.season?.toLowerCase(),
      ) || "Unknown";
    return displaySchema.parse({
      id: crypto.randomUUID(),
      name,
      address: fields.address || found.address,
      town: fields.town || "",
      season,
      year: fields.year ? Number(fields.year) : null,
      lat: fields.latitude
        ? Number(fields.latitude)
        : (found.point?.lat ?? null),
      lng: fields.longitude
        ? Number(fields.longitude)
        : (found.point?.lng ?? null),
      sources: [{ name: "Pasted discovery", url: fields.source || "" }],
    });
  });
}
