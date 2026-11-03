"use client";
import { useState } from "react";
import { api } from "../../lib/api";

/** Draws the photo onto a canvas and re-encodes it as JPEG (iPhone HEIC photos become JPEG). */
async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("could not read photo"))), "image/jpeg", 0.85));
}

export default function Scan() {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file || !name.trim()) return;
    setStatus("Reading the menu…");
    try {
      const created = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"}/restaurants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), address: "Added from a menu photo" }),
      }).then((r) => r.json());
      const result = await api.scan(created.id, await toJpeg(file));
      if (result.status === "retake") return setStatus(result.message);
      if (result.status !== "active") return setStatus("We couldn't read every dish. Try another photo.");
      location.href = `/results/?r=${created.id}`;
    } catch {
      setStatus("Something went wrong. Try again.");
    }
  };

  return (
    <>
      <h1>Scan the menu</h1>
      <p className="sub">Not listed yet? Take a photo of the menu or the specials board.</p>
      <input type="search" aria-label="Restaurant name" placeholder="Restaurant name" value={name} onChange={(e) => setName(e.target.value)} />
      <p>
        <label className="button block">
          Take a photo
          <input type="file" accept="image/jpeg,image/png,image/heic,image/heif" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} disabled={!name.trim()} />
        </label>
      </p>
      {status && (
        <p className="notice" role="status">
          {status}
        </p>
      )}
    </>
  );
}
