import { useEffect, useState } from 'react'
import './App.css'

const sample = {
  repo: 'pallets/flask',
  filePath: 'tests/conftest.py',
  title: 'Add a shared fixture for CLI tests',
  description: 'Introduce a pytest fixture and make sure monkeypatch cleanup is handled safely.',
  code: '@pytest.fixture\ndef cli_runner(monkeypatch):\n    runner = CliRunner()\n    monkeypatch.setattr(\"flask.cli.some_option\", True)\n    yield runner',
}

function App() {
  const [form, setForm] = useState(sample)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [apiReady, setApiReady] = useState(null)

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(d => setApiReady(d.model || false)).catch(() => setApiReady(false))
  }, [])

  function update(key, value) { setForm(old => ({ ...old, [key]: value })) }

  async function review(event) {
    event.preventDefault()
    setBusy(true); setError(''); setResult(null)
    try {
      const response = await fetch('/api/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Review request failed')
      setResult(data)
    } catch (e) { setError(e.message + '. Check that the MergeReady API and Qwen server are running.') }
    finally { setBusy(false) }
  }

  return <div className="shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="logo">M</span><span>MergeReady<small>MAINTAINER MIRROR</small></span></a>
      <div className="top-status"><span className={apiReady ? 'pulse on' : 'pulse'} />{apiReady ? 'QWEN CONNECTED · ' + apiReady : apiReady === false ? 'LOCAL MODEL OFFLINE' : 'CHECKING LOCAL MODEL'}</div>
    </header>
    <main>
      <section className="hero"><div className="eyebrow">CONTRIBUTOR-SIDE CODE REVIEW</div><h1>Catch likely review feedback<br/><em>before you open the PR.</em></h1><p>Paste your change. Qwen compares it with real past reviews from this repository and shows evidence for anything it flags.</p></section>
      <div className="workspace">
        <form className="editor" onSubmit={review}>
          <div className="editor-head"><div><span className="step">01</span><strong>Your change</strong></div><button type="button" className="sample-btn" onClick={() => { setForm(sample); setResult(null); setError('') }}>Load working sample ↗</button></div>
          <label>GITHUB REPOSITORY</label><input value={form.repo} onChange={e => update('repo', e.target.value)} placeholder="owner/repository" required/>
          <div className="two-col"><div><label>FILE PATH</label><input value={form.filePath} onChange={e => update('filePath', e.target.value)} placeholder="src/example.py"/></div><div><label>CHANGE TITLE</label><input value={form.title} onChange={e => update('title', e.target.value)} placeholder="What does this change do?" required/></div></div>
          <label>WHAT CHANGED?</label><textarea className="description" value={form.description} onChange={e => update('description', e.target.value)} placeholder="Describe your change briefly…" rows="2"/>
          <div className="code-label"><label>PASTE CODE OR A DIFF</label><span>sent only to your local Qwen</span></div><textarea className="code" value={form.code} onChange={e => update('code', e.target.value)} placeholder="Paste the code change or diff here…" required/>
          <button className="review-btn" disabled={busy}>{busy ? <><span className="spinner"/> Qwen is reviewing your change…</> : <>Review my change with Qwen <span>→</span></>}</button>
          {error && <div className="error">{error}</div>}
          <div className="privacy-note"><span>⌑</span> Runs on this laptop · Read-only · Never changes GitHub</div>
        </form>
        <section className="results">
          <div className="result-head"><div><span className="step">02</span><h2>Review rehearsal</h2><p>Qwen’s evidence-backed results appear here.</p></div>{result && <span className={result.mode === 'local_model' ? 'tag live' : 'tag'}>{result.mode === 'local_model' ? 'QWEN · LOCAL' : 'EVIDENCE FALLBACK'}</span>}</div>
          {!result && !busy && <div className="placeholder"><div className="orbit">✳</div><strong>Ready when you are</strong><p>Load the sample or paste your own change, then click <b>Review my change with Qwen</b>.</p><div className="flow"><span>YOUR CODE</span><i>→</i><span>QWEN</span><i>→</i><span>PAST PR EVIDENCE</span></div></div>}
          {busy && <div className="working"><span className="spinner large"/><strong>Searching review history…</strong><p>Qwen is selecting concerns supported by earlier pull requests.</p></div>}
          {result && <div className="result-body">
            <div className="summary"><span className="summary-icon">{result.predictions.length ? '!' : '✓'}</span><div><strong>{result.predictions.length ? result.predictions.length + ' concern' + (result.predictions.length === 1 ? '' : 's') + ' to consider' : 'No supported concerns found'}</strong><small>{result.model ? 'Analyzed by ' + result.model : result.message}</small></div></div>
            {result.predictions.map((item, i) => <article className="finding" key={i}><div className="finding-label">POSSIBLE REVIEW CONCERN <span>{item.confidence || 'evidence-based'}</span></div><p className="concern">{item.concern}</p>{item.file && <div className="file">↳ {item.file}</div>}<div className="evidence"><small>WHY IT WAS FLAGGED · PAST REVIEW</small><p>“{item.concern}”</p><a href={item.evidence_url} target="_blank" rel="noreferrer">Evidence: {result.repo} PR #{item.evidence_pr} ↗</a></div></article>)}
            {!result.predictions.length && <div className="no-findings">MergeReady stayed quiet because it found no relevant, evidence-backed concern in the retrieved history.</div>}
            <div className="disclaimer">This is a rehearsal suggestion, not a guarantee. Confirm whether the historical feedback applies to your code.</div>
          </div>}
        </section>
      </div>
      <footer><span>MERGEREADY</span><span>Qwen selects from retrieved review evidence. Citations are verified before display.</span><span>LOCAL INFERENCE</span></footer>
    </main>
  </div>
}
export default App
