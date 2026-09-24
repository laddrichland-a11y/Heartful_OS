export default function SidebarNatureMessage() {
  return (
    <div className="sidebar-nature-message">
      <svg className="sidebar-nature-mark sidebar-fern" viewBox="0 0 80 112" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3">
          <path d="M22 107Q33 57 38 5" />
          <path d="M25 99Q46 61 72 36" />
        </g>
        <g fill="currentColor">
          {[
            [25, 91, 0.95], [27, 81, 1], [29, 71, 0.95],
            [31, 61, 0.85], [33, 51, 0.75], [34, 42, 0.65],
            [35, 34, 0.55], [36, 27, 0.45], [37, 21, 0.35],
            [37.5, 16, 0.25],
          ].map(([x, y, scale], index) => (
            <g key={`upright-${index}`} transform={`translate(${x} ${y}) rotate(6) scale(${scale})`}>
              <path d="M0 0C-9-1-16-8-17-15C-9-13-3-8 0 0Z" />
              <path d="M0 0C7-2 13-9 14-16C6-13 2-7 0 0Z" opacity="0.85" />
            </g>
          ))}
          {[
            [31, 88, 0.7], [36, 79, 0.75], [42, 70, 0.7],
            [49, 61, 0.6], [56, 53, 0.5], [62, 46, 0.38],
            [67, 41, 0.25],
          ].map(([x, y, scale], index) => (
            <g key={`arching-${index}`} transform={`translate(${x} ${y}) rotate(38) scale(${scale})`}>
              <path d="M0 0C-8-1-14-7-15-14C-8-12-2-7 0 0Z" opacity="0.85" />
              <path d="M0 0C7-2 12-8 13-15C6-12 2-6 0 0Z" />
            </g>
          ))}
          <path d="M38 13C35 9 36 4 39 1C41 6 40 10 38 13Z" />
          <path d="M70 39C69 35 73 32 77 31C76 35 73 38 70 39Z" />
        </g>
      </svg>
      <p className="sidebar-fern-caption">People heal.<br />A kinder tomorrow<br />is possible.</p>
    </div>
  );
}
