import type { Choice } from './data'

export type DecisionEvidence = {
  id: string
  attemptId: string
  from: string
  to: string
  choice: string
  behavior: string
  skills: string[]
  points: number
  feedback: string
  impact?: string
  alternative?: string
  lesson?: string
  occurredAt: string
}

export type Progress = {
  step: string
  score: number
  decisions: number
  completed: boolean
  best: number
  lastFeedback?: string
  attemptId?: string
  history?: DecisionEvidence[]
}

function createAttemptId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function createProgress(best = 0, attemptId = createAttemptId()): Progress {
  return { step: 'start', score: 0, decisions: 0, completed: false, best, attemptId, history: [] }
}

export function recordDecision(
  progress: Progress,
  from: string,
  choice: Choice,
  completed: boolean,
  occurredAt = new Date().toISOString(),
): Progress {
  const attemptId = progress.attemptId || createAttemptId()
  const history = progress.history || []
  const id = `${attemptId}:${encodeURIComponent(from)}:${encodeURIComponent(choice.label)}`

  // Replayed click handlers for the same step cannot duplicate its evidence.
  if (history.some(item => item.id === id)) return progress

  const evidence: DecisionEvidence = {
    id,
    attemptId,
    from,
    to: choice.next,
    choice: choice.label,
    behavior: choice.behavior,
    skills: [...choice.skills],
    points: choice.points,
    feedback: choice.feedback,
    impact: choice.impact,
    alternative: choice.alternative,
    lesson: choice.lesson,
    occurredAt,
  }
  const nextHistory = [...history, evidence]
  const score = nextHistory.reduce((total, item) => total + item.points, 0)
  const decisions = nextHistory.length
  const best = completed ? Math.max(progress.best, Math.round(score / (decisions * 3) * 100)) : progress.best

  return {
    ...progress,
    step: choice.next,
    score,
    decisions,
    completed,
    best,
    lastFeedback: choice.feedback,
    attemptId,
    history: nextHistory,
  }
}

export function backProgress(progress: Progress): Progress | null {
  const history = progress.history || []
  const last = history[history.length - 1]
  if (!last) return null

  const previousHistory = history.slice(0, -1)
  return {
    ...progress,
    step: last.from,
    score: previousHistory.reduce((total, item) => total + item.points, 0),
    decisions: previousHistory.length,
    completed: false,
    lastFeedback: previousHistory[previousHistory.length - 1]?.feedback,
    history: previousHistory,
  }
}
