import type { SessionProvider } from '../contracts/api'

/** SessionProvider with manual sign-in and sign-out, for Wasi's sync tests. */
export class FakeSession implements SessionProvider {
  private userId: string | null = null
  private workspaceId: string | null = null
  private readonly signedInListeners = new Set<(userId: string) => void>()
  private readonly signedOutListeners = new Set<(reason: string) => void>()

  currentUserId(): string | null {
    return this.userId
  }

  currentWorkspaceId(): string | null {
    return this.workspaceId
  }

  onSignedIn(listener: (userId: string) => void): () => void {
    this.signedInListeners.add(listener)
    return () => this.signedInListeners.delete(listener)
  }

  onSignedOut(listener: (reason: string) => void): () => void {
    this.signedOutListeners.add(listener)
    return () => this.signedOutListeners.delete(listener)
  }

  signIn(userId: string, workspaceId: string): void {
    this.userId = userId
    this.workspaceId = workspaceId
    for (const listener of this.signedInListeners) listener(userId)
  }

  switchWorkspace(workspaceId: string): void {
    this.workspaceId = workspaceId
  }

  signOut(reason = 'SIGNED_OUT'): void {
    this.userId = null
    this.workspaceId = null
    for (const listener of this.signedOutListeners) listener(reason)
  }
}
