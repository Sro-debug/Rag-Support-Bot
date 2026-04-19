import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessageSquare, Plus, Trash2, FileText, Users, LogOut, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { ChatSession } from "../types";
import clsx from "clsx";

interface Props {
  onNewChat: () => void;
  refreshKey: number;
}

export default function Sidebar({ onNewChat, refreshKey }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    api.chat.sessions().then(setSessions).catch(console.error);
  }, [refreshKey]);

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await api.chat.deleteSession(id);
    setSessions((s) => s.filter((x) => x.id !== id));
    if (sessionId === id) navigate("/chat");
  }

  return (
    <aside className="w-64 shrink-0 border-r border-ink-100 flex flex-col h-screen bg-white">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-ink-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-ink-900 flex items-center justify-center shrink-0">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M2 12L6 4l3 5 2-3 3 6" stroke="#f5f3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-display font-semibold text-base tracking-tight">SupportAI</span>
        </div>
      </div>

      {/* New Chat */}
      <div className="px-3 pt-4 pb-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                     bg-ink-900 text-white hover:bg-ink-700 transition-colors duration-150"
        >
          <Plus size={14} />
          New conversation
        </button>
      </div>

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
        {sessions.length === 0 && (
          <p className="text-xs text-ink-400 px-3 py-4 text-center">No conversations yet</p>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(`/chat/${s.id}`)}
            className={clsx(
              "w-full flex items-start gap-2 px-3 py-2.5 rounded-lg text-left group transition-colors duration-100",
              sessionId === s.id
                ? "bg-ink-100 text-ink-900"
                : "text-ink-600 hover:bg-ink-50"
            )}
          >
            <MessageSquare size={13} className="mt-0.5 shrink-0 text-ink-400" />
            <span className="flex-1 text-xs truncate leading-relaxed">
              {s.lastMessage || "New conversation"}
            </span>
            <button
              onClick={(e) => deleteSession(s.id, e)}
              className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-500 transition-all p-0.5 rounded"
            >
              <Trash2 size={11} />
            </button>
          </button>
        ))}
      </div>

      {/* Nav links */}
      {user?.role === "admin" && (
        <div className="px-3 py-2 border-t border-ink-100 space-y-0.5">
          <button
            onClick={() => navigate("/documents")}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-ink-500 hover:bg-ink-50 hover:text-ink-900 transition-colors"
          >
            <FileText size={13} />
            Documents
            <ChevronRight size={11} className="ml-auto" />
          </button>
          <button
            onClick={() => navigate("/users")}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-ink-500 hover:bg-ink-50 hover:text-ink-900 transition-colors"
          >
            <Users size={13} />
            Users
            <ChevronRight size={11} className="ml-auto" />
          </button>
        </div>
      )}

      {/* User */}
      <div className="px-4 py-4 border-t border-ink-100 flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-sage-400 flex items-center justify-center text-white text-xs font-medium shrink-0">
          {user?.email?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-ink-900 truncate">{user?.email}</p>
          <p className="text-xs text-ink-400 capitalize">{user?.role}</p>
        </div>
        <button onClick={logout} className="text-ink-400 hover:text-ink-900 transition-colors p-1">
          <LogOut size={13} />
        </button>
      </div>
    </aside>
  );
}
