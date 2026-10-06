import { useEffect, useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { getToken } from "../../api/client.js";
import ProtectedImage from "./ProtectedImage.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

/**
 * Photo attach box for posts. Unlike a plain file list, it shows the actual
 * picture as a thumbnail the moment you pick it (straight from the file on
 * your device, so there's no wait), with an X to remove it before posting.
 *
 * Controlled: `files` is [{ id, original_name, size_bytes, previewUrl? }].
 * Each picked image is uploaded right away and its id is what gets sent with
 * the post. Only images are accepted.
 */
export default function PhotoPicker({ files = [], onChange, max = 10, label = "Add photos" }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  // Free the in-browser preview URLs when this picker goes away.
  useEffect(
    () => () => {
      filesRef.current.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    },
    []
  );

  async function uploadOne(file) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/api/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Upload failed.");
    return { id: data.id, original_name: data.originalName, size_bytes: data.sizeBytes, previewUrl: URL.createObjectURL(file) };
  }

  async function handleFiles(fileList) {
    const picked = Array.from(fileList || []);
    if (picked.length === 0) return;
    setError(null);
    const images = picked.filter((f) => f.type.startsWith("image/"));
    if (images.length < picked.length) setError("Only image files (JPG, PNG, WEBP, GIF) can be attached as photos.");
    const room = Math.max(0, max - files.length);
    if (images.length > room) setError(`You can attach up to ${max} photos.`);
    const batch = images.slice(0, room);
    if (batch.length === 0) return;

    setUploading((n) => n + batch.length);
    const added = [];
    for (const file of batch) {
      try {
        added.push(await uploadOne(file));
      } catch (err) {
        setError(err.message || "Upload failed.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (added.length) onChange([...filesRef.current, ...added]);
  }

  function remove(id) {
    const gone = files.find((f) => f.id === id);
    if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
    onChange(files.filter((f) => f.id !== id));
  }

  const canAdd = files.length + uploading < max;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {files.map((f) => (
          <div key={f.id} className="group relative size-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {f.previewUrl ? (
              <img src={f.previewUrl} alt={f.original_name || "Attached photo"} className="size-full object-cover" />
            ) : (
              <ProtectedImage file={f} alt="" className="size-full" />
            )}
            <button
              type="button"
              onClick={() => remove(f.id)}
              aria-label="Remove photo"
              className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-slate-900/70 text-white transition hover:bg-status-danger"
            >
              <X size={13} />
            </button>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`up-${i}`} className="flex size-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
            <Loader2 size={18} className="animate-spin text-brand-blue" />
          </div>
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-brand-blue hover:bg-blue-50 hover:text-brand-blue"
          >
            <ImagePlus size={20} />
            <span className="px-1 text-center text-[11px] font-medium leading-tight">{files.length ? "Add more" : label}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-xs font-medium text-status-danger">{error}</p>}
    </div>
  );
}
