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
  Menu,
  MessageSquare,
  ChevronDown,
  Database
} from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  images?: string[]; // Kept in memory but stripped on localstorage
};

type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
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

function generateId() {
  return Math.random().toString(36).substring(2, 11);
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
          className="text-[var(--accent-color)] hover:underline"
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
            <code className="text-[var(--text-primary)]">{segment.content}</code>
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
          <ul key={`${segmentIndex}-${blockIndex}`} className="list-disc">
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
          <ol key={`${segmentIndex}-${blockIndex}`} className="list-decimal">
            {orderedLines.map((line, lineIndex) => (
              <li key={lineIndex}>{renderInlineMarkdown(line.trim().replace(/^\d+\.\s+/, ""))}</li>
            ))}
          </ol>
        );
      }

      if (block.split("\n").every((line) => line.trim().startsWith(">"))) {
        return (
          <blockquote key={`${segmentIndex}-${blockIndex}`} className="border-l-4 border-[var(--border-color)] pl-4 text-[var(--text-secondary)] italic my-2">
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
        <p key={`${segmentIndex}-${blockIndex}`} className="mb-3 whitespace-pre-wrap">
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

function groupSessionsByDate(sessions: ChatSession[]) {
  const grouped: Record<string, ChatSession[]> = {
    "Today": [],
    "Yesterday": [],
    "Previous 7 Days": [],
    "Older": []
  };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOfSevenDaysAgo = startOfToday - (86400000 * 7);

  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  sortedSessions.forEach(session => {
    if (session.updatedAt >= startOfToday) {
      grouped["Today"].push(session);
    } else if (session.updatedAt >= startOfYesterday) {
      grouped["Yesterday"].push(session);
    } else if (session.updatedAt >= startOfSevenDaysAgo) {
      grouped["Previous 7 Days"].push(session);
    } else {
      grouped["Older"].push(session);
    }
  });

  return grouped;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [models, setModels] = useState<string[]>([DEFAULT_MODEL]);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [ngrokUrl, setNgrokUrl] = useState(DEFAULT_URL);
  const [newModelInput, setNewModelInput] = useState("");
  const [theme, setTheme] = useState<ThemeMode>("light");

  // Storage and Session State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [storageUsage, setStorageUsage] = useState<string>("Calculating...");

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

  const calculateStorageUsage = () => {
    let _lsTotal = 0;
    for (const key in localStorage) {
      if (!localStorage.hasOwnProperty(key)) continue;
      _lsTotal += ((localStorage[key].length + key.length) * 2);
    }
    const kb = _lsTotal / 1024;
    setStorageUsage(kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`);
  };

  const clearChatHistory = () => {
    localStorage.removeItem("neural_bridge_sessions");
    setSessions([]);
    setMessages([]);
    setCurrentSessionId(null);
    calculateStorageUsage();
    pushNotification("Local chat history cleared successfully.");
  };

  const deleteSession = (sessionId: string) => {
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    saveSessionsToLocal(updatedSessions);
    
    if (currentSessionId === sessionId) {
      setMessages([]);
      setCurrentSessionId(null);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedSettings = readStoredSettings();
      setModels(storedSettings.models);
      setNgrokUrl(storedSettings.url);
      setSelectedModel(storedSettings.selected);
      setTheme(readStoredTheme());
      
      try {
        const storedSessions = localStorage.getItem("neural_bridge_sessions");
        if (storedSessions) {
          setSessions(JSON.parse(storedSessions));
        }
      } catch (err) {
        console.error("Failed to load sessions from local storage", err);
      }

      calculateStorageUsage();

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
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [input]);

  const saveSessionsToLocal = (newSessions: ChatSession[]) => {
    setSessions(newSessions);
    // Strip images to avoid localStorage bloat
    const stoarageSafeSessions = newSessions.map(session => ({
      ...session,
      messages: session.messages.map(msg => {
        const { images, ...strippedMsg } = msg;
        return strippedMsg; 
      })
    }));
    try {
      localStorage.setItem("neural_bridge_sessions", JSON.stringify(stoarageSafeSessions));
      calculateStorageUsage();
    } catch (err) {
      console.warn("Storage cap hit saving session.", err);
      pushNotification("Local storage is nearly full. Please clear chat history soon.");
    }
  };

  const updateCurrentSession = (updatedMessages: Message[], title?: string) => {
    const now = Date.now();
    let sessionId = currentSessionId;
    let nextTitle = title || "New Chat";
    
    if (updatedMessages.length > 0 && updatedMessages[0].role === "user" && !title && !currentSessionId) {
      nextTitle = updatedMessages[0].content.substring(0, 30) + (updatedMessages[0].content.length > 30 ? "..." : "");
    }

    if (!sessionId) {
      sessionId = generateId();
      setCurrentSessionId(sessionId);
      const newSession: ChatSession = {
        id: sessionId,
        title: nextTitle,
        updatedAt: now,
        messages: updatedMessages
      };
      saveSessionsToLocal([newSession, ...sessions]);
    } else {
      const updatedSessions = sessions.map(session => 
        session.id === sessionId 
          ? { ...session, updatedAt: now, messages: updatedMessages, title: title || session.title } 
          : session
      );
      saveSessionsToLocal(updatedSessions);
    }
  };

  const loadSession = (sessionId: string) => {
    const sessionToLoad = sessions.find(s => s.id === sessionId);
    if (sessionToLoad) {
      setMessages(sessionToLoad.messages);
      setCurrentSessionId(sessionId);
      if (window.innerWidth < 768) {
         setIsSidebarOpen(false);
      }
    }
  };

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
    setCurrentSessionId(null);
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
    updateCurrentSession(newMessages);
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
      const messagesWithReply = [...newMessages, data.message];
      setMessages(messagesWithReply);
      updateCurrentSession(messagesWithReply);
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
  const groupedSessions = groupSessionsByDate(sessions);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-primary)]">
      {/* Notifications */}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="pointer-events-auto flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-600 dark:text-red-400 shadow-lg"
          >
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 leading-6">{notification.message}</p>
            <button
              onClick={() => dismissNotification(notification.id)}
              className="rounded-full p-1 transition hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Sidebar Drawer */}
      <aside
        className={cn(
          "flex flex-col h-full bg-[var(--bg-sidebar)] transition-all duration-300 z-40 fixed md:relative shrink-0",
          isSidebarOpen ? "w-[280px] translate-x-0" : "w-[280px] -translate-x-full md:w-0 md:translate-x-0 overflow-hidden opacity-0 md:opacity-100"
        )}
      >
        <div className="flex flex-col h-full p-4 w-[280px]">
          <div className="flex items-center gap-2 mb-8 mt-2 px-2">
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 md:hidden rounded-full hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-semibold text-[var(--text-primary)] text-lg md:text-sm tracking-wide">Neural Bridge</span>
          </div>

          <button
            onClick={clearConversation}
            className="flex items-center gap-3 bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors px-4 py-3 border border-[var(--border-color)] rounded-full text-sm font-medium text-[var(--text-secondary)] w-max max-w-full shadow-sm mb-6"
          >
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </button>

          <div className="flex-1 overflow-y-auto pr-2 chat-scroll">
            <p className="px-3 text-xs font-semibold text-[var(--text-tertiary)] mb-2 mt-2 uppercase tracking-wider">Recent</p>
            
            {sessions.length === 0 ? (
               <p className="px-3 text-xs italic text-[var(--text-tertiary)] mt-2">No history yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {Object.entries(groupedSessions).map(([groupName, groupSessions]) => {
                  if (groupSessions.length === 0) return null;
                  return (
                    <div key={groupName} className="flex flex-col gap-0.5">
                      <p className="px-3 text-[11px] font-semibold text-[var(--text-tertiary)] mb-1 uppercase opacity-75">{groupName}</p>
                      {groupSessions.map((session) => (
                        <div key={session.id} className="relative group/session flex items-center">
                          <button
                            onClick={() => loadSession(session.id)}
                            className={cn(
                              "flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] transition-colors text-left pr-8",
                              currentSessionId === session.id ? "bg-[var(--accent-bg)] text-[var(--accent-color)] font-medium" : "hover:bg-[var(--bg-surface-hover)]"
                            )}
                          >
                            <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-80" />
                            <span className="truncate">{session.title}</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(session.id);
                            }}
                            className="absolute right-2 p-1.5 opacity-0 group-hover/session:opacity-100 focus:opacity-100 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-all"
                            title="Delete session"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border-color)] flex flex-col gap-1">
             <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                title="Workspace settings"
              >
                <div className="flex items-center gap-3">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </div>
              </button>

            <button
              onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              <div className="flex items-center gap-3">
                {theme === "light" ? <Moon className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
                <span>{theme === "light" ? "Dark Theme" : "Light Theme"}</span>
              </div>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative transition-all duration-300 min-w-0">
        <header className="h-16 flex items-center px-4 shrink-0 gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 -ml-2 rounded-full hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition-colors"
            title="Collapse menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative">
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-[var(--bg-surface-hover)] cursor-pointer text-[var(--text-secondary)] transition-colors"
            >
              <span className="text-lg font-medium tracking-tight text-[var(--text-secondary)]">Neural Bridge</span>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </button>

            {isModelDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsModelDropdownOpen(false)}
                />
                <div className="absolute top-full left-0 mt-1 w-64 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-lg z-50 py-2">
                  <div className="px-3 py-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                    Select Model
                  </div>
                  {models.map((model) => (
                    <button
                      key={model}
                      onClick={() => {
                        handleModelChange(model);
                        setIsModelDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2 text-sm transition-colors",
                        selectedModel === model 
                          ? "bg-[var(--accent-bg)] text-[var(--accent-color)] font-medium" 
                          : "text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
                      )}
                    >
                      {model}
                    </button>
                  ))}
                  <div className="border-t border-[var(--border-color)] mt-2 pt-2">
                    <button
                      onClick={() => {
                         setIsModelDropdownOpen(false);
                         setIsSettingsOpen(true);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                    >
                      Manage models
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto chat-scroll pt-2 pb-32 px-4 md:px-0">
          <div className="max-w-4xl mx-auto w-full flex flex-col justify-start min-h-full">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-start justify-center pt-8 pb-16 px-2 slide-in">
                <div className="w-12 h-12 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-[var(--accent-color)] mb-6 shadow-[var(--shadow-elevation)]">
                   <Sparkles className="h-6 w-6" />
                </div>
                <h1 className="text-4xl sm:text-5xl font-medium tracking-tight mb-2 text-[var(--text-primary)]">
                  <span className="gemini-greeting font-semibold">Hello, there.</span>
                </h1>
                <p className="text-2xl sm:text-3xl font-medium text-[var(--text-tertiary)] max-w-2xl mt-1 leading-tight mb-10">
                  How can I help you today?
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full mt-12">
                  {quickPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(prompt);
                        textareaRef.current?.focus();
                      }}
                      className="text-left bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] transition-colors rounded-xl p-4 md:p-5 h-full min-h-[100px] border border-[var(--border-color)] group"
                    >
                      <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-3 leading-relaxed">
                        {prompt}
                      </p>
                      <div className="mt-4 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="p-1.5 rounded-full bg-[var(--bg-primary)] shadow-sm">
                           <ArrowUp className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                         </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="w-full flex justify-center pb-2">
                 <div className="w-full max-w-3xl flex flex-col gap-6 md:gap-8 px-2 slide-in">
                    {messages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={cn(
                          "w-full flex",
                          message.role === "user" ? "justify-end" : "justify-start"
                        )}
                      >
                        {message.role === "assistant" && (
                          <div className="mr-4 mt-1 shrink-0">
                            <div className="w-8 h-8 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center text-[var(--accent-color)] mt-1">
                              <Sparkles className="h-4 w-4" />
                            </div>
                          </div>
                        )}
                        
                        <div
                          className={cn(
                            "max-w-full md:max-w-[85%] text-[15px] leading-7",
                            message.role === "user"
                              ? "bg-[var(--message-user-bg)] px-5 py-3 rounded-3xl rounded-tr-sm text-[var(--text-primary)] whitespace-pre-wrap"
                              : "text-[var(--text-primary)] pr-2"
                          )}
                        >
                          {message.images?.[0] ? (
                            <div className="mb-3">
                              <Image
                                src={`data:image/jpeg;base64,${message.images[0]}`}
                                alt="Context"
                                width={1200}
                                height={900}
                                unoptimized
                                className="max-h-72 w-auto rounded-xl object-contain bg-black/5 dark:bg-white/5 border border-[var(--border-color)]"
                              />
                            </div>
                          ) : null}

                          <div className={message.role === "assistant" ? "markdown-content" : ""}>
                            {message.role === "assistant" ? renderMarkdown(message.content || " ") : message.content}
                          </div>
                        </div>
                      </div>
                    ))}

                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="mr-4 mt-1 shrink-0">
                           <div className="w-8 h-8 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center text-[var(--accent-color)] mt-1">
                             <Sparkles className="h-4 w-4 animate-pulse" />
                           </div>
                        </div>
                        <div className="text-[var(--text-secondary)] py-2 flex items-center">
                          <div className="typing-dots">
                            <span />
                            <span />
                            <span />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area Docked to Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)] to-transparent pointer-events-none">
          <div className="max-w-4xl mx-auto w-full pointer-events-auto mt-8 md:mt-12">
            
            {pendingImage && (
              <div className="mb-3 mx-4 md:mx-auto max-w-3xl flex items-center gap-3 p-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl w-max shadow-sm slide-in">
                <div className="relative h-12 w-12 rounded-lg overflow-hidden border border-[var(--border-color)]">
                  <Image
                    src={pendingImage.preview}
                    alt="Preview"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <div className="pr-4">
                   <p className="text-xs font-semibold text-[var(--text-primary)] max-w-[150px] truncate">{pendingImage.name}</p>
                   <p className="text-[10px] text-[var(--text-tertiary)]">Attached</p>
                </div>
                <button
                  onClick={() => setPendingImage(null)}
                  className="mr-2 p-1.5 rounded-full hover:bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)] transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="relative max-w-3xl mx-auto flex items-end gap-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[24px] rounded-br-[24px] p-2 shadow-[var(--shadow-elevation)] transition-colors focus-within:border-[var(--text-tertiary)]">
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 p-3 mb-0.5 rounded-full hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition-colors text-xl font-light"
                title="Upload image"
              >
                <Plus className="h-5 w-5 stroke-[2]" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Enter a prompt here"
                className="w-full resize-none bg-transparent py-4 font-normal text-[15px] leading-6 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] max-h-52"
              />

              <div className="shrink-0 pb-1.5 pr-1.5 flex items-center gap-2">
                {input.trim() || pendingImage ? (
                  <button
                    onClick={() => void sendMessage()}
                    disabled={!canSend}
                    className="p-2.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] hover:bg-[var(--text-secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Send message"
                  >
                    <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                  </button>
                ) : (
                  <div className="h-[36px] w-[36px]" />
                )}
              </div>
            </div>
            
            <p className="text-center text-[11px] text-[var(--text-tertiary)] mt-3">
              Neural Bridge local model. Accuracy may vary.
            </p>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm slide-in">
          <div className="w-full max-w-lg bg-[var(--bg-primary)] rounded-2xl shadow-xl overflow-hidden border border-[var(--border-color)] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] shrink-0">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Settings</h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 rounded-full hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-8 overflow-y-auto max-h-[75vh]">
              
              {/* Storage Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                    <Database className="h-4 w-4" />
                    Storage & Data
                  </h3>
                  <span className="text-xs font-semibold px-2 py-1 bg-[var(--bg-surface-hover)] rounded-md text-[var(--text-secondary)]">
                    {storageUsage} Used
                  </span>
                </div>
                
                <p className="text-sm text-[var(--text-tertiary)] mb-2">
                  Chat history is saved locally in your browser. Clearing it will permanently remove past sessions. Image attachments are not saved to prevent size limits.
                </p>
                
                <button
                  onClick={() => {
                    const confirmed = window.confirm("Are you sure you want to clear all chat history?");
                    if (confirmed) {
                       clearChatHistory();
                    }
                  }}
                  className="w-full rounded-xl border border-red-500/30 bg-red-50/50 dark:bg-red-950/20 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
                >
                  Clear all local chat history
                </button>
              </div>

              <hr className="border-[var(--border-color)]" />

              <div className="space-y-3">
                <label className="block font-medium text-[var(--text-primary)]">
                  Backend API URL
                </label>
                <p className="text-sm text-[var(--text-tertiary)] mb-2">Connects to your local model runner.</p>
                <input
                  type="text"
                  value={ngrokUrl}
                  onChange={(event) => {
                    const nextUrl = event.target.value;
                    setNgrokUrl(nextUrl);
                    saveSettings(models, nextUrl, selectedModel);
                  }}
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-tertiary)]"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="block font-medium text-[var(--text-primary)] mb-1">Local Models</h3>
                  <p className="text-sm text-[var(--text-tertiary)]">Manage models installed on your machine.</p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {suggestedModels
                    .filter((model) => !models.includes(model))
                    .map((model) => (
                      <button
                        key={model}
                        onClick={() => addModel(model)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        {model}
                      </button>
                    ))}
                </div>

                <div className="flex gap-2">
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
                    placeholder="E.g. llama3:custom"
                    className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--text-tertiary)]"
                  />
                  <button
                    onClick={() => addModel()}
                    className="rounded-xl bg-[var(--text-primary)] px-4 py-2.5 text-sm font-medium text-[var(--bg-primary)] hover:bg-[var(--text-secondary)] transition-colors shadow-sm"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-2 mt-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                  {models.map((model) => (
                    <div
                      key={model}
                      className="flex items-center justify-between p-3 border-b border-[var(--border-color)] last:border-0"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-sm text-[var(--text-primary)]">{model}</span>
                        {selectedModel === model && (
                          <span className="text-[10px] font-semibold text-[var(--accent-color)] uppercase tracking-wider">Active</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {selectedModel !== model && (
                           <button
                             onClick={() => handleModelChange(model)}
                             className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-md transition-colors"
                           >
                             Use
                           </button>
                        )}
                        <button
                          onClick={() => deleteModel(model)}
                          className="p-1.5 text-[var(--text-tertiary)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-md transition-colors"
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
      )}
    </div>
  );
}
