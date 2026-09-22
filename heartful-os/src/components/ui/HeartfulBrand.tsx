/** Shared product branding for practitioner and client surfaces. */
export default function HeartfulBrand({ subtitle }: { subtitle?: string }) {
  return (
    <>
      <span className="sidebar-brand-mark">
        <span
          className="sidebar-brand-symbol"
          aria-hidden="true"
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            backgroundColor: "var(--color-coral-rose)",
            backgroundImage: "linear-gradient(90deg, color-mix(in srgb, var(--color-coral-rose) 70%, white) 0 50%, var(--color-coral-rose) 50% 100%)",
            WebkitMask: 'url("/images/heartful-logo-transparent.png") center / contain no-repeat',
            mask: 'url("/images/heartful-logo-transparent.png") center / contain no-repeat',
          }}
        />
      </span>
      <div className="sidebar-brand-copy">
        <div className="sidebar-wordmark">Heartful</div>
        {subtitle && <div className="heartful-brand-subtitle">{subtitle}</div>}
      </div>
    </>
  );
}
