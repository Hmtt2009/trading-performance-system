'use client';

import { useState, useEffect, useCallback } from 'react';

const LINES = [
  '> analyzing 847 trades...',
  '> scanning for behavioral patterns...',
  '> overtrading detected: 23 instances',
  '> revenge trading detected: 11 instances',
  '> calculating cost of behavior...',
  '>',
  '> RESULT: Your habits cost you $4,271 this quarter.',
];

const CHAR_DELAY = 35;
const LINE_PAUSE = 400;
const RESTART_PAUSE = 3000;

export function TerminalAnimation() {
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  const reset = useCallback(() => {
    setDisplayedLines([]);
    setCurrentLineIndex(0);
    setCurrentCharIndex(0);
    setIsTyping(true);
  }, []);

  useEffect(() => {
    if (!isTyping) return;

    if (currentLineIndex >= LINES.length) {
      const timeout = setTimeout(reset, RESTART_PAUSE);
      return () => clearTimeout(timeout);
    }

    const currentLine = LINES[currentLineIndex];

    if (currentCharIndex <= currentLine.length) {
      const timeout = setTimeout(() => {
        setDisplayedLines((prev) => {
          const updated = [...prev];
          updated[currentLineIndex] = currentLine.slice(0, currentCharIndex);
          return updated;
        });
        setCurrentCharIndex((c) => c + 1);
      }, CHAR_DELAY);
      return () => clearTimeout(timeout);
    }

    // Line complete, move to next
    const timeout = setTimeout(() => {
      setCurrentLineIndex((l) => l + 1);
      setCurrentCharIndex(0);
    }, LINE_PAUSE);
    return () => clearTimeout(timeout);
  }, [currentLineIndex, currentCharIndex, isTyping, reset]);

  return (
    <div className="relative w-full rounded-lg border border-[#00e87a]/30 bg-[#0a0a0f] p-1 shadow-[0_0_30px_rgba(0,232,122,0.08)]">
      {/* Terminal title bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1c1c22]">
        <span className="w-3 h-3 rounded-full bg-[#ff4560]/80" />
        <span className="w-3 h-3 rounded-full bg-[#f5a623]/80" />
        <span className="w-3 h-3 rounded-full bg-[#00e87a]/80" />
        <span className="ml-3 font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280]">
          flinch --analyze
        </span>
      </div>

      {/* Terminal body */}
      <div className="px-4 py-4 min-h-[220px] sm:min-h-[260px]">
        {displayedLines.map((line, i) => (
          <div
            key={i}
            className={`font-[family-name:var(--font-space-mono)] text-xs sm:text-sm leading-7 ${
              i === LINES.length - 1
                ? 'text-[#00e87a] font-bold mt-1'
                : 'text-[#00e87a]/80'
            }`}
          >
            {line}
            {i === currentLineIndex && isTyping && currentLineIndex < LINES.length && (
              <span className="animate-pulse">|</span>
            )}
          </div>
        ))}
        {currentLineIndex < LINES.length &&
          displayedLines.length <= currentLineIndex && (
            <div className="font-[family-name:var(--font-space-mono)] text-xs sm:text-sm text-[#00e87a]/80 leading-7">
              <span className="animate-pulse">|</span>
            </div>
          )}
      </div>
    </div>
  );
}
