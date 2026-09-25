"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/utils";

export interface SignatureValue {
  mode: "typed" | "drawn";
  typedName?: string;
  drawnDataUrl?: string;
  acknowledged: boolean;
  signedAt?: string;
}

// Dual-mode signature: type your full name + check an acknowledgement box,
// OR draw your signature on a canvas — either way preceded by a declaration
// of acknowledgement and agreement, per the practitioner's requirement that
// every signature carry that declaration regardless of signing method.
export default function SignatureField({
  label,
  declaration,
  value,
  onChange,
  disabled,
}: {
  label: string;
  declaration?: string;
  value: SignatureValue | undefined;
  onChange: (value: SignatureValue) => void;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<"typed" | "drawn">(value?.mode ?? "typed");
  const [typedName, setTypedName] = useState(value?.typedName ?? "");
  const [acknowledged, setAcknowledged] = useState(value?.acknowledged ?? false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  // Sync local state when the value prop is updated externally (e.g. live session
  // incoming from the other party via onSnapshot). useState only uses the initial
  // value, so without these effects remote changes would never appear locally.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (value?.mode !== undefined) setMode(value.mode);
      setTypedName(value?.typedName ?? "");
      setAcknowledged(value?.acknowledged ?? false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [value?.mode, value?.typedName, value?.acknowledged]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== "drawn") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#27293D";
    if (value?.drawnDataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value.drawnDataUrl;
      hasDrawnRef.current = true;
    }
  }, [mode, value?.drawnDataUrl]);

  function commitTyped(name: string, ack: boolean) {
    onChange({
      mode: "typed",
      typedName: name,
      acknowledged: ack,
      signedAt: name.trim() && ack ? new Date().toISOString() : undefined,
    });
  }

  function getPos(e: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasDrawnRef.current = true;
  }

  function endDraw() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange({
      mode: "drawn",
      drawnDataUrl: canvas.toDataURL("image/png"),
      acknowledged,
      signedAt: hasDrawnRef.current && acknowledged ? new Date().toISOString() : undefined,
    });
  }

  function clearDrawn() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
    onChange({ mode: "drawn", drawnDataUrl: undefined, acknowledged, signedAt: undefined });
  }

  return (
    <div className="rounded-xl border border-ink-200 p-4 bg-ink-50/40">
      <div className="text-sm font-medium text-ink-900 mb-2">{label}</div>
      {declaration && (
        <p className="text-xs text-ink-500 mb-3 leading-relaxed">{declaration}</p>
      )}

      <div className="flex items-center gap-1 mb-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode("typed")}
          className={cx(
            "text-xs px-3 py-1.5 rounded-full border",
            mode === "typed" ? "bg-clay-600 text-white border-clay-600" : "border-ink-200 text-ink-500"
          )}
        >
          Type my name
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode("drawn")}
          className={cx(
            "text-xs px-3 py-1.5 rounded-full border",
            mode === "drawn" ? "bg-clay-600 text-white border-clay-600" : "border-ink-200 text-ink-500"
          )}
        >
          Draw my signature
        </button>
      </div>

      {mode === "typed" ? (
        <div className="space-y-2">
          <input
            disabled={disabled}
            value={typedName}
            onChange={(e) => {
              setTypedName(e.target.value);
              commitTyped(e.target.value, acknowledged);
            }}
            placeholder="Type your full legal name"
            className="w-full border border-ink-200 rounded-xl px-3 py-2 text-sm font-medium italic focus:outline-none focus:ring-2 focus:ring-clay-200"
          />
          <label className="flex items-start gap-2 text-xs text-ink-600">
            <input
              type="checkbox"
              disabled={disabled}
              checked={acknowledged}
              onChange={(e) => {
                setAcknowledged(e.target.checked);
                commitTyped(typedName, e.target.checked);
              }}
              className="mt-0.5"
            />
            I acknowledge and agree to the statement above, and intend my typed name to serve as my legal signature.
          </label>
        </div>
      ) : (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            width={420}
            height={140}
            onPointerDown={startDraw}
            onPointerMove={draw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            className="w-full max-w-[420px] h-[140px] rounded-lg border border-ink-200 bg-white touch-none"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-start gap-2 text-xs text-ink-600">
              <input
                type="checkbox"
                disabled={disabled}
                checked={acknowledged}
                onChange={(e) => {
                  setAcknowledged(e.target.checked);
                  const canvas = canvasRef.current;
                  onChange({
                    mode: "drawn",
                    drawnDataUrl: canvas?.toDataURL("image/png"),
                    acknowledged: e.target.checked,
                    signedAt: hasDrawnRef.current && e.target.checked ? new Date().toISOString() : undefined,
                  });
                }}
                className="mt-0.5"
              />
              I acknowledge and agree to the statement above.
            </label>
            <button type="button" disabled={disabled} onClick={clearDrawn} className="btn-ghost text-xs px-2 py-1">
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
