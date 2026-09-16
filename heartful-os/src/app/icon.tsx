import { ImageResponse } from "next/og";

// Next.js App Router file convention: this auto-generates the favicon /
// general <link rel="icon"> tag. Keep this in sync with the two-petal
// Heartful brand mark used in the app sidebar.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F3774D",
          borderRadius: 14,
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 36 36"
        >
          <path
            d="M16.7 29.4C13.1 26.6 8.2 22.4 6.3 17.9 4.2 13 6.2 7.7 10.8 6.8c4.7-.9 7.3 3.1 7.4 7.4.2 5.5-1 10.6-1.5 15.2Z"
            fill="white"
          />
          <path
            d="M17.4 29.5c.8-4.2.9-9.1 2.7-14.1 1.8-5.1 5.4-8.2 9-6.5 4 1.9 3.8 7.2 1.2 11.3-2.9 4.5-8.3 7.6-12.9 9.3Z"
            fill="white"
            opacity={0.82}
          />
          <path
            d="M17.2 29.1c.1-5.9 2-10.3 5.8-14.5"
            fill="none"
            stroke="#F3774D"
            strokeLinecap="round"
            strokeWidth={1.35}
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
