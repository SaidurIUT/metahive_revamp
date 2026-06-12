import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Loader2,
  MessageCircle,
  PanelRightClose,
  PanelRightOpen,
  Send,
  X,
} from "lucide-react";

interface FloatingChatProps {
  onSendChat: () => void;
  chatInput: string;
  setChatInput: (input: string) => void;
  chatResponse: string;
  chatLoading: boolean;
  chatError: string | null;
  variant?: "floating" | "sidebar";
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

const FloatingChat: React.FC<FloatingChatProps> = ({
  onSendChat,
  chatInput,
  setChatInput,
  chatResponse,
  chatLoading,
  chatError,
  variant = "floating",
  isOpen,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(variant === "sidebar");
  const [lastPrompt, setLastPrompt] = useState("");
  const open = isOpen ?? internalOpen;

  const setOpen = (nextOpen: boolean) => {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = chatInput.trim();

    if (!prompt || chatLoading) return;

    setLastPrompt(prompt);
    onSendChat();
    setChatInput("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const renderMessageText = (message: string) => {
    return message
      .trim()
      .split(/\n{2,}/)
      .filter(Boolean)
      .map((block, index) => {
        const cleanedBlock = block.replace(/\*\*/g, "");
        const lines = cleanedBlock
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const isList =
          lines.length > 1 && lines.every((line) => /^[-*]\s+/.test(line));

        if (isList) {
          return (
            <ul key={index} className="list-disc space-y-1 pl-4">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  {line.replace(/^[-*]\s+/, "").replace(/\*/g, "")}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap">
            {cleanedBlock.replace(/\*/g, "")}
          </p>
        );
      });
  };

  const ChatPanel = ({ floating = false }: { floating?: boolean }) => (
    <section
      className={[
        "flex min-h-0 flex-col overflow-hidden rounded-md border border-slate-700/80 bg-slate-950 text-slate-100 shadow-2xl",
        floating ? "h-[520px] max-h-[calc(100vh-2rem)] w-[360px]" : "h-full w-full",
      ].join(" ")}
      aria-label="AI chat"
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-500/15 text-blue-300">
            <Bot size={17} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">AI Chat</h2>
            <p className="truncate text-xs text-slate-400">MetaHive assistant</p>
          </div>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          title={variant === "sidebar" ? "Collapse AI chat" : "Close AI chat"}
          aria-label={variant === "sidebar" ? "Collapse AI chat" : "Close AI chat"}
          onClick={() => setOpen(false)}
          className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          {variant === "sidebar" ? (
            <PanelRightClose size={17} />
          ) : (
            <X size={17} />
          )}
        </Button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-950 px-3 py-4">
        {!lastPrompt && !chatResponse && !chatLoading && !chatError && (
          <div className="rounded-md border border-dashed border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-400">
            No messages yet.
          </div>
        )}

        {lastPrompt && (
          <article className="ml-auto max-w-[88%] rounded-md border border-blue-400/20 bg-blue-500/15 px-3 py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase text-blue-200">
              You
            </p>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-100">
              {lastPrompt}
            </p>
          </article>
        )}

        {chatLoading && (
          <article className="max-w-[88%] rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
            <p className="mb-2 text-[11px] font-semibold uppercase text-slate-400">
              AI
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Loader2 size={16} className="animate-spin" />
              Thinking
            </div>
          </article>
        )}

        {chatError && (
          <article className="max-w-[88%] rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm leading-6 text-red-100">
            {chatError}
          </article>
        )}

        {chatResponse && !chatLoading && (
          <article className="max-w-[92%] rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
            <p className="mb-2 text-[11px] font-semibold uppercase text-slate-400">
              AI
            </p>
            <div className="space-y-3 text-sm leading-6 text-slate-100">
              {renderMessageText(chatResponse)}
            </div>
          </article>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-slate-800 bg-slate-900 p-3"
      >
        <div className="overflow-hidden rounded-md border border-slate-700 bg-slate-950 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400">
          <textarea
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI"
            rows={3}
            disabled={chatLoading}
            className="block min-h-[76px] w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
          />
          <div className="flex items-center justify-end border-t border-slate-800 px-2 py-2">
            <Button
              type="submit"
              size="icon"
              title="Send message"
              aria-label="Send message"
              disabled={!chatInput.trim() || chatLoading}
              className="h-8 w-8 rounded-md bg-emerald-500 text-white hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400"
            >
              {chatLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );

  if (variant === "sidebar") {
    return (
      <aside className="sticky top-24 h-[calc(100vh-8rem)] min-h-[560px] w-full">
        {open ? (
          <ChatPanel />
        ) : (
          <button
            type="button"
            title="Open AI chat"
            aria-label="Open AI chat"
            onClick={() => setOpen(true)}
            className="flex h-full w-full items-start justify-center rounded-md border border-slate-700 bg-slate-900 px-2 py-3 text-slate-300 shadow-lg transition-colors hover:bg-slate-800 hover:text-white"
          >
            <PanelRightOpen size={20} />
          </button>
        )}
      </aside>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <ChatPanel floating />
      ) : (
        <Button
          size="icon"
          title="Open AI chat"
          aria-label="Open AI chat"
          onClick={() => setOpen(true)}
          className="h-12 w-12 rounded-full bg-emerald-500 text-white shadow-lg hover:bg-emerald-400"
        >
          <MessageCircle size={24} />
        </Button>
      )}
    </div>
  );
};

export default FloatingChat;
