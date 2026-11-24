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
            ? "border-[#2DD4BF] bg-[rgba(45,212,191,0.06)]"
            : "border-[rgba(255,255,255,0.25)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(45,212,191,0.5)]"
        }`}
      >
        <span style={{ color: "#2DD4BF" }}>
          <IconUpload size={34} />
        </span>
        <p className="text-sm font-medium" style={{ color: "#F5F2EC" }}>{label}</p>
        <p className="text-xs" style={{ color: "#A8A29A" }}>{hint}</p>
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
        <div className="mt-3 rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: "#A8A29A" }}>
              {files.length} file{files.length > 1 ? "s" : ""} selected
            </p>
            <button
              onClick={clear}
              className="text-xs underline transition hover:text-[#2DD4BF]"
              style={{ color: "#A8A29A" }}
            >
              Clear
            </button>
          </div>
          <ul className="max-h-32 space-y-1 overflow-y-auto text-xs" style={{ color: "#A8A29A" }}>
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
