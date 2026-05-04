import { useState, useCallback, useRef, useEffect } from "react";
import "./LearningSession.css";

interface Annotation {
  word: string;
  context: string;
  definitionNo: string;
  definitionEn: string;
  status: "loading" | "ready" | "failed";
  showEnglish: boolean;
  color: string;
  wordX: number;
  wordY: number;
  bubbleX: number;
  bubbleY: number;
}

const BUBBLE_HEIGHT_ESTIMATE = 90;
const BUBBLE_WIDTH = 260;
const MARGIN_GAP = 28;

const ANNOTATION_COLORS = [
  "#e63946",
  "#f77f00",
  "#06a77d",
  "#0077b6",
  "#7209b7",
  "#588157",
  "#d62828",
  "#2a9d8f",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedParagraph(
  text: string,
  annotations: Annotation[]
): React.ReactNode {
  if (annotations.length === 0) return text;
  const colorByWord = new Map<string, string>();
  annotations.forEach((a) => colorByWord.set(a.word.toLowerCase(), a.color));
  const words = [...colorByWord.keys()].map(escapeRegExp);
  const pattern = new RegExp(`\\b(${words.join("|")})\\b`, "gi");

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const color = colorByWord.get(match[0].toLowerCase());
    parts.push(
      <span
        key={`${match.index}-${match[0]}`}
        style={{ borderBottom: `2px solid ${color}`, paddingBottom: "1px" }}
      >
        {match[0]}
      </span>
    );
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export default function LearningSession() {
  const [text, setText] = useState("");
  const [loadedText, setLoadedText] = useState("");
  const [sessionTheme, setSessionTheme] = useState("");
  const [themeStatus, setThemeStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [showLoader, setShowLoader] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const sessionRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ index: number; offsetX: number; offsetY: number } | null>(null);

  // Recalculate on resize
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const onResize = () => forceUpdate((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Global mouse handlers for dragging
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !sessionRef.current) return;
      const containerRect = sessionRef.current.getBoundingClientRect();
      const newX = e.clientX - containerRect.left - dragRef.current.offsetX;
      const newY = e.clientY - containerRect.top - dragRef.current.offsetY;
      const idx = dragRef.current.index;
      setAnnotations((prev) =>
        prev.map((a, i) => (i === idx ? { ...a, bubbleX: newX, bubbleY: newY } : a))
      );
    };

    const onMouseUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const handleDragStart = (e: React.MouseEvent, index: number) => {
    // Don't start drag on the close button or language toggle
    if ((e.target as HTMLElement).closest(".annotation-close, .annotation-lang-toggle")) return;
    e.preventDefault();
    const container = sessionRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const ann = annotations[index];
    dragRef.current = {
      index,
      offsetX: e.clientX - containerRect.left - ann.bubbleX,
      offsetY: e.clientY - containerRect.top - ann.bubbleY,
    };
  };

  const fetchTheme = useCallback(async (textToTheme: string) => {
    setThemeStatus("loading");
    setSessionTheme("");
    try {
      const res = await fetch("/api/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToTheme }),
      });
      if (res.ok) {
        const data = await res.json();
        const theme = (data.theme || "").trim();
        if (theme) {
          setSessionTheme(theme);
          setThemeStatus("ready");
        } else {
          setThemeStatus("failed");
        }
      } else {
        setThemeStatus("failed");
      }
    } catch {
      setThemeStatus("failed");
    }
  }, []);

  const loadNewText = useCallback(
    async (incoming: string) => {
      const trimmed = incoming.trim();
      if (!trimmed) return;
      setLoadedText(trimmed);
      setAnnotations([]);
      fetchTheme(trimmed);
    },
    [fetchTheme]
  );

  const retryTheme = useCallback(() => {
    if (loadedText.trim()) fetchTheme(loadedText);
  }, [loadedText, fetchTheme]);

  const handleLoad = useCallback(() => {
    if (text.trim()) {
      loadNewText(text);
      setShowLoader(false);
      setText("");
    }
  }, [text, loadNewText]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip.trim()) {
        loadNewText(clip);
      }
    } catch {
      setShowLoader(true);
    }
  }, [loadNewText]);

  const findNonOverlappingY = (
    desiredY: number,
    side: "left" | "right",
    existing: Annotation[],
    containerHeight: number,
    panelLeft: number,
    panelRight: number
  ) => {
    const sameSide = existing.filter((a) => {
      if (side === "left") return a.bubbleX < panelLeft;
      return a.bubbleX >= panelRight;
    });

    let y = desiredY;
    let settled = false;

    for (let attempt = 0; attempt < 20 && !settled; attempt++) {
      settled = true;
      for (const other of sameSide) {
        if (Math.abs(y - other.bubbleY) < BUBBLE_HEIGHT_ESTIMATE + 8) {
          y = other.bubbleY + BUBBLE_HEIGHT_ESTIMATE + 8;
          settled = false;
          break;
        }
      }
    }

    y = Math.max(8, Math.min(y, containerHeight - BUBBLE_HEIGHT_ESTIMATE - 8));
    return y;
  };

  const handleDoubleClick = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const word = selection.toString().trim();
    if (!word || word.includes(" ")) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const container = sessionRef.current;
    const panel = panelRef.current;
    if (!container || !panel) return;

    const containerRect = container.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    const wordX = (rect.left + rect.right) / 2 - containerRect.left;
    const wordY = rect.top + rect.height / 2 - containerRect.top;

    const wordCenterInPanel = (rect.left + rect.right) / 2;
    const panelCenter = (panelRect.left + panelRect.right) / 2;

    const panelLeftRel = panelRect.left - containerRect.left;
    const panelRightRel = panelRect.right - containerRect.left;

    let side: "left" | "right";
    let bubbleX: number;

    if (wordCenterInPanel <= panelCenter) {
      side = "left";
      bubbleX = panelLeftRel - BUBBLE_WIDTH - MARGIN_GAP;
      if (bubbleX < 8) bubbleX = 8;
    } else {
      side = "right";
      bubbleX = panelRightRel + MARGIN_GAP;
    }

    const desiredY = wordY - 20;
    const bubbleY = findNonOverlappingY(
      desiredY,
      side,
      annotations,
      containerRect.height,
      panelLeftRel,
      panelRightRel
    );

    // Capture the surrounding paragraph as context for in-context definition.
    let context = "";
    let node: Node | null = range.startContainer;
    while (node && node !== panel) {
      if (node instanceof HTMLElement && node.tagName === "P") {
        context = node.textContent ?? "";
        break;
      }
      node = node.parentNode;
    }

    const lookupWord = word.toLowerCase();
    const color = ANNOTATION_COLORS[annotations.length % ANNOTATION_COLORS.length];
    setAnnotations((prev) => [
      ...prev,
      {
        word: lookupWord,
        context,
        definitionNo: "Looking up...",
        definitionEn: "Looking up...",
        status: "loading",
        showEnglish: false,
        color,
        wordX,
        wordY,
        bubbleX,
        bubbleY,
      },
    ]);

    fetchDefinitions(lookupWord, context).then((result) => {
      setAnnotations((prev) =>
        prev.map((a) =>
          a.word === lookupWord && a.status === "loading"
            ? {
                ...a,
                definitionNo: result.definitionNo,
                definitionEn: result.definitionEn,
                status: result.ok ? "ready" : "failed",
              }
            : a
        )
      );
    });
  }, [annotations]);

  const retryAnnotation = useCallback((index: number) => {
    setAnnotations((prev) =>
      prev.map((a, i) =>
        i === index
          ? { ...a, status: "loading", definitionNo: "Looking up...", definitionEn: "Looking up..." }
          : a
      )
    );
    setAnnotations((prev) => {
      const target = prev[index];
      if (!target) return prev;
      fetchDefinitions(target.word, target.context).then((result) => {
        setAnnotations((curr) =>
          curr.map((a, i) =>
            i === index
              ? {
                  ...a,
                  definitionNo: result.definitionNo,
                  definitionEn: result.definitionEn,
                  status: result.ok ? "ready" : "failed",
                }
              : a
          )
        );
      });
      return prev;
    });
  }, []);

  const toggleLanguage = (index: number) => {
    setAnnotations((prev) =>
      prev.map((a, i) => (i === index ? { ...a, showEnglish: !a.showEnglish } : a))
    );
  };

  const removeAnnotation = (index: number) => {
    setAnnotations((prev) => prev.filter((_, i) => i !== index));
  };

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handleSave = useCallback(async () => {
    if (!loadedText.trim()) return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: loadedText,
          sessionTheme,
          words: annotations.map((a) => ({
            word: a.word,
            definitionNo: a.definitionNo,
            definitionEn: a.definitionEn,
          })),
        }),
      });
      setSaveStatus(res.ok ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    }
    setTimeout(() => setSaveStatus("idle"), 1800);
  }, [loadedText, sessionTheme, annotations]);

  return (
    <div className="learning-session" ref={sessionRef}>
      {/* SVG connector lines */}
      <svg className="connector-lines">
        <defs>
          {annotations.map((ann, i) => {
            const bubbleCenterY = ann.bubbleY + 20;
            const lineEndX =
              ann.bubbleX < ann.wordX ? ann.bubbleX + BUBBLE_WIDTH : ann.bubbleX;
            return (
              <linearGradient
                key={`grad-${i}`}
                id={`line-grad-${i}`}
                gradientUnits="userSpaceOnUse"
                x1={lineEndX}
                y1={bubbleCenterY}
                x2={ann.wordX}
                y2={ann.wordY}
              >
                <stop offset="0%" stopColor={ann.color} stopOpacity="1" />
                <stop offset="100%" stopColor={ann.color} stopOpacity="0" />
              </linearGradient>
            );
          })}
        </defs>
        {annotations.map((ann, i) => {
          const bubbleCenterY = ann.bubbleY + 20;
          const lineEndX =
            ann.bubbleX < ann.wordX ? ann.bubbleX + BUBBLE_WIDTH : ann.bubbleX;
          return (
            <line
              key={i}
              x1={ann.wordX}
              y1={ann.wordY}
              x2={lineEndX}
              y2={bubbleCenterY}
              stroke={`url(#line-grad-${i})`}
              strokeWidth="1.5"
              strokeDasharray="5 3"
            />
          );
        })}
      </svg>

      {/* Annotation cards */}
      {annotations.map((ann, i) => (
        <div
          key={`${ann.word}-${i}`}
          className="annotation-card"
          style={{ top: ann.bubbleY, left: ann.bubbleX, width: BUBBLE_WIDTH }}
          onMouseDown={(e) => handleDragStart(e, i)}
        >
          <div className="annotation-header">
            <strong className="annotation-word" style={{ color: ann.color }}>
              {ann.word}
            </strong>
            <button
              className="annotation-lang-toggle"
              onClick={(e) => {
                e.stopPropagation();
                toggleLanguage(i);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              title={ann.showEnglish ? "Show Norwegian" : "Show English"}
            >
              {ann.showEnglish ? "EN" : "NO"}
            </button>
            <button
              className="annotation-close"
              onClick={() => removeAnnotation(i)}
              onMouseDown={(e) => e.stopPropagation()}
            >
              &times;
            </button>
          </div>
          <div className="annotation-body">
            {ann.showEnglish ? ann.definitionEn : ann.definitionNo}
            {ann.status === "failed" && (
              <button
                type="button"
                className="annotation-retry"
                onClick={(e) => {
                  e.stopPropagation();
                  retryAnnotation(i);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                title="Retry lookup"
              >
                ↻ Retry
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Central reading panel */}
      <div
        className={`reading-panel${loadedText ? "" : " reading-panel--empty"}`}
        ref={panelRef}
        onDoubleClick={handleDoubleClick}
      >
        {loadedText ? (
          <>
            {themeStatus === "loading" && (
              <div className="session-theme session-theme--loading">…</div>
            )}
            {themeStatus === "ready" && sessionTheme && (
              <div className="session-theme">{sessionTheme}</div>
            )}
            {themeStatus === "failed" && (
              <div className="session-theme session-theme--failed">
                <span>Failed</span>
                <button
                  type="button"
                  className="session-theme-retry"
                  onClick={retryTheme}
                  title="Retry topic"
                >
                  ↻ Retry
                </button>
              </div>
            )}
            {loadedText.split(/\n\s*\n/).map((para, i) => (
              <p key={i}>{renderHighlightedParagraph(para, annotations)}</p>
            ))}
          </>
        ) : (
          <button className="paste-button" onClick={handlePasteFromClipboard}>
            Paste
          </button>
        )}
      </div>

      {/* Bottom controls */}
      <div className="session-controls">
        <button onClick={() => setShowLoader(true)}>Load Text</button>
        <button onClick={handleSave} disabled={!loadedText.trim() || saveStatus === "saving"}>
          {saveStatus === "saving"
            ? "Saving..."
            : saveStatus === "saved"
            ? "Saved!"
            : saveStatus === "error"
            ? "Error"
            : "Save"}
        </button>
        {annotations.length > 0 && (
          <button onClick={() => setAnnotations([])}>Clear All</button>
        )}
      </div>

      {/* Load text overlay */}
      {showLoader && (
        <div className="load-text-overlay">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste or type your text here..."
          />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={handleLoad}>Load</button>
            <button onClick={() => setShowLoader(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

async function fetchDefinitions(
  word: string,
  context: string
): Promise<{ ok: boolean; definitionNo: string; definitionEn: string }> {
  try {
    const res = await fetch("/api/define", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, context }),
    });
    if (!res.ok) return { ok: false, definitionNo: "Lookup failed.", definitionEn: "—" };
    const data = await res.json();
    return {
      ok: true,
      definitionNo: data.definitionNo || "No definition.",
      definitionEn: data.definitionEn || "—",
    };
  } catch {
    return { ok: false, definitionNo: "Lookup failed (network).", definitionEn: "—" };
  }
}
