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
const { filterScenarios, scenarios } = sandbox.exports

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
  assert.equal(filterScenarios(scenarios, { domain: 'غير موجود', skill: 'الكل', difficulty: 'الكل' }).length, 0)
})
