const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

require.extensions['.ts'] = (loadedModule, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  loadedModule._compile(outputText, filename)
}

const resolveFilename = Module._resolveFilename
Module._resolveFilename = function resolveTypeScriptModules(request, parent, ...args) {
  if (request.startsWith('.') && !path.extname(request) && parent?.filename) {
    const typescriptPath = path.resolve(path.dirname(parent.filename), `${request}.ts`)
    if (fs.existsSync(typescriptPath)) request = typescriptPath
  }
  return resolveFilename.call(this, request, parent, ...args)
}

const { scenarios } = require(path.join(__dirname, '../src/data.ts'))
const { analyzeSkills } = require(path.join(__dirname, '../src/skills.ts'))

function evidence({ id, attemptId, skill, choice = 'تصرف عملي', behavior = 'تنسيق المعلومات', occurredAt = '2026-01-01T10:00:00.000Z' }) {
  return { id, attemptId, from: 'start', to: 'good', choice, behavior, skills: [skill], points: 2, feedback: 'ملاحظة', occurredAt }
}

function progress(attemptId, history) {
  return { attemptId, step: 'good', score: 2, decisions: history.length, completed: true, best: 70, history }
}

test('one choice alone never produces a skill inference', () => {
  const store = { client: progress('run-client', [evidence({ id: 'single', attemptId: 'run-client', skill: 'إدارة المخاطر' })]) }

  assert.deepEqual(analyzeSkills(store), [])
})

test('repeated evidence in an unlisted context is marked as a possible hidden skill and exposes its evidence', () => {
  const client = scenarios.find(scenario => scenario.id === 'client')
  const store = {
    client: progress('run-client', [
      evidence({ id: 'hidden-1', attemptId: 'run-client', skill: 'إدارة المخاطر', choice: 'أتريث وأفحص المخاطر' }),
      evidence({ id: 'hidden-2', attemptId: 'run-client', skill: 'إدارة المخاطر', choice: 'أحدد موعد مراجعة' }),
    ]),
  }
  const [insight] = analyzeSkills(store)

  assert.equal(insight.skill, 'إدارة المخاطر')
  assert.equal(insight.kind, 'hidden')
  assert.equal(insight.evidenceCount, 2)
  assert.equal(insight.scenarioCount, 1)
  assert.equal(insight.confidence, 'limited')
  assert.deepEqual(insight.evidence.map(item => item.id), ['hidden-1', 'hidden-2'])
  assert.ok(insight.evidence.every(item => item.scenarioId === client.id && item.scenarioTitle === client.title && item.behavior))
})

test('evidence across different scenarios is classified as transferable and names each context', () => {
  const store = {
    client: progress('run-client', [evidence({ id: 'transfer-1', attemptId: 'run-client', skill: 'التواصل الواضح' })]),
    colleagues: progress('run-colleagues', [evidence({ id: 'transfer-2', attemptId: 'run-colleagues', skill: 'التواصل الواضح' })]),
  }
  const [insight] = analyzeSkills(store)

  assert.equal(insight.kind, 'transferable')
  assert.equal(insight.scenarioCount, 2)
  assert.equal(insight.evidenceCount, 2)
  assert.equal(insight.confidence, 'limited')
  assert.deepEqual(new Set(insight.evidence.map(item => item.scenarioTitle)), new Set(['عميل غاضب', 'خلاف بين زملاء']))

  const mediumStore = {
    ...store,
    pressure: progress('run-pressure', [evidence({ id: 'transfer-3', attemptId: 'run-pressure', skill: 'التواصل الواضح' })]),
  }
  const mediumSignal = analyzeSkills(mediumStore)[0]
  assert.equal(mediumSignal.confidence, 'medium')
  assert.equal(mediumSignal.evidenceCount, 3)

  const broaderStore = {
    ...mediumStore,
    admin: progress('run-admin', [evidence({ id: 'transfer-4', attemptId: 'run-admin', skill: 'التواصل الواضح' })]),
  }
  const strongerSignal = analyzeSkills(broaderStore)[0]
  assert.equal(strongerSignal.confidence, 'high')
  assert.equal(strongerSignal.evidenceCount, 4)
  assert.equal(strongerSignal.scenarioCount, 4)
})

test('repeated declared skills remain distinct from hidden and transferable classifications', () => {
  const store = {
    client: progress('run-client', [
      evidence({ id: 'context-1', attemptId: 'run-client', skill: 'الإنصات الفعّال' }),
      evidence({ id: 'context-2', attemptId: 'run-client', skill: 'الإنصات الفعّال' }),
    ]),
  }
  const [insight] = analyzeSkills(store)

  assert.equal(insight.kind, 'contextual')
  assert.equal(insight.evidenceCount, 2)
  assert.equal(insight.scenarioCount, 1)
})

test('duplicate evidence is counted once and evidence from another attempt is excluded', () => {
  const first = evidence({ id: 'same-event', attemptId: 'run-current', skill: 'التخطيط' })
  const second = evidence({ id: 'second-event', attemptId: 'run-current', skill: 'التخطيط' })
  const duplicate = { ...first, choice: 'نسخة مكررة' }
  const stale = evidence({ id: 'stale-event', attemptId: 'run-previous', skill: 'التخطيط' })
  const store = { client: progress('run-current', [first, duplicate, second, stale]) }
  const [insight] = analyzeSkills(store)

  assert.equal(insight.evidenceCount, 2)
  assert.deepEqual(insight.evidence.map(item => item.id), ['same-event', 'second-event'])
  assert.ok(insight.evidence.every(item => item.attemptId === 'run-current'))
})
