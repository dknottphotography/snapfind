import { useEffect, useRef, useState } from "react";
import { resolveUrl } from "../lib/api";

// Simple client-side photo editor: rotate + flip, then save.
// The parent uploads the resulting file via editPhotoAdmin().
export default function PhotoEditor({ photo, onClose, onSave, saving }) {
  const canvasRef = useRef(null);
  const [img, setImg] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [rotation, setRotation] = useState(0); // 0 | 90 | 180 | 270
  const [flipH, setFlipH] = useState(false);

  useEffect(() => {
    setImg(null);
    setLoadError(false);
    setRotation(0);
    setFlipH(false);
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => setImg(im);
    im.onerror = () => setLoadError(true);
    im.src = resolveUrl(photo.url);
  }, [photo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const rot = ((rotation % 360) + 360) % 360;
    const swap = rot === 90 || rot === 270;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    canvas.width = swap ? h : w;
    canvas.height = swap ? w : h;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, 1);
    ctx.drawImage(img, -w / 2, -h / 2);
    ctx.restore();
  });

  const dirty = rotation !== 0 || flipH;

  const handleSave = () => {
    if (!dirty || !canvasRef.current) return;
    canvasRef.current.toBlob(
      (blob) => {
        if (blob) onSave(new File([blob], "edited.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Edit photo</h3>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex max-h-[55vh] items-center justify-center overflow-hidden rounded-xl bg-black/50">
          {loadError ? (
            <p className="p-8 text-sm text-red-300">
              Couldn&apos;t load the image for editing.
            </p>
          ) : !img ? (
            <p className="p-8 text-sm text-zinc-400">Loading…</p>
          ) : (
            <canvas ref={canvasRef} className="max-h-[55vh] max-w-full" />
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setRotation((r) => r - 90)}
            disabled={!img}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/15 disabled:opacity-40"
          >
            ⟲ Rotate left
          </button>
          <button
            onClick={() => setRotation((r) => r + 90)}
            disabled={!img}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/15 disabled:opacity-40"
          >
            ⟳ Rotate right
          </button>
          <button
            onClick={() => setFlipH((f) => !f)}
            disabled={!img}
            className={`rounded-xl px-4 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-40 ${
              flipH ? "bg-fuchsia-500/25 text-fuchsia-200" : "bg-white/10 text-zinc-200"
            }`}
          >
            ⇄ Flip
          </button>
          <button
            onClick={() => {
              setRotation(0);
              setFlipH(false);
            }}
            disabled={!dirty}
            className="rounded-xl px-3 py-2 text-sm text-zinc-400 hover:text-white disabled:opacity-40"
          >
            Reset
          </button>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Saving replaces the photo and re-scans it for faces.
        </p>
      </div>
    </div>
  );
}
