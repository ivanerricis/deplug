import type { ReactNode } from "react"

/** Centered icon, title, one-line explanation and actions, shared by the empty list states. */
export default function EmptyState({ icon, title, body, children }: { icon: ReactNode; title: string; body: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      {icon}
      <div className="max-w-md">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">{children}</div>
    </div>
  )
}
