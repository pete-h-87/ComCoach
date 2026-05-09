import { useState, useCallback, useRef, useEffect } from "react";
import { useLang } from "../lib/lang";
import "./LearningSession.css";

const TEXT = {
  en: {
    looking: "Looking up...",
    showNorwegian: "Show Norwegian",
    showEnglish: "Show English",
    retryLookup: "Retry lookup",
    retryTopic: "Retry topic",
    retry: "↻ Retry",
    failed: "Failed",
    saving: "Saving...",
    saved: "Saved!",
    errorBtn: "Error",
    save: "Save",
    loadText: "Load Text",
    clearAll: "Clear All",
    paste: "Paste",
    placeholder: "Paste or type your text here...",
    load: "Load",
    cancel: "Cancel",
    lookupFailed: "Lookup failed.",
    noDefinition: "No definition.",
    networkLookup: "Lookup failed (network).",
  },
  no: {
    looking: "Slår opp...",
    showNorwegian: "Vis norsk",
    showEnglish: "Vis engelsk",
    retryLookup: "Prøv oppslag igjen",
    retryTopic: "Prøv tema igjen",
    retry: "↻ Prøv igjen",
    failed: "Mislyktes",
    saving: "Lagrer...",
    saved: "Lagret!",
    errorBtn: "Feil",
    save: "Lagre",
    loadText: "Last inn tekst",
    clearAll: "Fjern alle",
    paste: "Lim inn",
    placeholder: "Lim inn eller skriv teksten din her...",
    load: "Last inn",
    cancel: "Avbryt",
    lookupFailed: "Oppslag mislyktes.",
    noDefinition: "Ingen definisjon.",
    networkLookup: "Oppslag mislyktes (nettverk).",
  },
};

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

// Ephemeral sub-annotations created by double-clicking a word inside an existing
// annotation card. These are NOT persisted to the database.
interface SubAnnotation {
  id: number;
  word: string;
  definitionNo: string;
  definitionEn: string;
  status: "loading" | "ready" | "failed";
  showEnglish: boolean;
  x: number;
  y: number;
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
  const { lang } = useLang();
  const t = TEXT[lang];
  const [text, setText] = useState("");
  const [loadedText, setLoadedText] = useState("");
  const [sessionTheme, setSessionTheme] = useState("");
  const [themeStatus, setThemeStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [showLoader, setShowLoader] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [subAnnotations, setSubAnnotations] = useState<SubAnnotation[]>([]);
  const sessionRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ index: number; offsetX: number; offsetY: number } | null>(null);
  const subIdCounter = useRef(0);

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
    // Don't start drag on buttons or in the body (where the user double-clicks words).
    if (
      (e.target as HTMLElement).closest(
        ".annotation-close, .annotation-lang-toggle, .annotation-body"
      )
    )
      return;
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

  const handleSubDoubleClick = (e: React.MouseEvent, parentIndex: number) => {
    e.stopPropagation();
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const word = selection.toString().trim();
    if (!word || word.includes(" ")) return;

    const container = sessionRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const x = e.clientX - containerRect.left + 10;
    const y = e.clientY - containerRect.top + 10;

    const id = ++subIdCounter.current;
    const lookupWord = word.toLowerCase();
    const parentContext = annotations[parentIndex]?.context ?? "";

    setSubAnnotations((prev) => [
      ...prev,
      {
        id,
        word: lookupWord,
        definitionNo: t.looking,
        definitionEn: t.looking,
        status: "loading",
        showEnglish: false,
        x,
        y,
      },
    ]);

    fetchDefinitions(lookupWord, parentContext).then((result) => {
      setSubAnnotations((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                definitionNo: result.definitionNo,
                definitionEn: result.definitionEn,
                status: result.ok ? "ready" : "failed",
              }
            : s
        )
      );
    });
  };

  const removeSubAnnotation = (id: number) => {
    setSubAnnotations((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleSubLanguage = (id: number) => {
    setSubAnnotations((prev) =>
      prev.map((s) => (s.id === id ? { ...s, showEnglish: !s.showEnglish } : s))
    );
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
      setSubAnnotations([]);
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

  // Shared lookup logic used by both double-click (single word) and mouseup (multi-word phrase).
  const lookupSelection = useCallback(
    (selectedText: string, range: Range) => {
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

      const lookupWord = selectedText.toLowerCase();
      const color = ANNOTATION_COLORS[annotations.length % ANNOTATION_COLORS.length];
      setAnnotations((prev) => [
        ...prev,
        {
          word: lookupWord,
          context,
          definitionNo: t.looking,
          definitionEn: t.looking,
          status: "loading",
          showEnglish: false,
          color,
          wordX,
          wordY,
          bubbleX,
          bubbleY,
        },
      ]);

      // Clear the browser selection so the user doesn't have to click away first.
      window.getSelection()?.removeAllRanges();

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
    },
    [annotations, t.looking]
  );

  const handleDoubleClick = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (!text || text.includes(" ")) return;
    lookupSelection(text, selection.getRangeAt(0));
  }, [lookupSelection]);

  // Handles drag-selected phrases (multi-word). Single-word selections are left to onDoubleClick.
  const handlePanelMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (!text || !text.includes(" ")) return;
    // Skip oversized selections (e.g. accidental triple-click on a long paragraph).
    if (text.split(/\s+/).length > 15) return;
    lookupSelection(text, selection.getRangeAt(0));
  }, [lookupSelection]);

  const retryAnnotation = useCallback((index: number) => {
    setAnnotations((prev) =>
      prev.map((a, i) =>
        i === index
          ? { ...a, status: "loading", definitionNo: t.looking, definitionEn: t.looking }
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
  }, [t.looking]);

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
              title={ann.showEnglish ? t.showNorwegian : t.showEnglish}
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
          <div
            className="annotation-body"
            onDoubleClick={(e) => handleSubDoubleClick(e, i)}
          >
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
                title={t.retryLookup}
              >
                {t.retry}
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Sub-annotation popups (ephemeral, not saved to DB) */}
      {subAnnotations.map((s) => (
        <div
          key={s.id}
          className="annotation-card annotation-card--sub"
          style={{ top: s.y, left: s.x }}
        >
          <div className="annotation-header">
            <strong className="annotation-word">{s.word}</strong>
            <button
              className="annotation-lang-toggle"
              onClick={() => toggleSubLanguage(s.id)}
              title={s.showEnglish ? t.showNorwegian : t.showEnglish}
            >
              {s.showEnglish ? "EN" : "NO"}
            </button>
            <button
              className="annotation-close"
              onClick={() => removeSubAnnotation(s.id)}
            >
              &times;
            </button>
          </div>
          <div className="annotation-body">
            {s.showEnglish ? s.definitionEn : s.definitionNo}
          </div>
        </div>
      ))}

      {/* Central reading panel */}
      <div
        className={`reading-panel${loadedText ? "" : " reading-panel--empty"}`}
        ref={panelRef}
        onDoubleClick={handleDoubleClick}
        onMouseUp={handlePanelMouseUp}
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
                <span>{t.failed}</span>
                <button
                  type="button"
                  className="session-theme-retry"
                  onClick={retryTheme}
                  title={t.retryTopic}
                >
                  {t.retry}
                </button>
              </div>
            )}
            {loadedText.split(/\n\s*\n/).map((para, i) => (
              <p key={i}>{renderHighlightedParagraph(para, annotations)}</p>
            ))}
          </>
        ) : (
          <button className="paste-button" onClick={handlePasteFromClipboard}>
            {t.paste}
          </button>
        )}
      </div>

      {/* Bottom controls */}
      <div className="session-controls">
        <button onClick={() => setShowLoader(true)}>{t.loadText}</button>
        <button onClick={handleSave} disabled={!loadedText.trim() || saveStatus === "saving"}>
          {saveStatus === "saving"
            ? t.saving
            : saveStatus === "saved"
            ? t.saved
            : saveStatus === "error"
            ? t.errorBtn
            : t.save}
        </button>
        {annotations.length > 0 && (
          <button
            onClick={() => {
              setAnnotations([]);
              setSubAnnotations([]);
            }}
          >
            {t.clearAll}
          </button>
        )}
      </div>

      {/* Load text overlay */}
      {showLoader && (
        <div className="load-text-overlay">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.placeholder}
          />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={handleLoad}>{t.load}</button>
            <button onClick={() => setShowLoader(false)}>{t.cancel}</button>
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
