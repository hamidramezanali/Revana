import { useRef, useState } from "react";

// Re-encoding pixels removes embedded metadata before upload; the server repeats it.
async function preparePhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG or WebP photo. Convert HEIC photos to JPG first.");
  if (file.size > 10_000_000) throw new Error("Choose a photo smaller than 10 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 20_000_000) throw new Error("This photo is too large. Try a smaller version.");
    let scale = Math.min(1, 1536 / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 3; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser could not prepare the photo.");
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL("image/jpeg", .85);
      if (result.length <= 2_000_000) return result;
      scale *= .75;
    }
    throw new Error("Try a smaller photo.");
  } finally { bitmap.close(); }
}

export function PhotoAnswer({ mode, photos, onChange, busy, onPreparing }: {
  mode: "products" | "skin" | "hair";
  photos: string[];
  onChange: (photos: string[]) => void;
  busy: boolean;
  onPreparing: (preparing: boolean) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    if (files.length + photos.length > 3) { setError("Choose up to three photos in total."); return; }
    setPreparing(true); onPreparing(true);
    try {
      const additions = [];
      for (const file of Array.from(files)) additions.push(await preparePhoto(file));
      onChange([...photos, ...additions]);
    } catch (error) { setError(error instanceof Error ? error.message : "The photo could not be opened. Try another JPG or PNG."); }
    finally { setPreparing(false); onPreparing(false); if (picker.current) picker.current.value = ""; if (camera.current) camera.current.value = ""; }
  };
  const disabled = busy || preparing;
  return <section className="photo-answer" aria-label="Optional photo answer">
    <h3>Add photos <span>Optional · up to 3</span></h3>
    <p>{mode === "products" ? "Show the product front or ingredient label. Keep small print clear." : mode === "skin" ? "A clear photo of the area can help describe what’s visible. Avoid identifying details." : "Show the hair or scalp area you want to discuss, in clear light."}</p>
    <input ref={picker} className="photo-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} aria-label="Choose answer photos" onChange={event => void add(event.target.files)} />
    <input ref={camera} className="photo-file-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={disabled} aria-label="Take an answer photo" onChange={event => void add(event.target.files)} />
    <div className="photo-picker-buttons"><button className="button secondary" type="button" disabled={disabled || photos.length >= 3} onClick={() => picker.current?.click()}>Choose photos</button><button className="button secondary" type="button" disabled={disabled || photos.length >= 3} onClick={() => camera.current?.click()}>Take a photo</button></div>
    {!!photos.length && <div className="photo-previews">{photos.map((photo, index) => <div key={photo}><img src={photo} alt={`Selected answer photo ${index + 1}`} /><button type="button" disabled={disabled} aria-label={`Remove photo ${index + 1}`} onClick={() => onChange(photos.filter((_, position) => position !== index))}>Remove</button></div>)}</div>}
    {preparing && <p role="status">Preparing photo…</p>}
    {error && <p className="agent-error" role="alert">{error}</p>}
    <p className="photo-privacy">Photos stay in this draft until you submit. You’ll review the coach’s observations; Revana does not save the images. Pictures cannot establish symptoms or a diagnosis.</p>
  </section>;
}
