const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

require.extensions['.ts'] = (loadedModule, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  loadedModule._compile(outputText, filename)
}
const resolveFilename = Module._resolveFilename
Module._resolveFilename = function resolveTypeScriptModules(request, parent, ...args) {
  if (request.startsWith('.') && !path.extname(request) && parent?.filename) {
    const candidate = path.resolve(path.dirname(parent.filename), `${request}.ts`)
    if (fs.existsSync(candidate)) request = candidate
  }
  return resolveFilename.call(this, request, parent, ...args)
}

const { scenarios } = require(path.join(__dirname, '../src/data.ts'))
const { analyzeDecisionReport, canViewProfessionalReport, evaluateDecision, PROFESSIONAL_REPORT_MIN_SCENARIOS } = require(path.join(__dirname, '../src/analysis.ts'))
const { createProgress, recordDecision } = require(path.join(__dirname, '../src/progress.ts'))

function run(firstIndex, secondIndex) {
  const scenario = scenarios[0]
  const first = scenario.steps.start.choices[firstIndex]
  const second = scenario.steps[first.next].choices[secondIndex]
  const afterFirst = recordDecision(createProgress(0, `run-${firstIndex}-${secondIndex}`), 'start', first, false)
  return recordDecision(afterFirst, first.next, second, true)
}

test('decision report changes with choices and ties development advice to observed behavior', () => {
  const strong = analyzeDecisionReport({ client: run(0, 0) })
  const weak = analyzeDecisionReport({ client: run(1, 1) })
  assert.ok(strong.score > weak.score)
  assert.notEqual(strong.level, weak.level)
  assert.ok(strong.evidenceCount === 2 && weak.evidenceCount === 2)
  assert.ok(strong.dimensions.some(item => item.label === 'التواصل' && item.score !== null))
  assert.ok(weak.recommendations.length > 0)
  assert.ok(weak.development.some(item => item.skill === 'إدارة الوقت' || item.skill === 'اتخاذ القرار'))
})

test('empty report is explicit and offers a useful next step', () => {
  const report = analyzeDecisionReport({})
  assert.equal(report.score, null)
  assert.equal(report.level, 'ابدأ أول موقف')
  assert.ok(report.recommendations[0].includes('ثلاثة مواقف'))
})

test('answer feedback clearly distinguishes a strength from a development opportunity', () => {
  assert.equal(evaluateDecision(3).kind, 'strength')
  assert.ok(evaluateDecision(3).guidance.includes('كرره'))
  assert.equal(evaluateDecision(1).kind, 'development')
  assert.ok(evaluateDecision(1).guidance.includes('أسلوب أكثر فاعلية'))
})

test('professional report unlock threshold is exactly three completed scenarios', () => {
  assert.equal(PROFESSIONAL_REPORT_MIN_SCENARIOS, 3)
  assert.equal(canViewProfessionalReport(0), false)
  assert.equal(canViewProfessionalReport(2), false)
  assert.equal(canViewProfessionalReport(3), true)
  assert.equal(canViewProfessionalReport(8), true)
})

test('report counts and analyzes only completed scenarios, including after progress persistence', () => {
  const completed = run(0, 0)
  const inProgress = { ...run(1, 1), completed: false }
  const restored = JSON.parse(JSON.stringify({ client: completed, colleagues: completed, pressure: inProgress }))
  const report = analyzeDecisionReport(restored)
  assert.equal(report.completedScenarios, 2)
  assert.equal(report.evidenceCount, 4)
  assert.deepEqual(report.strengths.flatMap(item => item.examples).some(example => example.includes('إرسال الملف المتاح فوراً')), false)
})
