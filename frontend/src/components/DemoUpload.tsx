import { useState, useCallback, useRef, type DragEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Upload, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUploadDemo } from "../api/queries";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface DemoUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DemoUpload({ open, onOpenChange }: DemoUploadProps) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const upload = useUploadDemo();
  const [progress, setProgress] = useState(0);

  const handleFile = useCallback(
    (file: File) => {
      setProgress(0);
      // simulate progress while uploading
      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + Math.random() * 15, 90));
      }, 300);

      upload.mutate(file, {
        onSuccess: (data) => {
          clearInterval(interval);
          setProgress(100);
          toast.success("Demo uploaded", {
            description: `${file.name} parsed successfully`,
            action: {
              label: "View Match",
              onClick: () => {
                void navigate({
                  to: "/matches/$matchId",
                  params: { matchId: data.matchId },
                });
              },
            },
          });
          setTimeout(() => {
            onOpenChange(false);
            setProgress(0);
            upload.reset();
          }, 800);
        },
        onError: (err) => {
          clearInterval(interval);
          setProgress(0);
          toast.error("Upload error", {
            description: err.message,
          });
        },
      });
    },
    [upload, onOpenChange, navigate],
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Demo</DialogTitle>
          <DialogDescription>
            Upload a CS2 .dem file to parse match data
          </DialogDescription>
        </DialogHeader>

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors",
            dragging
              ? "border-team-ct bg-team-ct/10"
              : "border-border hover:border-muted-foreground/50",
          )}
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
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-team-ct" />
              <p className="text-sm text-muted-foreground">
                Uploading and parsing...
              </p>
              {/* progress bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-team-ct transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {dragging ? (
                <FileUp className="h-8 w-8 text-team-ct" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  Drag & drop a .dem file here
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  or click to browse
                </p>
              </div>
            </div>
          )}
        </div>

        {upload.isError && (
          <p className="text-sm text-destructive">
            {upload.error.message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
