import { useState, useEffect } from 'react'
import { Mail, ShieldCheck, ArrowRight, Loader2, CheckCircle2, RotateCw, X, Archive, Eye, Trash2, AlertTriangle } from 'lucide-react'

function App() {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(false)
  const [authUrl, setAuthUrl] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [nextPageToken, setNextPageToken] = useState(null)
  const [status, setStatus] = useState('idle') // idle, fetching, labeling, success
  const [selectedEmail, setSelectedEmail] = useState(null)

  useEffect(() => {
    const init = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('auth') === 'success') {
        const statusRes = await fetch('http://localhost:3001/api/status')
        const statusData = await statusRes.json()
        if (statusData.authenticated) {
          setIsAuthenticated(true)
          fetchEmails()
          // Clear URL params
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
      }
      checkAuth()
    }
    init()
  }, [])

  const checkAuth = async () => {
    try {
      const statusRes = await fetch('http://localhost:3001/api/status')
      const statusData = await statusRes.json()

      if (statusData.authenticated) {
        setIsAuthenticated(true)
        fetchEmails()
      } else {
        const res = await fetch('http://localhost:3001/api/auth')
        const data = await res.json()
        setAuthUrl(data.url)
      }
    } catch (err) {
      console.error('Failed to get auth status', err)
    }
  }

  const fetchEmails = async (pageToken = null) => {
    setLoading(true)
    setStatus('fetching')
    try {
      const url = `http://localhost:3001/api/emails${pageToken ? `?pageToken=${pageToken}` : ''}`
      const res = await fetch(url)
      if (res.status === 401) {
        setIsAuthenticated(false)
        return
      }
      const data = await res.json()
      setEmails(data.emails)
      setNextPageToken(data.nextPageToken)
      setStatus('idle')
    } catch (err) {
      console.error('Failed to fetch emails', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyLabels = async () => {
    setLoading(true)
    setStatus('labeling')
    try {
      const labelsToApply = emails.map(e => ({ id: e.id, label: e.suggestedLabel }))
      const res = await fetch('http://localhost:3001/api/label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelsToApply })
      })
      if (res.ok) {
        setStatus('success')
        setTimeout(() => {
          fetchEmails()
        }, 2000)
      }
    } catch (err) {
      console.error('Failed to apply labels', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLabelChange = (id, newLabel) => {
    setEmails(prev => prev.map(email =>
      email.id === id ? { ...email, suggestedLabel: newLabel } : email
    ))
  }

  const handleRefresh = () => {
    fetchEmails()
  }

  if (!isAuthenticated) {
    return (
      <div className="glass-card" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <ShieldCheck size={64} color="#6366f1" />
        </div>
        <h1>Gmail Labeler</h1>
        <p className="subtitle">Connect your Gmail to start organizing your inbox by content length.</p>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
          <button onClick={() => window.location.href = authUrl}>
            Connect with Gmail
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Your Emails</h1>
          <p className="subtitle">Most recent 10 unlabeled emails</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="secondary" onClick={handleRefresh} disabled={loading} style={{ padding: '0.5rem' }} title="Refresh">
            <RotateCw size={20} className={loading && status === 'fetching' ? 'spin' : ''} />
          </button>
          <Mail size={32} color="#6366f1" />
        </div>
      </div>

      <div className="email-list">
        {loading && status === 'fetching' ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Loader2 className="loading-spinner" size={40} />
          </div>
        ) : emails.length > 0 ? (
          emails.map((email) => (
            <div key={email.id} className="email-item">
              <div className="email-info" onClick={() => setSelectedEmail(email)} style={{ cursor: 'zoom-in' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="email-subject">{email.subject}</div>
                  {email.isPaywall && (
                    <div className="premium-warning" title={email.paywallReason || "Paywall Content"}>
                      <AlertTriangle size={14} />
                      PAYWALL
                    </div>
                  )}
                </div>
                <div className="email-meta">
                  <span>{email.wordCount} words</span>
                  <span>{email.snippet.substring(0, 60)}...</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select
                  className={`label-select ${email.suggestedLabel.toLowerCase()}`}
                  value={email.suggestedLabel}
                  onChange={(e) => handleLabelChange(email.id, e.target.value)}
                >
                  <option value="Short">Short</option>
                  <option value="Medium">Medium</option>
                  <option value="Long">Long</option>
                  <option value="XL">XL</option>
                  <option value="skip">Skip</option>
                  <option value="archive">Archive</option>
                </select>
              </div>
            </div>
          ))
        ) : (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No emails found to label.</p>
        )}
      </div>

      <div className="actions">
        {status === 'success' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4ade80', fontWeight: 600 }}>
            <CheckCircle2 size={24} />
            Labels applied successfully!
          </div>
        ) : (
          <>
            <button
              onClick={handleApplyLabels}
              disabled={loading || emails.length === 0}
              style={{ minWidth: '180px' }}
            >
              {loading && status === 'labeling' ? <Loader2 className="loading-spinner" style={{ width: 20, height: 20 }} /> : 'Approve & Apply'}
            </button>
            <button
              className="secondary"
              onClick={() => fetchEmails(nextPageToken)}
              disabled={loading || !nextPageToken}
            >
              Next 10
              <ArrowRight size={20} />
            </button>
          </>
        )}
      </div>

      {selectedEmail && (
        <div className="modal-overlay" onClick={() => setSelectedEmail(null)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedEmail.subject}</h2>
              <button className="secondary" onClick={() => setSelectedEmail(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="email-meta" style={{ marginBottom: '1rem' }}>
                <strong>Word Count: {selectedEmail.wordCount}</strong>
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {selectedEmail.body}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
