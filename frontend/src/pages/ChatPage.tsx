import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send, Sparkles } from "lucide-react";
import { api, streamMessage } from "../lib/api";
import { ChatMessage, ChatSession, SourceChunk } from "../types";
import MessageBubble from "../components/MessageBubble";
import clsx from "clsx";

interface Props {
  onSessionCreated: () => void;
}

const STARTERS = [
  "What is your return policy?",
  "How do I reset my password?",
  "Where can I find my order status?",
  "What payment methods do you accept?",
];

export default function ChatPage({ onSessionCreated }: Props) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pendingSources, setPendingSources] = useState<SourceChunk[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setMessages([]);
      return;
    }
    api.chat.getSession(sessionId).then((s: ChatSession) => {
      setSession(s);
      setMessages(s.messages || []);
    }).catch(() => navigate("/chat"));
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startSession() {
    const s: ChatSession = await api.chat.createSession();
    onSessionCreated();
    navigate(`/chat/${s.id}`);
    return s.id;
  }

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    setInput("");

    let sid = sessionId;
    if (!sid) sid = await startSession();

    const userMsg: ChatMessage = {
      role: "user",
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      sources: [],
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);
    setPendingSources([]);

    await streamMessage(
      sid,
      text.trim(),
      (token) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + token,
          };
          return updated;
        });
      },
      (sources) => {
        setPendingSources(sources);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            sources,
          };
          return updated;
        });
      },
      () => setStreaming(false),
      (err) => {
        setStreaming(false);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: `Error: ${err}`,
          };
          return updated;
        });
      }
    );
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const isEmpty = !sessionId || messages.length === 0;

  return (
    <div className="flex flex-col h-screen flex-1 min-w-0">
      {/* Header */}
      <header className="border-b border-ink-100 px-6 py-4 bg-white flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-display font-semibold text-base text-ink-900">
            {isEmpty ? "New Conversation" : session?.id?.slice(0, 8) + "…"}
          </h1>
          <p className="text-xs text-ink-400 mt-0.5">
            {streaming ? "Generating response…" : "Ask anything about your documents"}
          </p>
        </div>
        {streaming && (
          <div className="flex items-center gap-2 text-xs text-sage-500 font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse" />
            Thinking
          </div>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-8 animate-fade-in">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-ink-900 flex items-center justify-center mx-auto mb-4">
                <Sparkles size={20} className="text-white" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-ink-900 mb-2">
                How can I help?
              </h2>
              <p className="text-sm text-ink-400 max-w-xs">
                Ask me anything — I'll search your knowledge base and answer with sources.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left px-3 py-3 rounded-xl border border-ink-100 bg-white
                             text-xs text-ink-600 hover:border-ink-400 hover:text-ink-900
                             transition-all duration-150 leading-relaxed shadow-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={i}
              message={msg}
              isStreaming={streaming && i === messages.length - 1 && msg.role === "assistant"}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-ink-100 bg-white px-6 py-4 shrink-0">
        <div className="flex gap-3 items-end max-w-4xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={streaming}
            className={clsx(
              "flex-1 resize-none input-base py-3 leading-relaxed max-h-36",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
            style={{ minHeight: "44px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 144) + "px";
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            className="btn-primary px-3 py-3 shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-xs text-ink-400 text-center mt-2">
          AI responses may be inaccurate. Always verify critical information.
        </p>
      </div>
    </div>
  );
}
