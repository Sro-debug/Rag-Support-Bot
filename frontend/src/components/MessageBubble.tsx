import ReactMarkdown from "react-markdown";
import { ChatMessage } from "../types";
import SourceCitations from "./SourceCitations";
import clsx from "clsx";

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={clsx("flex gap-3 animate-slide-up", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={clsx(
          "w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-medium mt-0.5",
          isUser
            ? "bg-ink-900 text-white"
            : "bg-sage-400 text-white"
        )}
      >
        {isUser ? "U" : "AI"}
      </div>

      {/* Bubble */}
      <div className={clsx("max-w-[75%] space-y-1", isUser && "items-end flex flex-col")}>
        <div
          className={clsx(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-ink-900 text-ink-50 rounded-tr-sm"
              : "bg-white border border-ink-100 text-ink-900 rounded-tl-sm shadow-sm"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className={clsx("prose-chat", isStreaming && !message.content && "typing-cursor")}>
              {message.content ? (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p>{children}</p>,
                    code: ({ children }) => <code>{children}</code>,
                    pre: ({ children }) => <pre>{children}</pre>,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              ) : (
                <span className="typing-cursor" />
              )}
              {isStreaming && message.content && (
                <span className="typing-cursor" />
              )}
            </div>
          )}
        </div>

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && !isStreaming && (
          <div className="w-full">
            <SourceCitations sources={message.sources} />
          </div>
        )}

        {/* Timestamp */}
        <p className="text-xs text-ink-400 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
