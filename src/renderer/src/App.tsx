import { useEffect, useState } from 'react'
import type { AppInfo } from '../../shared/contracts/bridge'

/**
 * Placeholder status window of the foundation. Bilal replaces it with the
 * windows of Chat 13b (login, workspace picker) after the Figma review.
 */
export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    let active = true
    const load = async (): Promise<void> => {
      try {
        const value = await window.desktop.getAppInfo()
        if (active) setInfo(value)
      } catch {
        if (active) setInfo(null)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-sm rounded-lg border bg-card p-6">
        <h1 className="text-lg font-semibold">{info?.productName ?? 'ProductivityAI'}</h1>
        <p className="mt-1 text-muted-foreground">Desktop application foundation</p>
        <p className="mt-4 text-muted-foreground">
          Version <span className="font-medium text-foreground">{info?.version ?? '...'}</span>
        </p>
      </section>
    </main>
  )
}
