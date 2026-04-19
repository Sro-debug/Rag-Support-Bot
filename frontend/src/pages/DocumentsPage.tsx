import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Trash2, FileText, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { Document } from "../types";

type Status = { type: "success" | "error"; message: string } | null;

export default function DocumentsPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => { api.documents.list().then(setDocs).catch(console.error); }, []);

  async function handleUpload(file: File) {
    if (!file || file.type !== "application/pdf") {
      setStatus({ type: "error", message: "Only PDF files are supported" });
      return;
    }
    setUploading(true);
    setStatus(null);
    try {
      const doc: Document = await api.documents.upload(file);
      setDocs((d) => [doc, ...d]);
      setStatus({ type: "success", message: `"${doc.originalName}" ingested — ${doc.chunkCount} chunks created` });
    } catch (err: any) {
      setStatus({ type: "error", message: err.message });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await api.documents.delete(id);
    setDocs((d) => d.filter((x) => x.id !== id));
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto">
      {/* Header */}
      <header className="border-b border-ink-100 px-6 py-4 bg-white flex items-center gap-4 shrink-0">
        <button onClick={() => navigate("/chat")} className="btn-ghost px-2">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="font-display font-semibold text-base">Knowledge Base</h1>
          <p className="text-xs text-ink-400">Upload PDFs to train the support bot</p>
        </div>
      </header>

      <div className="p-6 max-w-3xl mx-auto w-full space-y-6">
        {/* Upload zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleUpload(file);
          }}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
            ${dragging
              ? "border-ink-900 bg-ink-50"
              : "border-ink-200 hover:border-ink-400 hover:bg-ink-50"
            }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-ink-400 animate-spin" />
              <p className="text-sm text-ink-500">Processing PDF…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-ink-100 flex items-center justify-center">
                <Upload size={20} className="text-ink-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink-900">Drop a PDF here</p>
                <p className="text-xs text-ink-400 mt-1">or click to browse · up to 50 MB</p>
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        {status && (
          <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm animate-slide-up
            ${status.type === "success"
              ? "bg-green-50 border border-green-100 text-green-800"
              : "bg-red-50 border border-red-100 text-red-700"
            }`}>
            {status.type === "success"
              ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
            {status.message}
          </div>
        )}

        {/* Document list */}
        <div>
          <h2 className="text-xs font-medium text-ink-400 uppercase tracking-wider mb-3">
            Indexed Documents ({docs.length})
          </h2>
          {docs.length === 0 ? (
            <div className="card p-8 text-center">
              <FileText size={24} className="text-ink-300 mx-auto mb-3" />
              <p className="text-sm text-ink-400">No documents uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.id} className="card px-4 py-3 flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                    <FileText size={14} className="text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900 truncate">{doc.originalName}</p>
                    <p className="text-xs text-ink-400 mt-0.5">
                      {doc.chunkCount} chunks · uploaded by {doc.uploadedBy} ·{" "}
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id, doc.originalName)}
                    className="opacity-0 group-hover:opacity-100 btn-ghost text-red-400 hover:text-red-600 px-2 py-1.5 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
