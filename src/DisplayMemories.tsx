import { useEffect, useState } from "react";
import { emptyMemory, loadMemory, saveMemory, preparePhoto } from "./memories";
export function DisplayMemories({ id, name }: { id: string; name: string }) {
  const [memory, setMemory] = useState(emptyMemory);
  const [comment, setComment] = useState("");
  const [credit, setCredit] = useState("");
  const [ownsPhoto, setOwnsPhoto] = useState(false);
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("Loading your notes…");
  useEffect(() => {
    let live = true;
    loadMemory(id)
      .then((v) => {
        if (live) {
          setMemory(v);
          setReady(true);
          setNotice("");
        }
      })
      .catch((e) => {
        if (live) setNotice(e.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [id]);
  async function persist() {
    setBusy(true);
    try {
      const next = {
        ...memory,
        comments: comment.trim()
          ? [
              ...memory.comments,
              {
                id: crypto.randomUUID(),
                text: comment.trim(),
                date: new Date().toISOString(),
              },
            ]
          : memory.comments,
      };
      await saveMemory(id, next);
      setMemory(next);
      setComment("");
      setNotice("Saved on this device.");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="memories">
      <h3>{name}</h3>
      <p>
        Your rating, comments and photos stay on this device. They are not
        public reviews and are not included in shared tour links. Save changes
        before closing.
      </p>
      <fieldset disabled={busy || !ready}>
        <legend>Your visit</legend>
        <label>
          Your rating
          <select
            value={memory.rating}
            onChange={(e) =>
              setMemory({ ...memory, rating: Number(e.target.value) })
            }
          >
            <option value={0}>Not rated</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)} — {n} of 5
              </option>
            ))}
          </select>
        </label>
        <label>
          Add a comment
          <textarea
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did your family enjoy? Any tips for next time?"
          />
        </label>
        {memory.comments.map((c) => (
          <div className="visit-comment" key={c.id}>
            <small>{new Date(c.date).toLocaleDateString()}</small>
            <p>{c.text}</p>
            <button
              onClick={() =>
                setMemory({
                  ...memory,
                  comments: memory.comments.filter((x) => x.id !== c.id),
                })
              }
            >
              Remove comment
            </button>
          </div>
        ))}
        <label>
          Photo caption / credit
          <input
            maxLength={200}
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={ownsPhoto}
            onChange={(e) => setOwnsPhoto(e.target.checked)}
          />
          I took this photo or have permission to use it.
        </label>
        <label>
          Add a picture (up to 3)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={!ownsPhoto || memory.photos.length >= 3}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              try {
                const image = await preparePhoto(file);
                setMemory((v) => ({
                  ...v,
                  photos: [
                    ...v.photos,
                    { id: crypto.randomUUID(), image, caption: credit },
                  ],
                }));
                setNotice("Picture ready. Save changes to keep it.");
              } catch (err) {
                setNotice((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        <p className="small">
          Photos are resized and location metadata is removed. Browser storage
          can be cleared or evicted.
        </p>
        <div className="memory-photos">
          {memory.photos.map((p) => (
            <figure key={p.id}>
              <img src={p.image} alt={p.caption || `Your photo of ${name}`} />
              <figcaption>{p.caption}</figcaption>
              <button
                onClick={() =>
                  setMemory({
                    ...memory,
                    photos: memory.photos.filter((x) => x.id !== p.id),
                  })
                }
              >
                Remove picture
              </button>
            </figure>
          ))}
        </div>
        <button className="primary" onClick={persist}>
          Save rating, comments & pictures
        </button>
      </fieldset>
      <p role="status">{notice}</p>
    </div>
  );
}
