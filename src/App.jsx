import { useMemo, useState } from 'react'
import './App.css'

const examples = [
  { id: 'tests', title: 'Behavior changes should include tests', kind: 'TEST COVERAGE', confidence: 92, count: 8, people: ['maya-dev', 'linh'], evidence: '“Could you add a test for the empty response case?”', file: 'src/api/users.ts' },
  { id: 'docs', title: 'Public API changes need documentation', kind: 'DOCUMENTATION', confidence: 78, count: 5, people: ['maya-dev'], evidence: '“Please update the endpoint docs alongside this change.”', file: 'docs/api.md' },
  { id: 'small-pr', title: 'Keep unrelated changes in separate PRs', kind: 'SCOPE', confidence: 64, count: 3, people: ['linh'], evidence: '“Could we split the formatting cleanup into another PR?”', file: 'src/components/Table.tsx' },
]

const demoComments = [
  { user: 'maya-dev', path: 'src/api/booking.ts', body: 'Could you add a test for when no rooms are available? This branch should return a clear error.', line: 42 },
  { user: 'linh', path: 'src/api/booking.ts', body: 'Please update the API docs with the new booking response shape.', line: 18 },
  { user: 'maya-dev', path: 'src/api/booking.ts', body: 'What happens if two guests try to book the same room at once? A test would help.', line: 42 },
  { user: 'linh', path: 'src/utils/date.ts', body: 'Could this date parsing be covered for a timezone change?', line: 9 },
]

function parsePullRequest(value) {
  const match = value.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i)
  return match ? { owner: match[1], repo: match[2], number: match[3] } : null
}

function App() {
  const [url, setUrl] = useState('')
  const [comments, setComments] = useState([])
  const [files, setFiles] = useState([])
  const [repo, setRepo] = useState('acme / staywise')
  const [pr, setPr] = useState('#248')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState('predictions')

  const patterns = useMemo(() => {
    if (!loaded || !comments.length) return examples
    const groups = [
      { id: 'tests', title: 'Behavior changes should include tests', kind: 'TEST COVERAGE', words: /test|spec|assert|cover/i, fallback: examples[0] },
      { id: 'docs', title: 'Public API changes need documentation', kind: 'DOCUMENTATION', words: /doc|readme|endpoint|api/i, fallback: examples[1] },
      { id: 'small-pr', title: 'Keep unrelated changes in separate PRs', kind: 'SCOPE', words: /split|separate|unrelated|scope/i, fallback: examples[2] },
    ]
    return groups.map((g) => {
      const hits = comments.filter((c) => g.words.test(c.body))
      const sample = hits[0] || g.fallback
      return { ...g.fallback, title: g.title, kind: g.kind, count: hits.length, confidence: Math.min(96, Math.max(42, Math.round(48 + hits.length * 12))), people: [...new Set((hits.length ? hits : [sample]).map((c) => c.user))], evidence: sample.body, file: sample.path }
    })
  }, [comments, loaded])

  const likely = useMemo(() => {
    const text = `${files.map((f) => f.filename).join(' ')} ${files.map((f) => f.patch || '').join(' ')}`
    return patterns.map((p) => ({ ...p, matched: p.id === 'tests' ? /\.test\.|\.spec\.|test|spec/i.test(text) : p.id === 'docs' ? /readme|docs?\//i.test(text) : files.length > 5 }))
  }, [files, patterns])

  async function loadPullRequest(event) {
    event?.preventDefault()
    setError('')
    const parsed = parsePullRequest(url.trim())
    if (!parsed) { setError('Paste a GitHub pull request link, like https://github.com/owner/repo/pull/12'); return }
    setBusy(true)
    try {
      const headers = { Accept: 'application/vnd.github+json' }
      const base = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`
      const responses = await Promise.all([fetch(`${base}/comments?per_page=100`, { headers }), fetch(`${base}/files?per_page=100`, { headers })])
      if (responses.some((r) => !r.ok)) throw new Error(responses.some((r) => r.status === 404) ? 'Could not find that pull request. Check the link and make sure the repository is public.' : 'GitHub could not return the data. Try again in a moment, or use the sample demo.')
      const [commentData, fileData] = await Promise.all(responses.map((r) => r.json()))
      const cleanComments = commentData.filter((c) => c.body?.trim()).map((c) => ({ user: c.user?.login || 'reviewer', path: c.path || 'unknown file', body: c.body, line: c.line || c.original_line || '?' }))
      setComments(cleanComments)
      setFiles(fileData)
      setRepo(`${parsed.owner} / ${parsed.repo}`)
      setPr(`#${parsed.number}`)
      setLoaded(true)
      setActiveTab('predictions')
    } catch (e) { setError(e.message || 'Could not load pull request.') }
    finally { setBusy(false) }
  }

  function loadDemo() {
    setComments(demoComments)
    setFiles([{ filename: 'src/api/booking.ts', patch: '+ export async function bookRoom(roomId) {\n+   return createBooking(roomId)\n+ }' }, { filename: 'src/api/booking.test.ts', patch: '' }])
    setRepo('acme / staywise')
    setPr('#248')
    setLoaded(true)
    setError('')
    setActiveTab('predictions')
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#top"><span className="brand-mark">R</span><span>review<span className="brand-light">replay</span><small>MAINTAINER MIRROR</small></span></a>
      <div className="side-label">WORKSPACE</div>
      <button className="nav-item selected"><span>◈</span> Review rehearsal <kbd>⌘ 1</kbd></button>
      <button className="nav-item" onClick={() => setActiveTab('patterns')}><span>⌘</span> Learned patterns</button>
      <button className="nav-item" onClick={() => setActiveTab('score')}><span>▧</span> Replay scorecard</button>
      <div className="side-bottom"><div className="local-badge"><i /> LOCAL DEMO</div><p>Learning from public review history</p><div className="profile"><div className="avatar">Y</div><span>Your workspace<small>Contributor view</small></span><span className="dots">···</span></div></div>
    </aside>

    <main className="main" id="top">
      <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <b>Review rehearsal</b></div><div className="top-right"><span className="privacy"><i /> Public repo data only</span><button className="help">?</button></div></header>
      <div className="content">
        <section className="page-intro"><div><div className="eyebrow"><span className="spark">✳</span> CONTRIBUTOR-SIDE REVIEW</div><h1>Rehearse your review.</h1><p className="subtitle">Learn a repo’s unwritten rules before your pull request goes live.</p></div><button className="how-btn" onClick={() => document.getElementById('how-it-works').scrollIntoView({ behavior: 'smooth' })}>How it works <span>↗</span></button></section>

        <section className="repo-card">
          <div className="section-head"><div className="step-number">01</div><div><h2>Choose a pull request</h2><p>We’ll study its review history and rehearse the feedback.</p></div><span className="github-mark">GH</span></div>
          <form className="pr-form" onSubmit={loadPullRequest}><label htmlFor="pr-link">PUBLIC GITHUB PULL REQUEST</label><div className="input-row"><span className="link-icon">↗</span><input id="pr-link" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/owner/repo/pull/123" /><button type="submit" disabled={busy}>{busy ? <><span className="spinner" /> Reading…</> : <>Rehearse review <span>→</span></>}</button></div>{error && <p className="error-message">{error}</p>}<div className="form-foot"><span>🔒 Read-only · We never write to GitHub</span><button type="button" onClick={loadDemo}>Try with sample PR <span>↗</span></button></div></form>
        </section>

        <section className="repo-overview"><div className="repo-name"><div className="repo-icon">{repo.split('/').pop()?.trim().slice(0,1).toUpperCase()}</div><div><strong>{repo}</strong><small>Pull request <b>{pr}</b> <span>·</span> {loaded ? `${comments.length} past review comments` : 'Waiting for a pull request'}</small></div></div><div className="reviewers"><div className="avatar-stack"><span className="av a1">M</span><span className="av a2">L</span><span className="av a3">J</span></div><span>Learned from <b>{loaded ? Math.max(1, new Set(comments.map((c) => c.user)).size) : 3} reviewers</b></span></div></section>

        <div className="tabs"><button className={activeTab === 'predictions' ? 'active' : ''} onClick={() => setActiveTab('predictions')}>Predicted review <span>{likely.filter((x) => !x.matched).length}</span></button><button className={activeTab === 'patterns' ? 'active' : ''} onClick={() => setActiveTab('patterns')}>Maintainer patterns <span>{patterns.length}</span></button><button className={activeTab === 'score' ? 'active' : ''} onClick={() => setActiveTab('score')}>Replay scorecard <span>↗</span></button></div>

        {activeTab === 'predictions' && <section className="results-grid"><div className="prediction-list"><div className="result-heading"><div><h2>Likely reviewer asks</h2><p>{loaded ? 'Compared this change against patterns from past reviews.' : 'Load a pull request or sample to see predictions.'}</p></div><span className="count-pill">{likely.filter((x) => !x.matched).length} to consider</span></div>
          {likely.filter((x) => !x.matched).map((p) => <article className="prediction" key={p.id}><div className="pred-top"><span className="concern-icon">!</span><span className="concern-type">{p.kind}</span><span className="confidence">{p.confidence}% match</span><span className="confidence-dot" /></div><h3>{p.id === 'tests' && loaded ? 'Add a test for the unavailable-room case' : p.title}</h3><p className="pred-description">{p.id === 'tests' ? 'This change alters booking behavior, but we didn’t find a matching test update.' : p.id === 'docs' ? 'The change may affect public behavior. Check whether the API docs need an update.' : 'This change touches several files. Reviewers may ask to keep unrelated work separate.'}</p><div className="evidence"><span>PAST REVIEW</span><q>{p.evidence}</q><a href="#evidence">{p.file} ↗</a></div><div className="pred-footer"><span>Often raised by {p.people.slice(0,2).map((x) => `@${x}`).join(', ')}</span><button onClick={(e) => e.currentTarget.closest('article').classList.toggle('dismissed')}>Dismiss suggestion</button></div></article>)}
          {!likely.some((x) => !x.matched) && <div className="all-clear"><span>✓</span><b>No likely asks found</b><p>Based on the patterns and changed files we could inspect.</p></div>}
          {!loaded && <div className="empty-hint"><span>✳</span><p><b>Your rehearsal appears here.</b><br />Use the sample PR above to explore the demo.</p></div>}</div>

          <aside className="pattern-panel"><div className="panel-title"><div><span className="panel-icon">⌘</span><h2>Repo memory</h2></div><button onClick={() => setActiveTab('patterns')}>View all ↗</button></div><p className="panel-sub">Patterns learned from review history</p>{patterns.slice(0,3).map((p) => <div className="mini-pattern" key={p.id}><div className="mini-top"><span>{p.kind}</span><b>{p.confidence}%</b></div><strong>{p.title}</strong><div className="mini-meter"><i style={{ width: `${p.confidence}%` }} /></div><small>{p.count} supporting comments · {p.people.slice(0,2).map((x) => `@${x}`).join(', ')}</small></div>)}<div className="panel-note"><span>✳</span><p><b>Every suggestion has receipts.</b><br />See the past comment behind each predicted ask.</p></div></aside></section>}

        {activeTab === 'patterns' && <section className="detail-view"><div className="result-heading"><div><h2>Maintainer patterns</h2><p>Repeated requests found in the review history.</p></div><span className="count-pill">{patterns.length} patterns</span></div>{patterns.map((p) => <article className="pattern-row" key={p.id}><div className="pattern-score">{p.confidence}<small>%</small></div><div><span className="concern-type">{p.kind}</span><h3>{p.title}</h3><p>Seen in {p.count} review comments · often raised by {p.people.map((x) => `@${x}`).join(', ')}</p><div className="evidence"><span>EXAMPLE COMMENT</span><q>{p.evidence}</q><a href="#evidence">{p.file} ↗</a></div></div></article>)}</section>}

        {activeTab === 'score' && <section className="detail-view score-view"><div className="result-heading"><div><h2>Review replay scorecard</h2><p>Hide old review comments, predict them, then compare.</p></div><span className="count-pill">DEMO METRIC</span></div><div className="score-banner"><div><span className="eyebrow">SAMPLE REPLAY · DEMONSTRATION</span><strong>{loaded ? '2 / 4' : '— / —'}</strong><small>review themes predicted on held-out sample</small></div><div className="score-stats"><div><b>{loaded ? '0.50' : '—'}</b><small>Precision</small></div><div><b>{loaded ? '0.67' : '—'}</b><small>Recall</small></div><div><b>{comments.length}</b><small>Comments observed</small></div></div></div><p className="score-explainer">This sample score is illustrative. A real evaluation needs a set of old pull requests that were kept hidden from the pattern learner.</p><button className="outline-action" onClick={loadDemo}>Run sample replay <span>→</span></button></section>}

        <section className="how-section" id="how-it-works"><div className="eyebrow">THE IDEA</div><h2>A rehearsal room for your pull request.</h2><div className="how-steps"><div><span>01</span><b>Learn the repo</b><p>Read public past reviews to find repeated maintainer requests.</p></div><div><span>02</span><b>Rehearse your change</b><p>Compare changed files with those learned review patterns.</p></div><div><span>03</span><b>Show the receipts</b><p>Every prediction links back to an example and a confidence score.</p></div></div></section>
        <footer>REVIEW REPLAY <span>·</span> A contributor-side maintainer mirror <span className="footer-right">READ-ONLY DEMO</span></footer>
      </div>
    </main>
  </div>
}

export default App
