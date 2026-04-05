import { useState, useCallback, useRef, useEffect } from "react";
import "./LearningSession.css";

interface Annotation {
  word: string;
  definition: string;
  wordX: number;
  wordY: number;
  bubbleX: number;
  bubbleY: number;
}

const BUBBLE_HEIGHT_ESTIMATE = 70;
const BUBBLE_WIDTH = 200;
const MARGIN_GAP = 28;

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
    // Don't start drag on the close button
    if ((e.target as HTMLElement).closest(".annotation-close")) return;
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

    setAnnotations((prev) => [
      ...prev,
      {
        word: word.toLowerCase(),
        definition: "Looking up...",
        wordX,
        wordY,
        bubbleX,
        bubbleY,
      },
    ]);

    setTimeout(() => {
      setAnnotations((prev) =>
        prev.map((a) =>
          a.word === word.toLowerCase() && a.definition === "Looking up..."
            ? { ...a, definition: getPlaceholderDefinition(word.toLowerCase()) }
            : a
        )
      );
    }, 400);
  }, [annotations]);

  const removeAnnotation = (index: number) => {
    setAnnotations((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="learning-session" ref={sessionRef}>
      {/* SVG connector lines */}
      <svg className="connector-lines">
        {annotations.map((ann, i) => {
          const bubbleCenterY = ann.bubbleY + 20;
          const lineEndX =
            ann.bubbleX < ann.wordX
              ? ann.bubbleX + BUBBLE_WIDTH
              : ann.bubbleX;
          return (
            <line
              key={i}
              x1={ann.wordX}
              y1={ann.wordY}
              x2={lineEndX}
              y2={bubbleCenterY}
              stroke="#000000"
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
          <button className="annotation-close" onClick={() => removeAnnotation(i)}>
            &times;
          </button>
          <strong>{ann.word}:</strong> {ann.definition}
        </div>
      ))}

      {/* Central reading panel */}
      <div className="reading-panel" ref={panelRef} onDoubleClick={handleDoubleClick}>
        <h3>Reading Text</h3>
        <p>{loadedText}</p>
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

function getPlaceholderDefinition(word: string): string {
  const definitions: Record<string, string> = {
    communication: "the exchange of information or ideas",
    essential: "absolutely necessary; extremely important",
    area: "an expanse encompassing a place",
    study: "the devotion of time and attention to gaining knowledge",
    improve: "to make or become better",
    skills: "the ability to do something well; expertise",
    context: "the circumstances that form the setting for an event",
    effectively: "in a way that produces the intended result",
    vocabulary: "the body of words used in a particular language",
    express: "to convey a thought or feeling in words",
    ideas: "thoughts or suggestions as to a possible course of action",
    confidently: "in a way that shows self-assurance",
  };
  return definitions[word] || `definition for "${word}"`;
}
