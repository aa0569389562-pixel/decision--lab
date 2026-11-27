const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../src/data.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const sandbox = { exports: {} }
vm.runInNewContext(compiled, sandbox)
const { DEFAULT_SCENARIO_FILTERS, filterScenarios, matchScenarios, resetScenarioFilters, scenarios } = sandbox.exports

test('every scenario has distinct questions and tailored options', () => {
  const prompts = []
  const options = []
  for (const scenario of scenarios) {
    for (const [stepId, step] of Object.entries(scenario.steps)) {
      if (!step.choices.length) continue
      prompts.push(`${step.title.trim()}|${step.body.trim()}`)
      for (const option of step.choices) options.push(option.label.trim())
      assert.ok(step.choices.length >= 2, `${scenario.id}/${stepId} needs meaningful options`)
    }
  }
  assert.equal(new Set(prompts).size, prompts.length, 'question text is repeated across scenarios or branches')
  assert.equal(new Set(options).size, options.length, 'answer option is repeated across scenarios or branches')
})

test('all scenario branches terminate and required skills are covered', () => {
  const visitedSkills = new Set()
  for (const scenario of scenarios) {
    for (const step of Object.values(scenario.steps)) {
      for (const option of step.choices) option.skills.forEach(skill => visitedSkills.add(skill))
    }
    const visit = (id, pathTaken = new Set()) => {
      assert.ok(scenario.steps[id], `${scenario.id} points to missing step ${id}`)
      assert.ok(!pathTaken.has(id), `${scenario.id} contains a cycle at ${id}`)
      const step = scenario.steps[id]
      if (!step.choices.length) return true
      const nextPath = new Set(pathTaken).add(id)
      return step.choices.every(option => visit(option.next, nextPath))
    }
    assert.equal(visit('start'), true)
  }
  for (const skill of ['التواصل', 'حل المشكلات', 'إدارة الخلاف', 'اتخاذ القرار', 'العمل الجماعي', 'إدارة الوقت', 'تحمل المسؤولية']) {
    assert.ok(visitedSkills.has(skill), `missing required skill: ${skill}`)
  }
})

test('personalization filters respect domain, skill, and difficulty together', () => {
  const results = filterScenarios(scenarios, { domain: 'إدارة الفرق', skill: 'العمل الجماعي', difficulty: 'متقدم' })
  assert.ok(results.length > 0)
  assert.ok(results.every(scenario => scenario.domain === 'إدارة الفرق' && scenario.skills.includes('العمل الجماعي') && scenario.difficulty === 'متقدم'))
  assert.ok(filterScenarios(scenarios, { domain: 'غير موجود', skill: 'الكل', difficulty: 'الكل' }).length > 0)
})

test('every available domain, skill, and difficulty combination returns exact or nearest scenarios', () => {
  const domains = [...new Set(scenarios.map(scenario => scenario.domain))]
  const skills = [...new Set(scenarios.flatMap(scenario => scenario.skills))]
  const difficulties = [...new Set(scenarios.map(scenario => scenario.difficulty))]
  for (const domain of domains) for (const skill of skills) for (const difficulty of difficulties) {
    const match = matchScenarios(scenarios, { domain, skill, difficulty })
    assert.ok(match.scenarios.length > 0, `${domain} / ${skill} / ${difficulty} must never be blank`)
    assert.ok(match.scenarios.length <= 3 || match.exact, 'fallback should be limited to the closest three scenarios')
    if (match.exact) assert.ok(match.scenarios.every(s => s.domain === domain && s.difficulty === difficulty && s.skills.includes(skill)))
    else assert.ok(match.scenarios.every(s => s.domain === domain || s.difficulty === difficulty || s.skills.includes(skill)), 'fallback must overlap at least one selected field')
  }
  assert.ok(domains.length > 1 && skills.length > 1 && difficulties.length === 3)
})

test('fallback ranks scenarios by the number of matching fields and counters reflect displayed results', () => {
  const result = matchScenarios(scenarios, { domain: 'إدارة الفرق', skill: 'التواصل', difficulty: 'مبتدئ' })
  assert.equal(result.exact, false)
  assert.equal(result.exactCount, 0)
  assert.ok(result.scenarios.length > 0)
  const score = scenario => (scenario.domain === 'إدارة الفرق' ? 4 : 0) + (scenario.skills.includes('التواصل') ? 3 : 0) + (scenario.difficulty === 'مبتدئ' ? 2 : 0)
  assert.equal(score(result.scenarios[0]), Math.max(...scenarios.map(score)))
  assert.equal(matchScenarios(scenarios, { domain: 'الكل', skill: 'الكل', difficulty: 'الكل' }).scenarios.length, scenarios.length)
})

test('scenario classifications use supported values and filter controls reset to all scenarios', () => {
  const domains = new Set(scenarios.map(scenario => scenario.domain))
  const availableSkills = new Set(scenarios.flatMap(scenario => scenario.skills))
  for (const scenario of scenarios) {
    assert.ok(domains.has(scenario.domain), `${scenario.id} has a known domain`)
    assert.ok(['مبتدئ', 'متوسط', 'متقدم'].includes(scenario.difficulty), `${scenario.id} has a supported difficulty`)
    assert.ok(['موظف', 'مشرف', 'قائد فريق'].includes(scenario.role), `${scenario.id} has a supported role`)
    assert.ok(scenario.skills.length > 0 && scenario.skills.every(skill => availableSkills.has(skill)))
  }
  assert.deepEqual(resetScenarioFilters(), DEFAULT_SCENARIO_FILTERS)
  assert.equal(filterScenarios(scenarios, resetScenarioFilters()).length, scenarios.length)
})

test('invalid saved filter values never produce an empty page or claim an exact match', () => {
  const result = matchScenarios(scenarios, { domain: 'مجال قديم', skill: 'مهارة محذوفة', difficulty: 'سهل جدًا' })
  assert.equal(result.exact, false)
  assert.equal(result.hasOverlap, false)
  assert.equal(result.exactCount, 0)
  assert.ok(result.scenarios.length > 0)
})
