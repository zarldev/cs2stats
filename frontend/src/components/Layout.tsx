import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { DemoUpload } from "./DemoUpload";

export function Layout({ children }: { children: ReactNode }) {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-slate-100">
            <span className="text-team-ct">CS2</span>
            <span>Stats</span>
          </Link>
          <button
            onClick={() => setShowUpload(true)}
            className="rounded-md bg-team-ct px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-team-ct-dim"
          >
            Upload Demo
          </button>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      {showUpload && <DemoUpload onClose={() => setShowUpload(false)} />}
    </div>
  );
}
