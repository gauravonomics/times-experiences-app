interface ContextPanelProps {
  children: React.ReactNode
}

export function ContextPanel({ children }: ContextPanelProps) {
  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        {children}
      </div>
    </div>
  )
}
