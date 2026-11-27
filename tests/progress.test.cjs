const assert = require('node:assert/strict')
const fs = require('node:fs')
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

const { scenarios } = require(path.join(__dirname, '../src/data.ts'))
const { backProgress, createProgress, recordDecision } = require(path.join(__dirname, '../src/progress.ts'))

function completePath(scenario, firstChoice, secondChoice, progress = createProgress(0, 'attempt-one')) {
  const afterFirst = recordDecision(progress, 'start', firstChoice, false, '2026-01-01T10:00:00.000Z')
  return recordDecision(afterFirst, firstChoice.next, secondChoice, true, '2026-01-01T10:01:00.000Z')
}

test('the four existing scenarios retain tagged, skill-linked choices and record complete evidence', () => {
  assert.deepEqual(scenarios.map(scenario => scenario.id), ['client', 'colleagues', 'pressure', 'admin'])

  let choiceCount = 0
  for (const scenario of scenarios) {
    for (const [stepKey, step] of Object.entries(scenario.steps)) {
      for (const choice of step.choices) {
        choiceCount += 1
        assert.ok(choice.behavior.trim(), `${scenario.id}/${stepKey} behavior tag`)
        assert.ok(choice.skills.length > 0, `${scenario.id}/${stepKey} linked skills`)
        assert.ok(scenario.steps[choice.next], `${scenario.id}/${stepKey} next step exists`)
      }
    }

    for (const firstChoice of scenario.steps.start.choices) {
      for (const secondChoice of scenario.steps[firstChoice.next].choices) {
        const completed = completePath(scenario, firstChoice, secondChoice)
        assert.equal(completed.completed, true)
        assert.equal(completed.history.length, 2)
        assert.equal(completed.decisions, 2)
        assert.equal(completed.score, firstChoice.points + secondChoice.points)
        assert.deepEqual(completed.history.map(item => item.choice), [firstChoice.label, secondChoice.label])
        assert.deepEqual(completed.history.map(item => item.behavior), [firstChoice.behavior, secondChoice.behavior])
        assert.deepEqual(completed.history.map(item => item.skills), [firstChoice.skills, secondChoice.skills])
        assert.ok(completed.history.every(item => item.id && item.attemptId === 'attempt-one' && Number.isFinite(Date.parse(item.occurredAt))))
        assert.equal(new Set(completed.history.map(item => item.id)).size, completed.history.length)
      }
    }
  }

  assert.equal(choiceCount, 36)
})

test('back removes exactly the latest choice and recalculates the current run', () => {
  const scenario = scenarios[0]
  const firstChoice = scenario.steps.start.choices[0]
  const secondChoice = scenario.steps[firstChoice.next].choices[0]
  const completed = completePath(scenario, firstChoice, secondChoice)
  const best = completed.best

  const oneStepBack = backProgress(completed)
  assert.equal(oneStepBack.step, firstChoice.next)
  assert.equal(oneStepBack.history.length, 1)
  assert.equal(oneStepBack.decisions, 1)
  assert.equal(oneStepBack.score, firstChoice.points)
  assert.equal(oneStepBack.completed, false)
  assert.equal(oneStepBack.best, best)

  const atStart = backProgress(oneStepBack)
  assert.equal(atStart.step, 'start')
  assert.deepEqual(atStart.history, [])
  assert.equal(atStart.decisions, 0)
  assert.equal(atStart.score, 0)
  assert.equal(backProgress(atStart), null)
})

test('retry creates an empty attempt while keeping the best result separate', () => {
  const scenario = scenarios[0]
  const bestFirstChoice = scenario.steps.start.choices[0]
  const bestRun = completePath(scenario, bestFirstChoice, scenario.steps[bestFirstChoice.next].choices[0])
  assert.equal(bestRun.best, 100)

  const retry = createProgress(bestRun.best, 'attempt-two')
  assert.equal(retry.step, 'start')
  assert.equal(retry.score, 0)
  assert.equal(retry.decisions, 0)
  assert.equal(retry.completed, false)
  assert.equal(retry.best, 100)
  assert.deepEqual(retry.history, [])
  assert.notEqual(retry.attemptId, bestRun.attemptId)

  const lowerFirstChoice = scenario.steps.start.choices[1]
  const lowerRun = completePath(scenario, lowerFirstChoice, scenario.steps[lowerFirstChoice.next].choices[1], retry)
  assert.equal(lowerRun.score, 1)
  assert.equal(lowerRun.best, 100)
  assert.equal(lowerRun.history.length, 2)
  assert.ok(lowerRun.history.every(item => item.attemptId === 'attempt-two'))
  assert.ok(lowerRun.history.every(item => !bestRun.history.some(previous => previous.id === item.id)))
})

test('recording the same step and choice twice does not duplicate evidence', () => {
  const scenario = scenarios[0]
  const choice = scenario.steps.start.choices[0]
  const first = recordDecision(createProgress(0, 'attempt-dedupe'), 'start', choice, false, '2026-01-01T10:00:00.000Z')
  const duplicate = recordDecision(first, 'start', choice, false, '2026-01-01T10:00:01.000Z')

  assert.strictEqual(duplicate, first)
  assert.equal(duplicate.history.length, 1)
  assert.equal(new Set(duplicate.history.map(item => item.id)).size, 1)
})

test('reselecting after undo records one fresh item in the same attempt', () => {
  const scenario = scenarios[0]
  const choice = scenario.steps.start.choices[0]
  const first = recordDecision(createProgress(0, 'attempt-undo'), 'start', choice, false)
  const undone = backProgress(first)
  const selectedAgain = recordDecision(undone, 'start', choice, false)

  assert.equal(selectedAgain.history.length, 1)
  assert.equal(selectedAgain.decisions, 1)
  assert.equal(selectedAgain.attemptId, 'attempt-undo')
  assert.equal(selectedAgain.history[0].attemptId, 'attempt-undo')
})
