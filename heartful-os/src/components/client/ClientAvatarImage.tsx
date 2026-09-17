"use client";

import Image from "next/image";
import { useState } from "react";
import { initials } from "@/lib/utils";

type ClientAvatarImageProps = {
  clientName: string;
  src: string;
  width: number;
  height: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  fallbackClassName?: string;
};

/**
 * Keeps the initials fallback available when a static avatar request fails
 * after deployment (for example, a stale CDN asset), without changing the
 * seeded client data or rendering a broken-image glyph.
 */
export default function ClientAvatarImage({
  clientName,
  src,
  width,
  height,
  sizes,
  priority = false,
  className,
  fallbackClassName,
}: ClientAvatarImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className={fallbackClassName} aria-hidden="true">{initials(clientName)}</span>;
  }

  return (
    <Image
      src={src}
      alt=""
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
