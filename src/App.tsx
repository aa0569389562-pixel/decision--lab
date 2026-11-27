import { useEffect, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronLeft, Clock3, Compass, Menu, RotateCcw, Sparkles, Target, Trophy, X } from 'lucide-react'
import { scenarios, type Scenario } from './data'
import { backProgress, createProgress, recordDecision, type Progress } from './progress'
import { analyzeSkills, type SkillInsight } from './skills'

type Store = Record<string, Progress>
const KEY = 'decision-lab-progress-v1'
function loadStore(): Store { try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Store } catch { return {} } }

export default function App() {
  const [store, setStore] = useState<Store>(loadStore)
  const [active, setActive] = useState<string | null>(null)
  const [page, setPage] = useState<'home' | 'results'>('home')
  const [mobileMenu, setMobileMenu] = useState(false)
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(store)) }, [store])
  const completed = scenarios.filter(s => store[s.id]?.completed)
  const score = completed.length ? Math.round(completed.reduce((n, s) => n + (store[s.id]?.best || 0), 0) / completed.length) : 0
  const begin = (scenario: Scenario, restart = false) => {
    const previous = store[scenario.id]
    if (restart || !previous || previous.completed) setStore(v => ({ ...v, [scenario.id]: createProgress(previous?.best || 0) }))
    setActive(scenario.id); setPage('home'); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const backHome = () => { setActive(null); setPage('home'); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const navigate = (next: 'home' | 'results') => { setActive(null); setPage(next); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const current = scenarios.find(s => s.id === active)
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#" onClick={e => { e.preventDefault(); backHome() }}><span className="brand-mark"><Compass size={19}/></span><span><strong>DECISION LAB</strong><small>مختبر القرار</small></span></a>
      <button className="mobile-menu" aria-label="فتح القائمة" onClick={() => setMobileMenu(v => !v)}>{mobileMenu ? <X size={20}/> : <Menu size={20}/>}</button>
      <nav className={mobileMenu ? 'nav-links open' : 'nav-links'}><button className={!active && page === 'home' ? 'nav-active' : ''} onClick={() => navigate('home')}>الرئيسية</button><a href="#scenarios" onClick={() => { setActive(null); setPage('home'); setMobileMenu(false) }}>التجارب</a><button className={page === 'results' ? 'nav-active' : ''} onClick={() => navigate('results')}>لوحة النتائج</button></nav>
      <button className="nav-cta" onClick={() => document.getElementById('scenarios')?.scrollIntoView({ behavior: 'smooth' })}>ابدأ التجربة <ArrowUpRight size={15}/></button>
    </header>
    {active && current ? <Simulation key={active} scenario={current} progress={store[active] || createProgress()} setProgress={p => setStore(v => ({ ...v, [active]: p }))} onBack={backHome} onRestart={() => begin(current, true)}/> : page === 'results' ? <Results store={store} completed={completed.length} score={score} onPlay={s => begin(s)} onHome={backHome}/> : <Landing store={store} completed={completed.length} onPlay={s => begin(s)}/>}
    <footer className="footer"><a className="footer-brand" href="#" onClick={e => { e.preventDefault(); backHome() }}>DECISION LAB <span>·</span> مختبر القرار</a><span>مساحة آمنة للتجربة والتعلّم</span><span className="footer-note">المحتوى تدريبي للتفكير العملي، وليس تقييماً علمياً أو نفسياً معتمداً.</span></footer>
  </div>
}

function Landing({ store, completed, onPlay }: { store: Store; completed: number; onPlay: (s: Scenario) => void }) {
  const first = scenarios[0]
  return <main>
    <section className="hero"><div className="hero-grain"/><div className="hero-content"><div className="eyebrow light"><span/> مساحة تفاعلية لاتخاذ القرار</div><h1>كل قرار<br/><span>يصنع فرقاً.</span></h1><p>جرّب مواقف تشبه الواقع، استكشف اختياراتك، واكتشف ما يمكن أن يتغير عندما ترى المشهد من زاوية أخرى.</p><div className="hero-actions"><button className="button button-ivory" onClick={() => onPlay(first)}>ابدأ التجربة <ArrowLeft size={17}/></button><a className="text-link light-link" href="#scenarios">استكشف المختبر <ArrowDown size={16}/></a></div><div className="hero-proof"><div className="proof-avatars"><span>م</span><span>ق</span><span>ر</span></div><span>تعلّم بالممارسة، على طريقتك</span></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><div className="orbit-core"><span className="core-center">DL</span><span className="core-dot dot-a"/><span className="core-dot dot-b"/><span className="core-dot dot-c"/></div><div className="orbit-label label-a">القرار</div><div className="orbit-label label-b">الأثر</div><div className="orbit-label label-c">التعلّم</div><span className="hero-spark spark-a">✳</span><span className="hero-spark spark-b">✳</span></div><div className="hero-meta"><span>01 — مساحة التجربة</span><span>DECISION LAB&nbsp; / &nbsp;EST. FOR LEARNING</span></div></section>
    <section className="stats-strip"><div><span className="stat-icon"><Compass size={18}/></span><div><strong>أربع تجارب</strong><small>مواقف عملية متعددة</small></div></div><span className="strip-rule"/><div><span className="stat-icon"><BookOpen size={18}/></span><div><strong>تعلّم من كل اختيار</strong><small>نتيجة وتفسير لكل مسار</small></div></div><span className="strip-rule"/><div><span className="stat-icon"><Sparkles size={18}/></span><div><strong>مساحة آمنة للتجربة</strong><small>تقدمك محفوظ على جهازك</small></div></div><div className="stat-progress"><small>إنجازك</small><strong>{completed} <span>/ ٤ تجارب</span></strong><div className="mini-progress"><i style={{ width: (completed / scenarios.length * 100) + '%' }}/></div></div></section>
    <section className="section discover" id="discover"><div className="section-heading"><div><span className="eyebrow"><span/> الفكرة</span><h2>المختبر مساحة<br/>لتجربة <em>ما بعد القرار.</em></h2></div><p>لا توجد إجابة سحرية. فقط مواقف قريبة من يومك، وقراراتك أنت، ومساحة للتوقف وملاحظة ما يحدث.</p></div><div className="discover-cards"><article className="discover-card dark-card"><span className="card-count">01 / استكشف</span><div className="graphic graphic-rings"><span/><span/><span/><b>؟</b></div><h3>ماذا لو اخترت بشكل مختلف؟</h3><p>كل اختيار يفتح مساراً جديداً ويكشف أثراً لم يكن واضحاً من البداية.</p></article><article className="discover-card lavender-card"><span className="card-count">02 / تعلّم</span><div className="graphic graphic-path"><span className="path-line"/><i/><i/><i/><b>↗</b></div><h3>افهم السياق قبل الحل</h3><p>تعرّف على الإشارات المهمة، واكتشف كيف يشكّل السياق جودة القرار.</p></article><article className="discover-card cream-card"><span className="card-count">03 / كرّر</span><div className="graphic graphic-spark"><span>✳</span><i/><i/></div><h3>جرّب مجدداً، برؤية جديدة</h3><p>العودة إلى التجربة فرصة لترى خيارات لم تنتبه إليها من المرة الأولى.</p></article></div></section>
    <section className="skills-section"><div className="skills-orb" aria-hidden="true"><span>القرار<br/>يبدأ من هنا</span><i/><i/><i/></div><div className="skills-copy"><span className="eyebrow light"><span/> مهارات تنمو بالممارسة</span><h2>قرارات أوضح.<br/><span>أثر أفضل.</span></h2><p>لا نقيس شخصيتك ولا نصنفك. نمنحك مساحة تتدرّب فيها على مهارات عملية وتفكّر في أثر اختياراتك.</p><div className="skill-pills">{['التواصل والإنصات','حل النزاعات','ترتيب الأولويات','إدارة الأزمات','التفكير النقدي','القيادة'].map(x => <span key={x}><Check size={13}/>{x}</span>)}</div><a href="#scenarios" className="text-link light-link">اكتشف التجارب <ArrowLeft size={16}/></a></div><span className="skills-index">02 — المهارات</span></section>
    <section className="section scenarios-section" id="scenarios"><div className="section-heading scenario-heading"><div><span className="eyebrow"><span/> مساحة التجربة</span><h2>مواقف من <em>الحياة العملية.</em></h2></div><p>اختر موقفاً، اتبع حدسك، ثم شاهد كيف تتطور القصة. يمكنك العودة وإعادة التجربة في أي وقت.</p></div><div className="scenario-grid">{scenarios.map(s => <ScenarioCard key={s.id} scenario={s} progress={store[s.id]} onPlay={onPlay}/>)}</div><div className="disclaimer"><span className="info-dot">i</span><p>التجارب تدريبية وتأملية، ولا تمثّل نتائج علمية أو اختباراً نفسياً معتمداً.</p></div></section>
    <section className="closing"><span className="eyebrow light"><span/> خطوتك التالية</span><h2>ما الذي ستختاره<br/><em>هذه المرة؟</em></h2><p>ابدأ بموقف واحد. لا توجد إجابة مثالية—هناك دائماً ما يمكن اكتشافه.</p><button className="button button-ivory" onClick={() => onPlay(first)}>ابدأ التجربة الأولى <ArrowLeft size={17}/></button><div className="closing-star">✳</div></section>
  </main>
}

function ScenarioCard({ scenario: s, progress, onPlay }: { scenario: Scenario; progress?: Progress; onPlay: (s: Scenario) => void }) {
  const done = progress?.completed
  return <article className={'scenario-card ' + s.color}><div className="scenario-card-top"><span className="scenario-number">{s.number} <i/> {s.category}</span><span className="scenario-icon">{s.icon}</span></div><h3>{s.title}</h3><p>{s.description}</p><div className="scenario-tags"><span><Clock3 size={13}/>{s.duration}</span><span><Target size={13}/>{s.level}</span></div><div className="scenario-card-bottom"><span className={done ? 'status-done' : progress ? 'status-progress' : 'status-new'}>{done ? <><Check size={13}/> مكتملة</> : progress ? 'قيد التقدم' : 'متاحة الآن'}</span><button aria-label={(done ? 'أعد' : progress ? 'تابع' : 'ابدأ') + ' تجربة ' + s.title} onClick={() => onPlay(s)}>{done ? 'إعادة التجربة' : progress ? 'تابع التجربة' : 'ابدأ التجربة'} <ChevronLeft size={15}/></button></div></article>
}

function Simulation({ scenario, progress, setProgress, onBack, onRestart }: { scenario: Scenario; progress: Progress; setProgress: (p: Progress) => void; onBack: () => void; onRestart: () => void }) {
  const step = scenario.steps[progress.step] || scenario.steps.start
  const isEnd = step.choices.length === 0
  const percentage = Math.round(progress.score / Math.max(progress.decisions * 3, 1) * 100)
  const result = percentage >= 75 ? { label: 'ملاحظة دقيقة', text: 'أظهرت اختياراتك اهتماماً بالسياق وبناء خطوة عملية. جرّب إعادة القصة لاستكشاف مسار آخر.', icon: '✳' } : percentage >= 40 ? { label: 'بداية جيدة', text: 'وازنت بين أكثر من اعتبار. راجع أثر كل اختيار على الأطراف، وحدد خطوة متابعة واضحة.', icon: '↗' } : { label: 'مساحة للنمو', text: 'القرارات السريعة قد تكون مفيدة، ويقوى أثرها عندما يصحبها تحقق وتواصل واضح.', icon: '◎' }
  const choose = (choice: typeof step.choices[number]) => {
    const next = scenario.steps[choice.next]
    setProgress(recordDecision(progress, progress.step, choice, next?.choices.length === 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const goBack = () => {
    const previous = backProgress(progress)
    if (!previous) { onBack(); return }
    setProgress(previous)
  }
  return <main className="simulation-page"><div className="sim-top"><button className="back-link" onClick={goBack}><ArrowRight size={16}/> رجوع</button><span className="sim-brand">DECISION LAB <i>·</i> تجربة {scenario.number}</span><button className="exit-link" onClick={onBack}>حفظ وخروج <ArrowUpRight size={14}/></button></div><div className="sim-layout"><aside className="sim-aside"><span className={'sim-symbol ' + scenario.color}>{scenario.icon}</span><span className="eyebrow"><span/> {scenario.category}</span><h1>{scenario.title}</h1><p>{scenario.description}</p><div className="sim-aside-rule"/><small className="aside-label">مهارات هذا الموقف</small>{scenario.skills.map(x => <span className="aside-skill" key={x}><Check size={13}/>{x}</span>)}<div className="local-save"><span><Check size={13}/></span><p><strong>تقدمك محفوظ محلياً</strong><small>على هذا الجهاز فقط</small></p></div></aside><section className="sim-main"><div className="sim-progress-row"><div><span>التقدم</span><strong>{isEnd ? 'اكتملت التجربة' : 'الخطوة ' + Math.min(progress.decisions + 1, 3) + ' من ٣'}</strong></div><span className="sim-step-icon">{isEnd ? <Check size={16}/> : String(progress.decisions + 1).padStart(2, '0') + ' / 03'}</span><div className="sim-progress-track"><i style={{ width: (isEnd ? 100 : Math.min(18 + progress.decisions * 33, 86)) + '%' }}/></div></div><div className="story-card"><span className="eyebrow"><span/> {step.eyebrow}</span><h2>{step.title}</h2><p>{step.body}</p>{!isEnd && <div className="choice-list"><h3>كيف ستتصرف؟</h3>{step.choices.map((c, i) => <button className="choice" key={c.label} onClick={() => choose(c)}><span className="choice-letter">{['أ','ب','ج'][i]}</span><span className="choice-copy"><strong>{c.label}</strong><small>{c.detail}</small></span><ChevronLeft size={17}/></button>)}</div>}{isEnd && <div className="result-box"><span className="result-icon">{result.icon}</span><div><span className="eyebrow">قراءة تعليمية · {result.label}</span><p>{result.text}</p></div></div>}{isEnd && <div className="final-actions"><button className="button button-dark" onClick={onRestart}><RotateCcw size={15}/> أعد التجربة</button><button className="button button-outline" onClick={onBack}>العودة للمختبر <ArrowLeft size={15}/></button></div>}<div className="story-foot"><span><Sparkles size={14}/> لا توجد إجابة واحدة مثالية</span><span>مساحة آمنة للتجربة</span></div></div>{progress.lastFeedback && <div className="feedback-note"><span><Check size={15}/></span><div><strong>ما وراء اختيارك</strong><p>{progress.lastFeedback}</p></div></div>}{(progress.history?.length || 0) > 0 && <details className="evidence-history"><summary>سجل اختياراتك ({progress.history?.length})</summary><ol>{progress.history?.map((item, index) => <li key={item.id}><strong>{item.choice}</strong><p>السلوك الملحوظ: {item.behavior}</p><p>مهارات قد يرتبط بها: {item.skills.join('، ')}</p><small>الاختيار {index + 1} · {new Date(item.occurredAt).toLocaleString('ar-SA')}</small></li>)}</ol><small>كل اختيار إشارة منفردة ولا يكفي وحده لإثبات امتلاك مهارة.</small></details>}</section></div></main>
}

function Results({ store, completed, score, onPlay, onHome }: { store: Store; completed: number; score: number; onPlay: (s: Scenario) => void; onHome: () => void }) {
  const totalDecisions = scenarios.reduce((n, s) => n + (store[s.id]?.decisions || 0), 0)
  return <main className="results-page"><div className="results-head"><span className="eyebrow"><span/> لوحتك الشخصية</span><h1>رحلتك في <em>المختبر.</em></h1><p>مؤشرات تعلمك محلية وخاصة بك. أعد التجارب لتستكشف مسارات جديدة.</p></div><section className="metric-grid"><article className="metric-card"><span className="metric-icon purple"><Check size={18}/></span><small>تجارب مكتملة</small><strong>{completed}<i> / ٤</i></strong><div className="mini-progress"><i style={{ width: (completed / 4 * 100) + '%' }}/></div></article><article className="metric-card"><span className="metric-icon peach"><Compass size={18}/></span><small>اختيارات استكشفتها</small><strong>{totalDecisions}</strong><span className="metric-caption">عبر جميع تجاربك</span></article><article className="metric-card"><span className="metric-icon mint"><Trophy size={18}/></span><small>مؤشر التأمل</small><strong>{completed ? score + '%' : '—'}</strong><span className="metric-caption">ملخص داخلي لمساراتك، وليس تقييماً علمياً</span></article></section><SkillReport insights={analyzeSkills(store)} /><div className="results-title"><h2>تجاربك</h2><button className="plain-button" onClick={onHome}><ArrowRight size={15}/> العودة للرئيسية</button></div><div className="results-list">{scenarios.map(s => { const p = store[s.id]; return <article className="result-row" key={s.id}><span className={'result-row-icon ' + s.color}>{s.icon}</span><div className="result-row-main"><strong>{s.title}</strong><small>{p?.completed ? 'مكتملة · ' + p.decisions + ' اختيارات' : p ? 'قيد التقدم · ' + p.decisions + ' اختيارات' : 'لم تبدأ بعد'}</small></div><span className={p?.completed ? 'status-done' : p ? 'status-progress' : 'status-new'}>{p?.completed ? 'مكتملة' : p ? 'قيد التقدم' : 'جديدة'}</span><button onClick={() => onPlay(s)}>{p ? 'متابعة' : 'ابدأ'} <ChevronLeft size={14}/></button></article>})}</div><p className="results-disclaimer"><span>i</span> هذه المؤشرات تصف تفاعلك مع التجارب فقط، ولا تقيس مهاراتك أو شخصيتك.</p></main>
}

function SkillReport({ insights }: { insights: SkillInsight[] }) {
  const kindLabels: Record<SkillInsight['kind'], string> = {
    hidden: 'مهارة محتملة خفية',
    transferable: 'مهارة قابلة للنقل',
    contextual: 'مهارة متكررة في سياقها',
  }
  const kindDescriptions: Record<SkillInsight['kind'], string> = {
    hidden: 'تكررت في موقف لم يذكرها ضمن مهاراته المعلنة.',
    transferable: 'ظهرت قرائنها في أكثر من موقف.',
    contextual: 'تكررت ضمن المهارات المعلنة لهذا الموقف.',
  }

  return <section className="skills-report" aria-labelledby="skills-report-title">
    <div className="skills-report-heading"><span className="eyebrow"><span/> قراءة قرائن سلوكية</span><h2 id="skills-report-title">مهارات تدعمها <em>اختياراتك.</em></h2><p>لا تُعرض أي مهارة من اختيار واحد. التصنيف والثقة يصفان الأدلة المسجلة فقط، ولا يثبتان امتلاك مهارة أو يشكلان تشخيصاً علمياً.</p></div>
    {insights.length === 0 ? <div className="skills-report-empty">ستظهر المهارات المرشحة بعد توفر قرينتين مستقلتين على الأقل. جرّب مواقف متعددة لتظهر إمكانية انتقال المهارة بين السياقات.</div> : <div className="skill-insight-grid">{insights.map(insight => <article className="skill-insight-card" key={insight.skill}>
      <div className="skill-insight-top"><div><span className={'skill-kind ' + insight.kind}>{kindLabels[insight.kind]}</span><h3>{insight.skill}</h3></div><span className="skill-count">{insight.evidenceCount} قرائن</span></div>
      <p className="skill-kind-description">{kindDescriptions[insight.kind]} ظهرت في {insight.scenarioCount} مواقف.</p>
      <p className="skill-confidence">قوة الإشارة: {insight.confidenceLabel}</p>
      <details className="skill-evidence"><summary>عرض الأدلة والمواقف</summary><ol>{insight.evidence.map(item => <li key={item.id}>
        <strong>{item.scenarioTitle} · {item.scenarioCategory}</strong><span>الاختيار: {item.choice}</span><span>السلوك الملحوظ: {item.behavior}</span><small>المحاولة {item.attemptId} · {new Date(item.occurredAt).toLocaleString('ar-SA')}</small>
      </li>)}</ol></details>
    </article>)}</div>}
    <p className="skills-report-note">مستوى الثقة يعكس تكرار القرائن وتنوع المواقف: محدود (قرينتان فأكثر)، متوسط (3 قرائن عبر موقفين فأكثر)، مرتفع (4 قرائن عبر 3 مواقف فأكثر).</p>
  </section>
}
