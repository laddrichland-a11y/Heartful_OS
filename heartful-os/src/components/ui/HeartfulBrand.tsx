import Image from "next/image";

/** Shared product branding for practitioner and client surfaces. */
export default function HeartfulBrand({ subtitle }: { subtitle?: string }) {
  return (
    <>
      <span
        className="sidebar-brand-mark"
        style={{ position: "relative", width: 42, height: 42, flex: "0 0 42px", alignSelf: "center", overflow: "visible" }}
      >
        <Image
          className="sidebar-brand-symbol"
          aria-hidden="true"
          src="/images/heartful-os-original.png"
          alt=""
          width={1536}
          height={1024}
          sizes="64px"
          style={{ position: "absolute", top: "50%", left: "50%", width: "132%", maxWidth: "none", height: "auto", objectFit: "contain", transform: "translate(-50%, -50%)" }}
        />
      </span>
      <div className="sidebar-brand-copy">
        <div className="sidebar-wordmark" style={{ textTransform: "none" }}>Heartful OS</div>
        {subtitle && <div className="heartful-brand-subtitle">{subtitle}</div>}
      </div>
    </>
  );
}
