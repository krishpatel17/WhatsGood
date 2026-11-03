"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error("Could not read this photo. Try a JPEG or PNG.")),
      "image/jpeg",
      0.85,
    ),
  );
}
export function ScanForm() {
  const [name, setName] = useState("");
  const [source, setSource] = useState<"photo" | "url">("photo");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const created = useRef<{ name: string; id: string } | null>(null);
  useEffect(() => {
    let live = true;
    const id = new URLSearchParams(location.search).get("r");
    if (!id) {
      setLoading(false);
      return;
    }
    setExisting(true);
    api
      .restaurant(id)
      .then((r) => {
        if (live) {
          setName(r.name);
          created.current = { name: r.name, id: r.id };
        }
      })
      .catch(() => {
        if (live) {
          setLoadError(true);
          setStatus(
            "Couldn’t load this restaurant. Close and reopen the scanner to try again.",
          );
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !name.trim() ||
      busy ||
      loading ||
      loadError ||
      (source === "photo" && !file)
    )
      return;
    setBusy(true);
    setStatus("Reading the menu…");
    try {
      const photo = source === "photo" ? await toJpeg(file!) : null;
      if (!created.current || created.current.name !== name.trim()) {
        const restaurant = await api.createRestaurant(
          name.trim(),
          source === "photo"
            ? "Added from a menu photo"
            : "Added from a menu link",
        );
        created.current = { name: name.trim(), id: restaurant.id };
      }
      const result = photo
        ? await api.scan(created.current.id, photo)
        : await api.importMenu(created.current.id, url);
      if (result.status !== "active") {
        setStatus(
          result.message ??
            "We couldn’t read every dish. Try another photo or menu link.",
        );
        return;
      }
      location.href = `/results/?r=${created.current.id}`;
    } catch (e) {
      setStatus(
        e instanceof Error
          ? e.message
          : "Couldn’t import this menu. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <p className="sub">
        Bring the menu to the table. We’ll read its dishes and prices.
      </p>
      <fieldset disabled={busy || loading || loadError} className="form-fields">
        <fieldset>
          <legend>
            Restaurant name{" "}
            <span className={`status-pill${name.trim() ? "" : " required"}`}>
              {name.trim() ? "✓ Active" : "Required"}
            </span>
          </legend>
          <input
            type="search"
            aria-label="Restaurant name"
            placeholder="Restaurant name"
            readOnly={existing}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </fieldset>
        <fieldset>
          <legend>
            Menu source <span className="status-pill required">Required</span>
          </legend>
          <div className="source-switch scan-switch" aria-label="Import method">
            <button
              type="button"
              aria-pressed={source === "photo"}
              onClick={() => setSource("photo")}
            >
              Photo
            </button>
            <button
              type="button"
              aria-pressed={source === "url"}
              onClick={() => setSource("url")}
            >
              Web or PDF link
            </button>
          </div>
          {source === "photo" ? (
            <div className="upload-zone">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M4 7h4l2-3h4l2 3h4v13H4z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <h3>{file ? file.name : "A clear photo is all it takes"}</h3>
              <p className="field-help">
                Include dish names and prices. JPEG, PNG or a supported phone
                photo.
              </p>
              <div className="upload-actions">
                <label className="button secondary file-control">
                  Take a photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/heic,image/heif"
                    capture="environment"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      setStatus("");
                    }}
                  />
                </label>
                <label className="button secondary file-control">
                  Upload photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/heic,image/heif"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      setStatus("");
                    }}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="url-field">
              <label htmlFor="menu-url">Menu page or PDF URL</label>
              <input
                id="menu-url"
                type="url"
                placeholder="https://restaurant.com/menu.pdf"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="field-help">
                Paste a public web page, ordering page or PDF link. For a paper
                menu, use a photo.
              </p>
            </div>
          )}
        </fieldset>
      </fieldset>
      <div className="form-footer">
        <button
          className="button block"
          disabled={
            busy ||
            loading ||
            loadError ||
            !name.trim() ||
            (source === "photo" ? !file : !url.trim())
          }
        >
          {busy ? (
            <>
              <span className="spinner" /> Reading menu…
            </>
          ) : (
            "Find What’s Good"
          )}
        </button>
        {status && (
          <p className="notice" role="status">
            {status}
          </p>
        )}
      </div>
    </form>
  );
}
