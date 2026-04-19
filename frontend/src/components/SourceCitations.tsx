import { useState } from "react";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import { SourceChunk } from "../types";

export default function SourceCitations({ sources }: { sources: SourceChunk[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  if (!sources.length) return null;

  return (
    <div className="mt-3 space-y-1">
      <p className="text-xs font-medium text-ink-400 uppercase tracking-wider mb-2">
        Sources ({sources.length})
      </p>
      {sources.map((s, i) => (
        <div key={i} className="border border-ink-100 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-ink-50 transition-colors"
          >
            <FileText size={12} className="text-sage-500 shrink-0" />
            <span className="text-xs text-ink-600 font-medium flex-1 truncate">{s.filename}</span>
            <span className="text-xs text-ink-400 font-mono shrink-0">
              {Math.round(s.score * 100)}%
            </span>
            {expanded === i ? (
              <ChevronUp size={12} className="text-ink-400 shrink-0" />
            ) : (
              <ChevronDown size={12} className="text-ink-400 shrink-0" />
            )}
          </button>
          {expanded === i && (
            <div className="px-3 pb-3 pt-1 border-t border-ink-100 bg-ink-50">
              <p className="text-xs text-ink-600 leading-relaxed line-clamp-5">{s.chunk}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
