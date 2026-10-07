import { resolveUrl } from "../lib/api";

export default function Lightbox({
  photo,
  onClose,
  onDownload,
  onDelete,
  deleting = false,
}) {
  if (!photo) return null;

  const handleDelete = () => {
    if (window.confirm(`Delete "${photo.filename}" from your gallery?`)) {
      onDelete(photo);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* top bar */}
      <div
        className="flex items-center justify-between px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="max-w-[70%] truncate text-sm text-zinc-300">
          {photo.filename}
        </p>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white transition hover:bg-white/20"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* image */}
      <div
        className="flex flex-1 items-center justify-center overflow-hidden px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={resolveUrl(photo.url)}
          alt={photo.filename}
          className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
        />
      </div>

      {/* bottom bar */}
      <div
        className="flex flex-wrap items-center justify-center gap-3 px-4 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        {photo.score !== undefined && photo.score !== null && (
          <span className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
            {Math.round(photo.score)}% match
          </span>
        )}
        <button
          onClick={() => onDownload(photo)}
          className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          ⬇ Download
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-xl border border-red-500/50 px-5 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "🗑 Delete"}
        </button>
      </div>
    </div>
  );
}
