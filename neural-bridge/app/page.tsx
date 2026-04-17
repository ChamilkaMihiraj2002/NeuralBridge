"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowUp,
  Bot,
  CircleAlert,
  Image as ImageIcon,
  Moon,
  Plus,
  Settings,
  Sparkles,
  SunMedium,
  Trash2,
  X,
} from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
};

type PendingImage = {
  data: string;
  preview: string;
  name: string;
};

type ThemeMode = "light" | "dark";

type Notification = {
  id: number;
  message: string;
};

type MarkdownSegment =
  | { type: "text"; content: string }
  | { type: "code"; content: string; language: string };

const DEFAULT_MODEL = "llama3.2:3b";
const DEFAULT_URL = "https://tragedy-linseed-handclap.ngrok.app";

const quickPrompts = [
  "Summarize the latest customer feedback into clear product actions.",
  "Review this idea and point out technical risks before we build it.",
  "Explain the attached image and suggest what to do next.",
];

const suggestedModels = ["llama3.2:3b", "llama3.1:8b", "qwen2.5:7b", "mistral:7b"];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function readStoredSettings() {
  try {
    const savedModels = localStorage.getItem("local_llm_models");
    const savedUrl = localStorage.getItem("local_llm_url");
    const savedSelected = localStorage.getItem("local_llm_selected");

    const parsedModels =
      savedModels && Array.isArray(JSON.parse(savedModels)) && JSON.parse(savedModels).length > 0
        ? JSON.parse(savedModels)
        : [DEFAULT_MODEL];

    return {
      models: parsedModels as string[],
      url: savedUrl || DEFAULT_URL,
      selected: savedSelected || (parsedModels[0] as string),
      error: "",
    };
  } catch {
    return {
      models: [DEFAULT_MODEL],
      url: DEFAULT_URL,
      selected: DEFAULT_MODEL,
      error: "Saved settings could not be loaded, so defaults were restored.",
    };
  }
}

function readStoredTheme(): ThemeMode {
  try {
    const savedTheme = localStorage.getItem("neural_bridge_theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }
  } catch {}

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function parseMarkdownSegments(content: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  const fenceRegex = /```([\w-]+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;

  for (const match of content.matchAll(fenceRegex)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({
        type: "text",
        content: content.slice(lastIndex, index),
      });
    }

    segments.push({
      type: "code",
      language: match[1] ?? "",
      content: match[2].replace(/\n$/, ""),
    });

    lastIndex = index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({
      type: "text",
      content: content.slice(lastIndex),
    });
  }

  return segments.length > 0 ? segments : [{ type: "text", content }];
}

function renderInlineMarkdown(content: string) {
  const parts = content.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);

  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="markdown-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="markdown-link"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

function renderMarkdown(content: string) {
  const segments = parseMarkdownSegments(content);

  return segments.map((segment, segmentIndex) => {
    if (segment.type === "code") {
      return (
        <div key={segmentIndex} className="markdown-code-block">
          <div className="markdown-code-header">
            <span>{segment.language || "code"}</span>
          </div>
          <pre>
            <code>{segment.content}</code>
          </pre>
        </div>
      );
    }

    const blocks = segment.content
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean);

    return blocks.map((block, blockIndex) => {
      if (block.startsWith("# ")) {
        return (
          <h1 key={`${segmentIndex}-${blockIndex}`} className="markdown-h1">
            {renderInlineMarkdown(block.slice(2))}
          </h1>
        );
      }

      if (block.startsWith("## ")) {
        return (
          <h2 key={`${segmentIndex}-${blockIndex}`} className="markdown-h2">
            {renderInlineMarkdown(block.slice(3))}
          </h2>
        );
      }

      if (block.startsWith("### ")) {
        return (
          <h3 key={`${segmentIndex}-${blockIndex}`} className="markdown-h3">
            {renderInlineMarkdown(block.slice(4))}
          </h3>
        );
      }

      const unorderedLines = block
        .split("\n")
        .filter((line) => /^[-*]\s+/.test(line.trim()));
      if (unorderedLines.length > 0 && unorderedLines.length === block.split("\n").length) {
        return (
          <ul key={`${segmentIndex}-${blockIndex}`} className="markdown-list">
            {unorderedLines.map((line, lineIndex) => (
              <li key={lineIndex}>{renderInlineMarkdown(line.trim().replace(/^[-*]\s+/, ""))}</li>
            ))}
          </ul>
        );
      }

      const orderedLines = block
        .split("\n")
        .filter((line) => /^\d+\.\s+/.test(line.trim()));
      if (orderedLines.length > 0 && orderedLines.length === block.split("\n").length) {
        return (
          <ol key={`${segmentIndex}-${blockIndex}`} className="markdown-list markdown-ordered">
            {orderedLines.map((line, lineIndex) => (
              <li key={lineIndex}>{renderInlineMarkdown(line.trim().replace(/^\d+\.\s+/, ""))}</li>
            ))}
          </ol>
        );
      }

      if (block.split("\n").every((line) => line.trim().startsWith(">"))) {
        return (
          <blockquote key={`${segmentIndex}-${blockIndex}`} className="markdown-quote">
            {block
              .split("\n")
              .map((line) => line.replace(/^>\s?/, ""))
              .map((line, lineIndex) => (
                <p key={lineIndex}>{renderInlineMarkdown(line)}</p>
              ))}
          </blockquote>
        );
      }

      return (
        <p key={`${segmentIndex}-${blockIndex}`} className="markdown-paragraph">
          {block.split("\n").map((line, lineIndex) => (
            <span key={lineIndex}>
              {renderInlineMarkdown(line)}
              {lineIndex < block.split("\n").length - 1 ? <br /> : null}
            </span>
          ))}
        </p>
      );
    });
  });
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [models, setModels] = useState<string[]>([DEFAULT_MODEL]);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [ngrokUrl, setNgrokUrl] = useState(DEFAULT_URL);
  const [newModelInput, setNewModelInput] = useState("");
  const [theme, setTheme] = useState<ThemeMode>("light");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const notificationIdRef = useRef(0);

  const pushNotification = (message: string) => {
    const id = notificationIdRef.current++;

    setNotifications((current) => [...current, { id, message }]);

    window.setTimeout(() => {
      setNotifications((current) => current.filter((notification) => notification.id !== id));
    }, 5000);
  };

  const dismissNotification = (id: number) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedSettings = readStoredSettings();
      setModels(storedSettings.models);
      setNgrokUrl(storedSettings.url);
      setSelectedModel(storedSettings.selected);
      setTheme(readStoredTheme());
      if (storedSettings.error) {
        pushNotification(storedSettings.error);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("neural_bridge_theme", theme);
  }, [theme]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, [input]);

  const saveSettings = (newModels: string[], url: string, selected: string) => {
    localStorage.setItem("local_llm_models", JSON.stringify(newModels));
    localStorage.setItem("local_llm_url", url);
    localStorage.setItem("local_llm_selected", selected);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64String = result.split(",")[1];

      setPendingImage({
        data: base64String,
        preview: result,
        name: file.name,
      });
    };
    reader.readAsDataURL(file);

    event.target.value = "";
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    saveSettings(models, ngrokUrl, model);
  };

  const addModel = (modelName?: string) => {
    const nextModel = (modelName ?? newModelInput).trim();
    if (!nextModel || models.includes(nextModel)) return;

    const updatedModels = [...models, nextModel];
    setModels(updatedModels);
    setSelectedModel(nextModel);
    saveSettings(updatedModels, ngrokUrl, nextModel);
    setNewModelInput("");
  };

  const deleteModel = (modelToDelete: string) => {
    const updatedModels = models.filter((model) => model !== modelToDelete);

    if (updatedModels.length === 0) {
      const fallbackModels = [DEFAULT_MODEL];
      setModels(fallbackModels);
      setSelectedModel(DEFAULT_MODEL);
      saveSettings(fallbackModels, ngrokUrl, DEFAULT_MODEL);
      return;
    }

    const nextSelectedModel =
      selectedModel === modelToDelete ? updatedModels[0] : selectedModel;

    setModels(updatedModels);
    setSelectedModel(nextSelectedModel);
    saveSettings(updatedModels, ngrokUrl, nextSelectedModel);
  };

  const clearConversation = () => {
    setMessages([]);
  };

  const sendMessage = async () => {
    if ((!input.trim() && !pendingImage) || isLoading) return;

    const newMessage: Message = {
      role: "user",
      content: input.trim(),
      ...(pendingImage && { images: [pendingImage.data] }),
    };

    const newMessages = [...messages, newMessage];
    setMessages(newMessages);
    setInput("");
    setPendingImage(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: ngrokUrl,
          model: selectedModel,
          messages: newMessages,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        pushNotification(err.error || "Something went wrong while contacting the model.");
        return;
      }

      const data = await response.json();
      setMessages((prev) => [...prev, data.message]);
    } catch (error) {
      console.error("Failed to send message", error);
      pushNotification("The app could not connect to the local API. Check the backend URL and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextareaKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const canSend = Boolean(input.trim() || pendingImage) && !isLoading;

  return (
    <div className="relative h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)] shadow-[0_18px_36px_var(--shadow-strong)] backdrop-blur"
          >
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 leading-6">{notification.message}</p>
            <button
              onClick={() => dismissNotification(notification.id)}
              className="rounded-full p-1 text-[var(--danger)]/80 transition hover:bg-black/5 hover:text-[var(--danger)]"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-8%] h-72 w-72 rounded-full bg-[var(--glow-primary)] blur-3xl" />
        <div className="absolute right-[-8%] top-[8%] h-80 w-80 rounded-full bg-[var(--glow-secondary)] blur-3xl" />
        <div className="absolute bottom-[-12%] left-[18%] h-96 w-96 rounded-full bg-[var(--glow-tertiary)] blur-3xl" />
        <div className="grid-pattern absolute inset-0 opacity-60" />
      </div>

      <div className="relative mx-auto flex h-full w-full max-w-[1440px] flex-col px-3 py-3 sm:px-4 lg:px-6">
        <header className="glass-panel z-30 flex shrink-0 flex-col gap-4 rounded-[24px] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="accent-button flex h-12 w-12 items-center justify-center rounded-2xl text-[var(--accent-contrast)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                Neural Bridge
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                  Neural Bridge
                </h1>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-[var(--control-border)] bg-[var(--control-bg)] px-4 text-sm font-medium text-[var(--text)] shadow-[0_12px_32px_var(--shadow-soft)] transition hover:-translate-y-0.5 hover:bg-[var(--control-hover)]"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <SunMedium className="h-4 w-4" />
              )}
            </button>

            <label className="flex min-w-[220px] flex-1 items-center gap-3 rounded-2xl border border-[var(--control-border)] bg-[var(--control-bg)] px-4 py-3 text-sm shadow-[0_12px_32px_var(--shadow-soft)] backdrop-blur md:flex-none">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Model
              </span>
              <select
                value={selectedModel}
                onChange={(event) => handleModelChange(event.target.value)}
                className="w-full bg-transparent text-sm font-medium text-[var(--text)] outline-none"
              >
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-[var(--control-border)] bg-[var(--control-bg)] px-4 text-sm font-medium text-[var(--text)] shadow-[0_12px_32px_var(--shadow-soft)] transition hover:-translate-y-0.5 hover:bg-[var(--control-hover)]"
            >
              <Settings className="mr-2 h-4 w-4" />
              Workspace
            </button>
          </div>
        </header>

        <div className="mt-3 grid min-h-0 flex-1 overflow-hidden gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="glass-panel hidden min-h-0 flex-col gap-3 overflow-hidden rounded-[24px] p-4 sm:p-5 lg:flex">
            <div className="accent-card rounded-[24px] p-5">
              <div className="flex items-center justify-between">
                <div className="rounded-2xl bg-white/12 p-3 backdrop-blur">
                  <Bot className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-[var(--accent-text-muted)]">
                  Connected to {selectedModel}
                </span>
              </div>
              <h2 className="mt-5 text-xl font-semibold tracking-[-0.02em]">
                Fast local reasoning, wrapped in a friendlier workspace.
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--accent-text-muted)]">
                Use the prompt composer below or start with a guided idea to keep
                momentum when the chat is empty.
              </p>
            </div>
            <div className="surface-card rounded-[24px] p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text)]">Session</p>
                <button
                  onClick={clearConversation}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--control-hover)] hover:text-[var(--text)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[var(--card-bg)] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Messages
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                    {messages.length}
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--card-bg)] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Backend
                  </p>
                  <p className="mt-2 truncate text-sm font-medium text-[var(--text)]">
                    {ngrokUrl.replace(/^https?:\/\//, "")}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <section className="glass-panel flex min-h-0 flex-col overflow-hidden rounded-[24px] p-3 sm:p-4">
            <div className="flex items-center justify-between rounded-[20px] border border-[var(--control-border)] bg-[var(--panel-muted)] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">Conversation</p>
                <p className="text-sm text-[var(--muted)]">
                  Replies are sent through your configured local backend.
                </p>
              </div>
              <div className="rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--success)]">
                {isLoading ? "Thinking" : "Ready"}
              </div>
            </div>
            <div className="chat-scroll mt-3 min-h-0 flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-1 pb-10 pt-2 sm:px-4">
                  <div className="rounded-[24px] border border-dashed border-[var(--control-border)] bg-[var(--empty-bg)] px-6 py-8 text-left">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[var(--control-hover)] text-[var(--accent)] shadow-[0_16px_34px_var(--shadow-soft)]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <h2 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-3xl">
                      Start chatting
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-[15px]">
                      Ask a question, paste a draft, or attach an image. The conversation
                      area will stay in the same place once replies start coming in.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      {quickPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => setInput(prompt)}
                          className="rounded-full border border-[var(--control-border)] bg-[var(--control-bg)] px-4 py-2 text-sm font-medium text-[var(--text)] shadow-[0_10px_22px_var(--shadow-soft)] transition hover:-translate-y-0.5 hover:bg-[var(--control-hover)]"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-1 pb-10 pt-2 sm:px-4">
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={cn(
                        "flex w-full",
                        message.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "message-shell max-w-[92%] px-4 py-4 sm:max-w-[80%]",
                          message.role === "user"
                            ? "user-message text-white"
                            : "assistant-message text-[var(--text)]",
                        )}
                      >
                        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-current/60">
                          <span>{message.role === "user" ? "You" : selectedModel}</span>
                        </div>

                        {message.images?.[0] ? (
                          <Image
                            src={`data:image/jpeg;base64,${message.images[0]}`}
                            alt="Uploaded context"
                            width={1200}
                            height={900}
                            unoptimized
                            className="mb-3 max-h-80 w-full rounded-2xl object-cover"
                          />
                        ) : null}

                        <div className="markdown-content text-[15px] leading-7">
                          {renderMarkdown(message.content || " ")}
                        </div>
                      </div>
                    </div>
                  ))}

                  {isLoading ? (
                    <div className="flex justify-start">
                      <div className="assistant-message message-shell px-4 py-4 text-sm text-[var(--muted)]">
                        <div className="flex items-center gap-3">
                          <div className="typing-dots">
                            <span />
                            <span />
                            <span />
                          </div>
                          Thinking through your request...
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="sticky bottom-0 mt-3">
              <div className="mx-auto w-full max-w-4xl rounded-[28px] border border-[var(--control-border)] bg-[var(--panel-muted)] p-4 shadow-[0_18px_42px_var(--shadow-soft)] backdrop-blur">
              {pendingImage ? (
                <div className="mb-4 flex items-center justify-between rounded-2xl border border-[var(--control-border)] bg-[var(--panel)] px-3 py-3">
                  <div className="flex items-center gap-3">
                    <Image
                      src={pendingImage.preview}
                      alt="Attachment preview"
                      width={56}
                      height={56}
                      unoptimized
                      className="h-14 w-14 rounded-2xl object-cover"
                    />
                    <div>
                      <p className="text-sm font-medium text-[var(--text)]">
                        {pendingImage.name}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        Image ready to send with your next message
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPendingImage(null)}
                    className="rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--control-hover)] hover:text-[var(--text)]"
                    aria-label="Remove selected image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--control-border)] bg-[var(--panel)] text-[var(--muted)] transition hover:-translate-y-0.5 hover:bg-[var(--control-hover)] hover:text-[var(--text)]"
                    title="Upload image"
                  >
                    <ImageIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="relative flex-1">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder="Message your local model..."
                    className="min-h-[56px] w-full resize-none rounded-[24px] border border-[var(--control-border)] bg-[var(--panel)] px-4 py-4 pr-16 text-[15px] leading-6 text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--control-border-strong)] focus:bg-[var(--control-hover)]"
                  />
                  <div className="pointer-events-none absolute bottom-3 right-4 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                    Enter to send
                  </div>
                </div>

                <button
                  onClick={() => void sendMessage()}
                  disabled={!canSend}
                  className="accent-button inline-flex h-14 items-center justify-center rounded-[22px] px-5 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/16">
                    <ArrowUp className="h-4 w-4 stroke-[2.4]" />
                  </span>
                  Send
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]">
                <span>Shift + Enter adds a new line.</span>
                <span>Images are attached to the next message only.</span>
              </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {isSettingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl rounded-[32px] p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                  Workspace settings
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">
                  Manage your backend and model list
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
                  Keep the connection details close by, but out of the way when you are
                  focused on the conversation.
                </p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--control-hover)] hover:text-[var(--text)]"
                aria-label="Close settings"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-6">
              <div className="surface-card rounded-[24px] p-5">
                <label className="block text-sm font-semibold text-[var(--text)]">
                  Backend URL
                </label>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  The app will call `{ngrokUrl.endsWith("/api/chat") ? ngrokUrl : `${ngrokUrl}/api/chat`}`.
                </p>
                <input
                  type="text"
                  value={ngrokUrl}
                  onChange={(event) => {
                    const nextUrl = event.target.value;
                    setNgrokUrl(nextUrl);
                    saveSettings(models, nextUrl, selectedModel);
                  }}
                  className="mt-4 w-full rounded-2xl border border-[var(--control-border)] bg-[var(--control-bg)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--control-border-strong)] focus:bg-[var(--control-hover)]"
                />
              </div>

              <div className="surface-card rounded-[24px] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">Saved models</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Pick one in the header or add new local models here.
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--card-bg)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
                    {models.length} total
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {suggestedModels
                    .filter((model) => !models.includes(model))
                    .map((model) => (
                      <button
                        key={model}
                        onClick={() => addModel(model)}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--control-hover)]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {model}
                      </button>
                    ))}
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={newModelInput}
                    onChange={(event) => setNewModelInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addModel();
                      }
                    }}
                    placeholder="Add a custom model name"
                    className="w-full rounded-2xl border border-[var(--control-border)] bg-[var(--control-bg)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--control-border-strong)] focus:bg-[var(--control-hover)]"
                  />
                  <button
                    onClick={() => addModel()}
                    className="accent-button inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add model
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {models.map((model) => (
                    <div
                      key={model}
                      className="flex flex-col gap-3 rounded-2xl border border-[var(--control-border)] bg-[var(--card-bg)] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--text)]">{model}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                          {selectedModel === model ? "Active model" : "Available"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleModelChange(model)}
                          className="rounded-full px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--control-hover)]"
                        >
                          Use
                        </button>
                        <button
                          onClick={() => deleteModel(model)}
                          className="rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--control-hover)] hover:text-[var(--text)]"
                          aria-label={`Delete ${model}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
