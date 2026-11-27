import { scenarios, type Scenario } from './data'
import type { DecisionEvidence, Progress } from './progress'

export type SkillKind = 'hidden' | 'transferable' | 'contextual'
export type EvidenceReference = {
  id: string
  attemptId: string
  scenarioId: string
  scenarioTitle: string
  scenarioCategory: string
  choice: string
  behavior: string
  occurredAt: string
}
export type SkillInsight = {
  skill: string
  kind: SkillKind
  evidenceCount: number
  scenarioCount: number
  confidence: 'limited' | 'medium' | 'high'
  confidenceLabel: string
  evidence: EvidenceReference[]
}
export type ProgressStore = Record<string, Progress | undefined>

const MINIMUM_EVIDENCE = 2

function evidenceId(item: DecisionEvidence, scenarioId: string, attemptId: string, index: number): string {
  return item.id || `${scenarioId}:${item.attemptId || attemptId}:legacy:${index}:${item.from}:${item.choice}`
}

function confidenceFor(evidenceCount: number, scenarioCount: number): SkillInsight['confidence'] {
  if (evidenceCount >= 4 && scenarioCount >= 3) return 'high'
  if (evidenceCount >= 3 && scenarioCount >= 2) return 'medium'
  return 'limited'
}

const confidenceLabels: Record<SkillInsight['confidence'], string> = {
  limited: 'قرائن أولية متكررة',
  medium: 'قرائن متكررة عبر مواقف',
  high: 'قرائن متعددة عبر مواقف متنوعة',
}

export function analyzeSkills(
  store: ProgressStore,
  scenarioList: Scenario[] = scenarios,
): SkillInsight[] {
  const bySkill = new Map<string, EvidenceReference[]>()
  const seenEvidence = new Set<string>()

  for (const scenario of scenarioList) {
    const progress = store[scenario.id]
    if (!progress) continue

    const activeAttemptId = progress.attemptId || `${scenario.id}-legacy`
    for (const [index, item] of (progress.history || []).entries()) {
      if (progress.attemptId && item.attemptId && item.attemptId !== progress.attemptId) continue

      const id = evidenceId(item, scenario.id, activeAttemptId, index)
      if (seenEvidence.has(id)) continue
      seenEvidence.add(id)

      const reference: EvidenceReference = {
        id,
        attemptId: item.attemptId || activeAttemptId,
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        scenarioCategory: scenario.category,
        choice: item.choice,
        behavior: item.behavior || item.choice,
        occurredAt: item.occurredAt,
      }
      for (const skill of new Set(item.skills || [])) {
        const evidence = bySkill.get(skill) || []
        evidence.push(reference)
        bySkill.set(skill, evidence)
      }
    }
  }

  const scenarioById = new Map(scenarioList.map(scenario => [scenario.id, scenario]))
  return [...bySkill.entries()]
    .filter(([, evidence]) => evidence.length >= MINIMUM_EVIDENCE)
    .map(([skill, evidence]) => {
      const scenarioIds = new Set(evidence.map(item => item.scenarioId))
      const scenarioCount = scenarioIds.size
      const appearsOutsideDeclaredSkills = evidence.some(item =>
        !scenarioById.get(item.scenarioId)?.skills.includes(skill),
      )
      const kind: SkillKind = scenarioCount >= 2
        ? 'transferable'
        : appearsOutsideDeclaredSkills
          ? 'hidden'
          : 'contextual'
      const confidence = confidenceFor(evidence.length, scenarioCount)

      return {
        skill,
        kind,
        evidenceCount: evidence.length,
        scenarioCount,
        confidence,
        confidenceLabel: confidenceLabels[confidence],
        evidence: [...evidence].sort((a, b) => (a.occurredAt || '').localeCompare(b.occurredAt || '')),
      }
    })
    .sort((a, b) => b.scenarioCount - a.scenarioCount || b.evidenceCount - a.evidenceCount || a.skill.localeCompare(b.skill, 'ar'))
}
