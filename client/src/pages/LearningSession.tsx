import { useState, useCallback, useRef, useEffect } from "react";
import "./LearningSession.css";

interface Annotation {
  word: string;
  definitionNo: string;
  definitionEn: string;
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
  const [loadedText, setLoadedText] = useState(
    `Communication is an essential area of study for anyone looking to improve their skills. Understanding the context in which words are used helps you communicate more effectively. Building your vocabulary is one of the best ways to express ideas clearly and confidently.`
  );
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

  const handleLoad = useCallback(() => {
    if (text.trim()) {
      setLoadedText(text.trim());
      setAnnotations([]);
      setShowLoader(false);
      setText("");
    }
  }, [text]);

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
        definitionNo: "Looking up...",
        definitionEn: "Looking up...",
        showEnglish: false,
        color,
        wordX,
        wordY,
        bubbleX,
        bubbleY,
      },
    ]);

    fetchDefinitions(lookupWord, context).then(({ definitionNo, definitionEn }) => {
      setAnnotations((prev) =>
        prev.map((a) =>
          a.word === lookupWord && a.definitionNo === "Looking up..."
            ? { ...a, definitionNo, definitionEn }
            : a
        )
      );
    });
  }, [annotations]);

  const toggleLanguage = (index: number) => {
    setAnnotations((prev) =>
      prev.map((a, i) => (i === index ? { ...a, showEnglish: !a.showEnglish } : a))
    );
  };

  const removeAnnotation = (index: number) => {
    setAnnotations((prev) => prev.filter((_, i) => i !== index));
  };

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
          </div>
        </div>
      ))}

      {/* Central reading panel */}
      <div className="reading-panel" ref={panelRef} onDoubleClick={handleDoubleClick}>
        <h3>Reading Text</h3>
        {loadedText.split(/\n\s*\n/).map((para, i) => (
          <p key={i}>{renderHighlightedParagraph(para, annotations)}</p>
        ))}
      </div>

      {/* Bottom controls */}
      <div className="session-controls">
        <button onClick={() => setShowLoader(true)}>Load Text</button>
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
): Promise<{ definitionNo: string; definitionEn: string }> {
  try {
    const res = await fetch("/api/define", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, context }),
    });
    if (!res.ok) return { definitionNo: "Lookup failed.", definitionEn: "—" };
    const data = await res.json();
    return {
      definitionNo: data.definitionNo || "No definition.",
      definitionEn: data.definitionEn || "—",
    };
  } catch {
    return { definitionNo: "Lookup failed (network).", definitionEn: "—" };
  }
}
