/** The Deplug mark: ink body, Signal prongs. Inherits the text color for the body. */
export default function BrandMark({ className, accent = true }: { className?: string; accent?: boolean }) {
  const prong = accent ? "var(--signal)" : "currentColor"
  return (
    <svg viewBox="0 0 256 256" aria-hidden="true" focusable="false" className={className}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M96 48H144A80 80 0 0 1 144 208H96Z M128 80H144A48 48 0 0 1 144 176H128Z"
      />
      <rect className="brand-prong" x="32" y="90" width="48" height="16" rx="8" fill={prong} />
      <rect className="brand-prong" x="32" y="150" width="48" height="16" rx="8" fill={prong} />
    </svg>
  )
}
