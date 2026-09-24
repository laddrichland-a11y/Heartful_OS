"use client";

import { useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import type { ImageProps } from "next/image";
import ClientAvatarImage from "@/components/client/ClientAvatarImage";
import { updateClientAvatarAction } from "@/lib/actions";
import { initials } from "@/lib/utils";

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 480;

async function compactAvatar(file: File) {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("The image could not be prepared."));
    nextImage.src = source;
  });
  const scale = Math.min(1, AVATAR_SIZE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function ClientAvatarEditor({
  clientId,
  clientName,
  avatarUrl,
  fallbackAvatarSrc,
}: {
  clientId: string;
  clientName: string;
  avatarUrl?: string;
  fallbackAvatarSrc?: ImageProps["src"];
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const visibleAvatar = avatarUrl || fallbackAvatarSrc;

  function handleKeyboard(event: KeyboardEvent<HTMLLabelElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    inputRef.current?.click();
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_INPUT_BYTES) {
      setError("Choose a JPG, PNG, or WebP image up to 5 MB.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await updateClientAvatarAction(clientId, await compactAvatar(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The photo could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wn-avatar-editor">
      <label
        htmlFor={inputId}
        className={`wn-avatar wn-avatar--editable${busy ? " is-busy" : ""}`}
        aria-label={avatarUrl ? `Replace photo for ${clientName}` : `Upload photo for ${clientName}`}
        title={avatarUrl ? "Replace photo" : "Upload photo"}
        role="button"
        tabIndex={busy ? -1 : 0}
        onKeyDown={handleKeyboard}
      >
        {visibleAvatar ? (
          <ClientAvatarImage clientName={clientName} src={visibleAvatar} width={58} height={58} priority />
        ) : initials(clientName)}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleFile}
        disabled={busy}
        tabIndex={-1}
      />
      {error && <p className="wn-avatar-error" role="alert">{error}</p>}
    </div>
  );
}
