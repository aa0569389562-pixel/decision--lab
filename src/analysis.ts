import { scenarios } from './data'
import type { ProgressStore } from './skills'

export type DimensionResult = { id: string; label: string; score: number | null; evidenceCount: number }
export type SkillPattern = { skill: string; positive: number; opportunities: number; examples: string[] }
export type DecisionReport = {
  level: string
  score: number | null
  evidenceCount: number
  completedScenarios: number
  dimensions: DimensionResult[]
  strengths: SkillPattern[]
  development: SkillPattern[]
  recommendations: string[]
}

export const PROFESSIONAL_REPORT_MIN_SCENARIOS = 3

export function canViewProfessionalReport(completedScenarios: number): boolean {
  return completedScenarios >= PROFESSIONAL_REPORT_MIN_SCENARIOS
}

const dimensions: Array<{ id: string; label: string; match: (skill: string) => boolean }> = [
  { id: 'decision', label: 'اتخاذ القرار', match: skill => /قرار|أولوي|مخاطر|تفكير/.test(skill) },
  { id: 'communication', label: 'التواصل', match: skill => /تواصل|إنصات|استماع/.test(skill) },
  { id: 'problem', label: 'حل المشكلات', match: skill => /حل المشكلات|تحليل|تفكير نقدي/.test(skill) },
  { id: 'conflict', label: 'إدارة الخلافات', match: skill => /خلاف|نزاع|وساط|تفاوض/.test(skill) },
  { id: 'teamwork', label: 'العمل الجماعي', match: skill => /فريق|جماع|تعاون|تنسيق/.test(skill) },
  { id: 'time', label: 'إدارة الوقت', match: skill => /وقت|أولوي|تخطيط/.test(skill) },
  { id: 'ownership', label: 'تحمل المسؤولية', match: skill => /مسؤول|التزام|متابعة/.test(skill) },
]

export function analyzeDecisionReport(store: ProgressStore): DecisionReport {
  const evidence = scenarios.flatMap(scenario => {
    const progress = store[scenario.id]
    if (!progress?.completed) return []
    return (progress.history || []).filter(item => !progress.attemptId || !item.attemptId || item.attemptId === progress.attemptId)
  })
  const averageScore = (items: typeof evidence) => items.length
    ? Math.round(items.reduce((sum, item) => sum + Math.max(0, Math.min(3, item.points || 0)), 0) / (items.length * 3) * 100)
    : null
  const score = averageScore(evidence)
  const tier = score === null ? 'ابدأ أول موقف' : score >= 78 ? 'متقدم' : score >= 52 ? 'نامٍ' : 'يحتاج إلى ممارسة'
  const level = score === null ? tier : evidence.length < 3 ? `قراءة أولية · ${tier}` : tier

  const skillEvidence = new Map<string, typeof evidence>()
  for (const item of evidence) {
    for (const skill of new Set(item.skills || [])) skillEvidence.set(skill, [...(skillEvidence.get(skill) || []), item])
  }
  const patterns = [...skillEvidence.entries()].map(([skill, items]) => ({
    skill,
    positive: items.filter(item => item.points >= 2).length,
    opportunities: items.filter(item => item.points < 2).length,
    examples: items.slice(-2).map(item => item.behavior || item.choice),
  })).sort((a, b) => (b.positive - b.opportunities) - (a.positive - a.opportunities))

  const recommendations: string[] = patterns.filter(item => item.opportunities > item.positive).slice(0, 3).map(item => {
    const skill = item.skill
    if (/تواصل|إنصات|استماع/.test(skill)) return 'قبل الرد أو التصعيد، لخّص ما فهمته واتفق على من سيحدث الأطراف ومتى.'
    if (/خلاف|نزاع|وساط/.test(skill)) return 'حوّل الخلاف إلى معيار مشترك، واطلب من كل طرف اقتراح حل قابل للتجربة.'
    if (/وقت|أولوي|تخطيط/.test(skill)) return 'رتب المهام بحسب أثر التأخير، ثم قسّم التسليم وحدد نقطة مراجعة.'
    if (/فريق|جماع|تعاون|تنسيق/.test(skill)) return 'وزع العمل بحسب القدرة، وسمّ مالكًا لكل خطوة وموعدًا لمزامنة التقدم.'
    if (/مسؤول|التزام|متابعة/.test(skill)) return 'حوّل التفسير إلى التزام واضح: ما الخطوة، ومن مالكها، ومتى ستغلق؟'
    if (/حل المشكلات|تحليل|تفكير/.test(skill)) return 'افصل الوقائع عن الافتراضات، واختبر سببًا واحدًا قبل توسيع الحل.'
    return 'قارن البدائل على أساس الأثر والمخاطر والوقت، ثم وثق سبب اختيارك.'
  })
  if (!recommendations.length && evidence.length) recommendations.push('وسّع التدريب إلى مجال وظيفي مختلف، ثم قارن كيف تغيّر قرارك مع اختلاف السياق.')
  if (!recommendations.length) recommendations.push('أكمل ثلاثة مواقف على الأقل لتظهر أنماط قراراتك وتوصيات مبنية على قرائن أكثر.')

  return {
    level,
    score,
    evidenceCount: evidence.length,
    completedScenarios: scenarios.filter(scenario => store[scenario.id]?.completed).length,
    dimensions: dimensions.map(dimension => {
      const items = evidence.filter(item => (item.skills || []).some(dimension.match))
      return { id: dimension.id, label: dimension.label, score: averageScore(items), evidenceCount: items.length }
    }),
    strengths: patterns.filter(item => item.positive > item.opportunities).slice(0, 4),
    development: patterns.filter(item => item.opportunities >= item.positive).slice(0, 4),
    recommendations,
  }
}
