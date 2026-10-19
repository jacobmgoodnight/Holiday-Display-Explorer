import { z } from "zod";
export const memorySchema = z.object({
  rating: z.number().int().min(0).max(5).default(0),
  comments: z
    .array(
      z.object({
        id: z.string(),
        text: z.string().trim().min(1).max(1000),
        date: z.string(),
      }),
    )
    .max(50)
    .default([]),
  photos: z
    .array(
      z.object({
        id: z.string(),
        image: z
          .string()
          .max(450000)
          .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/),
        caption: z.string().max(200),
      }),
    )
    .max(3)
    .default([]),
});
export type Memory = z.infer<typeof memorySchema>;
export const emptyMemory = (): Memory => ({
  rating: 0,
  comments: [],
  photos: [],
});
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("hde-memories", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("displays");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(Error("Photo storage is unavailable on this browser."));
  });
}
export async function loadMemory(id: string): Promise<Memory> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction("displays")
        .objectStore("displays")
        .get(id);
      request.onsuccess = () => {
        const result = memorySchema.safeParse(request.result || emptyMemory());
        result.success
          ? resolve(result.data)
          : reject(Error("Stored notes could not be read"));
      };
      request.onerror = () => reject(Error("Could not load your notes"));
    });
  } finally {
    db.close();
  }
}
export async function saveMemory(id: string, memory: Memory) {
  const validated = memorySchema.parse(memory);
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("displays", "readwrite");
      tx.objectStore("displays").put(validated, id);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(Error("Could not save. Device storage may be full."));
    });
  } finally {
    db.close();
  }
}
export async function clearMemories() {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("displays", "readwrite");
      tx.objectStore("displays").clear();
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(Error("Could not clear photo storage"));
    });
  } finally {
    db.close();
  }
}
export async function preparePhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error(
      "Choose a JPEG, PNG or WebP photo. On iPhone, export HEIC as JPEG first.",
    );
  if (file.size > 12 * 1024 * 1024)
    throw Error("Choose a photo smaller than 12 MB");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Photo conversion unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // Re-encoding removes EXIF location metadata and bounds local storage use.
    const image = canvas.toDataURL("image/jpeg", 0.7);
    if (image.length > 450000)
      throw Error("Photo is too detailed to store. Choose a smaller image.");
    return image;
  } finally {
    bitmap.close();
  }
}
