import { useRef, useState } from "react";

export default function UploadDropzone({
  onFiles,
  multiple = true,
  accept = "image/*",
  label = "Drop images here or click to browse",
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);

  const pick = (list) => {
    const arr = [...list];
    if (!arr.length) return;
    setFiles(multiple ? arr : [arr[0]]);
    onFiles(multiple ? arr : [arr[0]]);
  };

  const clear = () => {
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragOver
            ? "border-fuchsia-400 bg-fuchsia-500/10"
            : "border-white/15 bg-white/5 hover:border-white/30"
        }`}
      >
        <span className="text-3xl">📸</span>
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        <p className="text-xs text-zinc-500">PNG, JPG, JPEG, WEBP</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />

      {files.length > 0 && (
        <div className="mt-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-300">
              {files.length} file{files.length > 1 ? "s" : ""} selected
            </p>
            <button
              onClick={clear}
              className="text-xs text-zinc-400 underline hover:text-white"
            >
              Clear
            </button>
          </div>
          <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-zinc-400">
            {files.map((f, i) => (
              <li key={i} className="truncate">
                {f.name} — {(f.size / 1024 / 1024).toFixed(2)} MB
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
