import { useState, useCallback, useRef, type DragEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useUploadDemo } from "../api/queries";

interface DemoUploadProps {
  onClose: () => void;
}

export function DemoUpload({ onClose }: DemoUploadProps) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const upload = useUploadDemo();

  const handleFile = useCallback(
    (file: File) => {
      upload.mutate(file, {
        onSuccess: (data) => {
          onClose();
          void navigate({ to: "/match/$matchId", params: { matchId: data.matchId } });
        },
      });
    },
    [upload, onClose, navigate],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-lg bg-slate-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Upload Demo</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            &times;
          </button>
        </div>

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragging
              ? "border-team-ct bg-team-ct/10"
              : "border-slate-700 hover:border-slate-500"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".dem"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          {upload.isPending ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-team-ct" />
              <p className="text-sm text-slate-400">Uploading and parsing...</p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-400">
                Drag & drop a .dem file here, or click to browse
              </p>
            </div>
          )}
        </div>

        {upload.isError && (
          <p className="mt-3 text-sm text-red-400">
            Upload failed: {upload.error.message}
          </p>
        )}
      </div>
    </div>
  );
}
