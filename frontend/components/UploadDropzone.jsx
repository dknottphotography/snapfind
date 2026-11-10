import { useRef, useState } from "react";
import { IconUpload } from "./icons";

export default function UploadDropzone({
  onFiles,
  multiple = true,
  accept = "image/*",
  label = "Drop images here or click to browse",
  hint = "PNG, JPG, JPEG, WEBP",
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
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition ${
          dragOver
            ? "border-[#0D9488] bg-[#0D9488]/[0.06]"
            : "border-[#17122e]/25 bg-white hover:border-[#0D9488]/50"
        }`}
      >
        <span className="text-[#0D9488]">
          <IconUpload size={34} />
        </span>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-inkdim">{hint}</p>
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
        <div className="glass mt-3 rounded-2xl p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-inkdim">
              {files.length} file{files.length > 1 ? "s" : ""} selected
            </p>
            <button
              onClick={clear}
              className="text-xs text-inkdim underline hover:text-bio-cyan"
            >
              Clear
            </button>
          </div>
          <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-inkdim">
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
