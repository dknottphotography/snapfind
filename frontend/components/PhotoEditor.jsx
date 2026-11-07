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
      <div className="panel w-full max-w-2xl p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">Edit photo</h3>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-inkdim transition hover:bg-[#17122e]/5 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex max-h-[55vh] items-center justify-center overflow-hidden rounded-lg bg-[#17122e]/[0.04]">
          {loadError ? (
            <p className="p-8 text-sm text-red-300">
              Couldn&apos;t load the image for editing.
            </p>
          ) : !img ? (
            <p className="p-8 text-sm text-inkdim">Loading…</p>
          ) : (
            <canvas ref={canvasRef} className="max-h-[55vh] max-w-full" />
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setRotation((r) => r - 90)}
            disabled={!img}
            className="btn-outline px-4 py-2 text-sm"
          >
            ⟲ Rotate left
          </button>
          <button
            onClick={() => setRotation((r) => r + 90)}
            disabled={!img}
            className="btn-outline px-4 py-2 text-sm"
          >
            ⟳ Rotate right
          </button>
          <button
            onClick={() => setFlipH((f) => !f)}
            disabled={!img}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition disabled:opacity-40 ${
              flipH ? "border-[#0e7490]/50 bg-[#0e7490]/[0.07] text-[#0e7490]" : "border-[#17122e]/20 bg-white text-inkdim hover:border-[#17122e]/45"
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
            className="rounded-lg px-3 py-2 text-sm text-inkdim transition hover:text-ink disabled:opacity-40"
          >
            Reset
          </button>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-inkdim transition hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="btn-solid px-6 py-2 text-sm"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
        <p className="mt-2 text-xs text-inkdim">
          Saving replaces the photo and re-scans it for faces.
        </p>
      </div>
    </div>
  );
}
