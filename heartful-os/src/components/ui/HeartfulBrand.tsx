import Image from "next/image";

/** Shared product branding for practitioner and client surfaces. */
export default function HeartfulBrand({ subtitle }: { subtitle?: string }) {
  return (
    <>
      <span className="sidebar-brand-mark">
        <Image src="/images/heartful-logo-transparent.png" alt="Heartful" width={1254} height={1254} priority style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </span>
      <div className="sidebar-brand-copy">
        <div className="sidebar-wordmark">Heartful</div>
        {subtitle && <div className="heartful-brand-subtitle">{subtitle}</div>}
      </div>
    </>
  );
}
