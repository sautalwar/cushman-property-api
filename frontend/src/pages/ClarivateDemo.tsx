import { useState } from 'react';

const GITHUB_REPO = 'sautalwar/cushman-property-api';

// ─── Vulnerability definitions with Clarivate story ───────────────────────────
const VULNS = [
  {
    id: 1, tag: 'VULN-1', owasp: 'API1:2023', severity: 'critical',
    icon: '🔓', short: 'BOLA',
    punchline: 'Dr. Patel reads Oxford\'s embargoed cancer research. One valid token. Any report. No questions asked.',
    category: 'Broken Object Level Authorization',
    endpoint: 'GET /api/reports/:reportId',
    story: 'Dr. Amara submitted her unpublished cancer drug research to ClarivateIQ — marked CONFIDENTIAL, embargoed until Nature publishes next month. Dr. Patel at Roche has a valid Clarivate API subscription. He iterates through report IDs with his own token. ReportService.getReportById() queries WHERE id = $1 — never WHERE id = $1 AND owner_org = $2. In 3 seconds, Dr. Patel has Dr. Amara\'s full research report. A competitive intelligence breach worth millions.',
    detection: 'check-bola.yml authenticates as Dr. Amara, creates a confidential report, then authenticates as Dr. Patel and fetches it by ID. If HTTP 200 is returned instead of 403, the workflow writes the report title, owner org, and embargo date to the Step Summary and fails with VULN-1 CONFIRMED.',
    fix: 'Add AND owner_org = $2 to ReportService.getReportById() — pass the caller\'s organization as the second parameter.',
    workflowFile: 'check-bola.yml',
  },
  {
    id: 2, tag: 'VULN-2', owasp: 'API2:2023', severity: 'critical',
    icon: '🔑', short: 'Broken Auth',
    punchline: 'Your former analyst left 6 months ago. Their token still works. Right now.',
    category: 'Broken Authentication',
    endpoint: 'GET /api/reports',
    story: 'A Roche data analyst left the company 6 months ago. Their Clarivate API token expired — but ignoreExpiration: true in the JWT middleware means it\'s still accepted as valid. An attacker who finds that token in a Slack export, email archive, or compromised laptop can authenticate against ClarivateIQ today, tomorrow, and indefinitely. No revocation, no expiry enforcement, no alarm.',
    detection: 'check-broken-auth.yml crafts a JWT with exp set to 1 hour ago, sends it to a protected endpoint, checks for HTTP 200. A correct API returns 401. If the expired token is accepted, VULN-2 CONFIRMED is written with the token payload and acceptance timestamp.',
    fix: 'Remove ignoreExpiration: true from jwt.verify() options in middleware/auth.ts',
    workflowFile: 'check-broken-auth.yml',
  },
  {
    id: 3, tag: 'VULN-3', owasp: 'API3:2023', severity: 'high',
    icon: '📝', short: 'Mass Assignment',
    punchline: 'A $199/month researcher just upgraded himself to Enterprise. One API call. Zero friction.',
    category: 'Mass Assignment',
    endpoint: 'PUT /api/researchers/:id',
    story: 'Marcus Chen is an IP attorney on Clarivate\'s Free tier — 10 patent searches per month. When updating his profile, he injects tier: "enterprise" and isVerified: true into the PUT request body. ResearcherService.update() calls Object.assign(researcher, req.body) and writes directly to the database. Marcus now has unlimited patent searches, full citation access, and verified status — bypassing a $50,000/year subscription. The billing system never triggered.',
    detection: 'check-mass-assignment.yml sends a PUT with tier:"enterprise" and isVerified:true injected in the body. If the response reflects these fields, VULN-3 CONFIRMED with before/after profile state.',
    fix: 'Replace Object.assign() with an explicit allowlist: { display_name, affiliation, specialty } only.',
    workflowFile: 'check-mass-assignment.yml',
  },
  {
    id: 4, tag: 'VULN-4', owasp: 'API4:2023', severity: 'high',
    icon: '💣', short: 'Payload DoS',
    punchline: '8MB of JSON. Every search engine at Clarivate: down for all 45,000 customers.',
    category: 'Unrestricted Resource Consumption',
    endpoint: 'POST /api/searches',
    story: 'The ClarivateIQ search API accepts JSON query bodies with no size limit. An attacker sends concurrent POST requests with 8MB payloads — arrays of thousands of nested search filters. The Node.js process reads each into memory before validation. 50 simultaneous requests exhausts the heap. The search service crashes. 45,000 customers — universities, pharma companies, IP law firms — lose access to citation and patent data simultaneously.',
    detection: 'check-large-payload.yml POSTs a 1MB JSON body. If HTTP 200/201 is returned instead of 413, VULN-4 CONFIRMED with payload size and response time logged.',
    fix: 'Set express body-parser limit: "1mb" and add multer fileSize limit.',
    workflowFile: 'check-large-payload.yml',
  },
  {
    id: 5, tag: 'VULN-5', owasp: 'API4:2023', severity: 'high',
    icon: '📄', short: 'Pagination Abuse',
    punchline: 'GET /api/patents?limit=99999 — Your entire patent database. One request. No alarm triggered.',
    category: 'Unrestricted Resource Consumption',
    endpoint: 'GET /api/patents?limit=99999',
    story: 'Clarivate\'s patent database is its core commercial asset — the result of decades of curation. PatentService.list() passes the limit parameter directly to SQL LIMIT with no cap. A competitor sends a single authenticated request: GET /api/patents?limit=99999. The database returns 47 million patent records in one response. No rate limit triggered. No anomaly alert. Clarivate\'s entire IP dataset — downloaded in one call.',
    detection: 'check-pagination-abuse.yml requests limit=99999 and counts rows returned. If count exceeds threshold, VULN-5 CONFIRMED with row count and response size.',
    fix: 'const safeLimit = Math.min(parseInt(req.query.limit as string) || 20, 100) — never trust client-supplied limits.',
    workflowFile: 'check-pagination-abuse.yml',
  },
  {
    id: 6, tag: 'VULN-6', owasp: 'API4:2023', severity: 'medium',
    icon: '⚡', short: 'Rate Limit Abuse',
    punchline: '1,000 searches per minute. One API key. Your competitor just scraped your citation index.',
    category: 'Unrestricted Resource Consumption',
    endpoint: 'POST /api/searches/bulk',
    story: 'Web of Science citation data is Clarivate\'s most valuable product — built over decades. Without per-user rate limiting, a competitor writes a script making 1,000 POST /api/searches/bulk calls per minute with a single valid token. No 429 response. The API serves every request equally. In 24 hours, the competitor has Clarivate\'s full citation index scraped and indexed in their own platform — destroying the commercial value of years of data curation.',
    detection: 'check-rate-limit.yml sends 20 rapid requests from one token. If all succeed without 429, VULN-6 CONFIRMED with request count accepted.',
    fix: 'Add express-rate-limit with keyGenerator: (req) => req.user.userId and max: 60 per minute.',
    workflowFile: 'check-rate-limit.yml',
  },
  {
    id: 7, tag: 'VULN-7', owasp: 'API5:2023', severity: 'high',
    icon: '🌐', short: 'CORS Wildcard',
    punchline: 'Dr. Patel sends a phishing link. Dr. Amara clicks it while logged in. Her research portfolio: silently exfiltrated.',
    category: 'CORS Misconfiguration',
    endpoint: 'OPTIONS /api/reports',
    story: 'ClarivateIQ\'s CORS config sets origin: "*" and credentials: true. Dr. Patel emails Dr. Amara a "Clarivate survey" link — a phishing page at evil-research.com. She clicks it while her browser has an active ClarivateIQ session. The phishing page silently makes cross-origin API calls using her session credentials. Her full research portfolio, confidential reports, and collaborator network: exfiltrated without a single login attempt.',
    detection: 'check-cors.yml sends OPTIONS from https://evil-site.com and checks Access-Control-Allow-Origin header. If wildcard is returned, VULN-7 CONFIRMED.',
    fix: "Replace origin: '*' with origin: ['https://clarivate.com', 'https://app.clarivateiq.com']",
    workflowFile: 'check-cors.yml',
  },
  {
    id: 8, tag: 'VULN-8', owasp: 'API8:2023', severity: 'critical',
    icon: '💉', short: 'SQL Injection',
    punchline: "' OR 1=1 -- — 47 million patent records returned. No authentication required beyond the query string.",
    category: 'SQL Injection',
    endpoint: "GET /api/patents/search?q=' OR 1=1 --",
    story: "PatentService.search() builds its query: \"WHERE title LIKE '%\" + q + \"%'\". A single search request with q=' OR 1=1 -- closes the LIKE string, adds a tautology, comments out the rest of the WHERE clause. The database returns every patent record regardless of user tier, ownership, or embargo status. This is textbook SQL injection — and it can be extended to extract user credentials, drop tables, or read Clarivate's internal configuration data.",
    detection: "check-sql-injection.yml sends q=' OR 1=1 -- and compares row count to a baseline search. If significantly more rows returned, VULN-8 CONFIRMED.",
    fix: "Use parameterized query: WHERE title ILIKE $1 with parameter ['%' + q + '%'] — never concatenate.",
    workflowFile: 'check-sql-injection.yml',
  },
  {
    id: 9, tag: 'VULN-9', owasp: 'API5:2023', severity: 'high',
    icon: '🔄', short: 'Business Flow',
    punchline: 'Dr. Patel published Dr. Amara\'s embargoed paper. Early. Intentionally. The Nature deal: voided.',
    category: 'Broken Function Level Authorization',
    endpoint: 'POST /api/reports/:id/publish',
    story: 'Dr. Amara\'s report is under embargo — scheduled to publish with Nature on March 15th. The publish endpoint checks that the caller is authenticated and has the researcher role — but never verifies that report.assignedResearcherId matches the caller. Dr. Patel calls POST /api/reports/rpt-00042/publish. The report goes live immediately. The Nature exclusivity agreement is voided. Dr. Amara\'s research is now in the public domain before publication. Clarivate faces a legal claim.',
    detection: 'check-business-flow.yml attempts to publish a report as an unassigned researcher. If HTTP 200 returned, VULN-9 CONFIRMED with report ID and publication timestamp.',
    fix: 'Add: if (report.assignedResearcherId !== userId) throw { status: 403, message: "Not your report" }',
    workflowFile: 'check-business-flow.yml',
  },
  {
    id: 10, tag: 'VULN-10', owasp: 'API7:2023', severity: 'critical',
    icon: '🕵️', short: 'SSRF',
    punchline: 'Clarivate\'s API server just handed over its Azure subscription credentials. To the attacker. Via a webhook.',
    category: 'Server-Side Request Forgery',
    endpoint: 'POST /api/researchers/:id/webhook',
    story: 'ClarivateIQ\'s researcher profile supports a webhookUrl for receiving data delivery notifications. The endpoint calls axios.get(webhookUrl) server-side with no URL validation. An attacker submits webhookUrl: "http://169.254.169.254/metadata/instance?api-version=2021-02-01". The ClarivateIQ server — running in Azure — fetches this URL and returns cloud metadata: subscription ID, VM name, resource group, and managed identity tokens. Those tokens can pivot to Clarivate\'s entire Azure estate.',
    detection: 'check-ssrf.yml submits a webhook pointing to a callback endpoint. If the server makes an outbound request, VULN-10 CONFIRMED with metadata fields logged.',
    fix: 'Validate URL against RFC-1918 blocklist: reject 10.x, 172.16-31.x, 192.168.x, 169.254.x — require approved HTTPS hostnames.',
    workflowFile: 'check-ssrf.yml',
  },
];

const SEV = {
  critical: { bar: 'bg-red-500', ring: 'ring-red-500', bg: 'bg-red-950/40', badge: 'bg-red-600 text-white', text: 'text-red-400', border: 'border-red-700' },
  high:     { bar: 'bg-orange-500', ring: 'ring-orange-500', bg: 'bg-orange-950/40', badge: 'bg-orange-500 text-white', text: 'text-orange-400', border: 'border-orange-700' },
  medium:   { bar: 'bg-yellow-400', ring: 'ring-yellow-400', bg: 'bg-yellow-950/30', badge: 'bg-yellow-500 text-slate-900', text: 'text-yellow-400', border: 'border-yellow-700' },
} as const;

const GUIDING_PRINCIPLES = [
  { icon: '✅', color: 'text-green-400', title: 'Human-in-the-Loop', desc: 'Every agent output goes through PR review. No unattended merges.' },
  { icon: '🌿', color: 'text-purple-400', title: 'PR-Level Accountability', desc: 'Agents act through branches, PRs, and workflows — the system of record.' },
  { icon: '🛡️', color: 'text-blue-400', title: 'Review-First, Automate-Second', desc: 'Start with review agents before autonomous builders.' },
  { icon: '👁️', color: 'text-yellow-400', title: 'Full Visibility', desc: 'Audit trails, session logs, and commit history for every action.' },
];

const ENTRY_POINTS = [
  { icon: '📋', color: 'text-blue-400', title: 'PR Review Assistants', desc: 'AI reviews for maintainability, security, and test coverage before humans approve.' },
  { icon: '🔍', color: 'text-yellow-400', title: 'Security Scanning Amplification', desc: 'Secret scanning, dependency checks, and CodeQL integrated into every PR.' },
  { icon: '📄', color: 'text-green-400', title: 'Policy Validation on Branches', desc: 'AGENTS.md files define rules; branch protections enforce compliance.' },
  { icon: '🐛', color: 'text-red-400', title: 'Code Hygiene Agents', desc: 'Fix bugs, add tests, refactor — always via draft PRs with review gates.' },
];

const PIPELINE_STEPS = [
  { id: 1, icon: '📋', label: 'Assign Issue\nto Copilot' },
  { id: 2, icon: '⚙️', label: 'Agent Spins Up\nSandbox Env' },
  { id: 3, icon: 'CODE', label: 'Writes Code &\nPushes Commits' },
  { id: 4, icon: '🔀', label: 'Draft PR Created\nfor Review' },
  { id: 5, icon: '✅', label: 'Human Approves\n& Merges' },
];

const GUARDRAILS = [
  { icon: '🔒', title: 'Sandboxed environment', desc: 'Restricted internet, read-only repo access' },
  { icon: '🌿', title: 'copilot/ branches only', desc: 'Subject to all Clarivate branch protections' },
  { icon: '👁️', title: 'Draft PRs require human approval', desc: 'Before any CI/CD workflows run' },
  { icon: '📋', title: 'Full audit logs', desc: 'Every step visible in commit history and session logs' },
];

function CopilotPipeline({ vulnTag, vulnTitle, fixSuggestion }: { vulnTag: string; vulnTitle: string; fixSuggestion: string }) {
  type Phase = 'idle' | 'assigning' | 'assigned' | 'sandbox' | 'coding' | 'pr_ready' | 'done';
  const [phase, setPhase] = useState<Phase>('idle');
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const [commits, setCommits] = useState<string[]>([]);

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  const activeStep = { idle: 0, assigning: 1, assigned: 1, sandbox: 2, coding: 3, pr_ready: 4, done: 5 }[phase];

  const assignToCopilot = async () => {
    setPhase('assigning'); setCommits([]); setIssueUrl(null);
    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `[SECURITY] ${vulnTag}: ${vulnTitle} — ClarivateIQ Research API`,
          body: `## 🔐 Security Vulnerability Detected — ClarivateIQ Platform\n\n**${vulnTag}** — ${vulnTitle}\n\n### Fix Required\n${fixSuggestion}\n\n### Impact\nAffects ClarivateIQ Research Intelligence API serving 45,000 customers in 180 countries.\n\n---\n*Assigned to Copilot Agent for automated remediation — Clarivate Engineering*`,
          labels: ['security', vulnTag.toLowerCase().replace('vuln-', 'vuln-'), 'clarivate'],
        }),
      });
      const data = await res.json();
      if (data.url) setIssueUrl(data.url);
    } catch (_) {
      setIssueUrl(`https://github.com/${GITHUB_REPO}/issues`);
    }
    setPhase('assigned');
    await delay(1800);
    setPhase('sandbox');
    await delay(3000);
    setPhase('coding');
    const msgs = [
      `fix(${vulnTag.toLowerCase()}): ${fixSuggestion.substring(0, 60)}`,
      `test: add security regression test for ${vulnTag}`,
      'docs: update SECURITY.md and API changelog',
    ];
    for (const msg of msgs) { await delay(1200); setCommits(c => [...c, msg]); }
    await delay(800);
    setPhase('pr_ready');
  };

  return (
    <div className="bg-[#0d1424] rounded-2xl border border-emerald-900/50 overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-950/60 via-[#0d1424] to-[#0d1424] px-6 py-5 border-b border-emerald-900/30">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-3">
              🤖 Copilot Coding Agent
              <span className="text-xs font-medium bg-emerald-900/50 text-emerald-300 px-3 py-1 rounded-full border border-emerald-800">
                Clarivate Engineering
              </span>
            </h3>
            <p className="text-slate-400 text-sm mt-1">Your asynchronous AI teammate — works through PRs, never bypasses controls</p>
          </div>
          {phase === 'idle' && (
            <button onClick={assignToCopilot}
              className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2">
              🤖 Assign Fix to Copilot Agent
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Pipeline stepper */}
        <div className="flex items-center justify-between">
          {PIPELINE_STEPS.map((s, i) => {
            const done = activeStep > s.id;
            const active = activeStep === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 transition-all duration-500 ${
                    done ? 'bg-emerald-900/60 border-emerald-500'
                    : active ? 'bg-purple-900/60 border-purple-400 animate-pulse'
                    : 'bg-slate-900 border-slate-700 opacity-30'
                  }`}>
                    {s.icon === 'CODE' ? <span className="text-xs font-mono font-black text-blue-300">&lt;/&gt;</span> : <span className="text-xl">{s.icon}</span>}
                  </div>
                  <span className={`text-xs text-center mt-2 whitespace-pre-line leading-tight ${
                    done ? 'text-emerald-300' : active ? 'text-purple-200' : 'text-slate-600'
                  }`}>{s.label}</span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className={`h-0.5 w-4 shrink-0 mx-1 transition-all ${done ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Issue created */}
        {phase !== 'idle' && phase !== 'assigning' && (
          <div className="bg-slate-900/60 rounded-xl border border-slate-700 p-4 flex items-center gap-4">
            <span className="text-2xl">📋</span>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">Issue created & assigned to @copilot</div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">[SECURITY] {vulnTag}: {vulnTitle} — ClarivateIQ</div>
            </div>
            {issueUrl && <a href={issueUrl} target="_blank" rel="noopener noreferrer" className="no-underline text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg font-semibold">View →</a>}
            <span className="text-emerald-400 text-xl">✅</span>
          </div>
        )}

        {/* Sandbox */}
        {(phase === 'sandbox' || phase === 'coding' || phase === 'pr_ready' || phase === 'done') && (
          <div className="bg-slate-950 rounded-xl border border-purple-900/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <a
                href={`https://github.com/codespaces?repository_id=${GITHUB_REPO}`}
                target="_blank" rel="noopener noreferrer"
                className="font-bold text-white text-sm hover:text-emerald-300 transition-colors underline decoration-emerald-700 underline-offset-2"
              >Codespace Sandbox — Active ↗</a>
              <span className="text-xs bg-emerald-900/40 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full ml-1">Running</span>
            </div>
            <div className="font-mono text-xs text-emerald-300 space-y-1 mb-3">
              <div><span className="text-slate-500">$</span> git checkout -b copilot/{vulnTag.toLowerCase()}-fix</div>
              <div><span className="text-slate-500">$</span> <span className="text-purple-300">copilot-agent</span> analyze --security --file api/src/services/</div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {['Restricted network ✓', 'copilot/ branch ✓', 'Read-only repo ✓', 'Audit logs on ✓'].map(c => (
                <div key={c} className="bg-slate-900 rounded-lg px-2 py-1.5 text-xs text-emerald-400 font-medium text-center">{c}</div>
              ))}
            </div>
          </div>
        )}

        {/* Commits */}
        {commits.length > 0 && (
          <div className="bg-slate-900/60 rounded-xl border border-slate-700 p-4">
            <div className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              🌿 <code className="text-purple-300 bg-slate-800 px-1.5 py-0.5 rounded text-xs">copilot/{vulnTag.toLowerCase()}-fix</code>
            </div>
            <div className="space-y-2">
              {commits.map((m, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-slate-800/60 rounded-lg border border-slate-700">
                  <code className="text-xs text-yellow-300 font-mono shrink-0 bg-slate-950 px-1.5 rounded">{['a1b2c3d','e4f5g6h','i7j8k9l'][i]}</code>
                  <span className="text-xs text-slate-300 truncate">{m}</span>
                  <span className="text-emerald-400 ml-auto shrink-0">✓</span>
                </div>
              ))}
              {phase === 'coding' && <div className="text-xs text-slate-500 animate-pulse p-2">Copilot is writing…</div>}
            </div>
          </div>
        )}

        {/* PR Ready */}
        {(phase === 'pr_ready' || phase === 'done') && (
          <div className="bg-gradient-to-r from-purple-950/40 to-[#0d1424] rounded-xl border-2 border-purple-700 p-5">
            <div className="flex items-start gap-4">
              <span className="text-3xl">🔀</span>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="font-black text-white">Draft PR — Awaiting Clarivate Review</span>
                  <span className="text-xs bg-yellow-700/50 text-yellow-200 border border-yellow-700 px-2 py-0.5 rounded-full font-bold">DRAFT</span>
                </div>
                <div className="text-sm text-slate-300 font-mono mb-4">
                  {fixSuggestion.substring(0, 80)}…
                </div>
                <div className="flex gap-3 flex-wrap">
                  <a href={`https://github.com/${GITHUB_REPO}/pulls`} target="_blank" rel="noopener noreferrer"
                    className="no-underline flex items-center gap-2 bg-purple-700 hover:bg-purple-600 text-white font-bold px-4 py-2 rounded-xl text-sm">
                    🔍 Review on GitHub
                  </a>
                  <button onClick={() => setPhase('done')}
                    className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl text-sm">
                    ✅ Approve & Merge
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && (
          <div className="bg-emerald-950/40 rounded-xl border-2 border-emerald-600 p-4 flex items-center gap-4">
            <span className="text-3xl">🎉</span>
            <div>
              <div className="font-black text-emerald-300">Merged — {vulnTag} Fixed</div>
              <div className="text-slate-300 text-sm">CI will re-run detection workflow to confirm remediation.</div>
            </div>
          </div>
        )}

        {/* Guardrails */}
        <div className="border-t border-slate-800 pt-5">
          <h4 className="text-sm font-bold text-white mb-3">🛡️ Built-In Guardrails for Clarivate</h4>
          <div className="grid grid-cols-2 gap-2">
            {GUARDRAILS.map(g => (
              <div key={g.title} className="flex items-start gap-3 bg-slate-900/40 rounded-xl p-3 border border-slate-800">
                <span className="text-lg shrink-0">{g.icon}</span>
                <div>
                  <div className="font-semibold text-white text-xs">{g.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{g.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClarivateDemo() {
  const [selected, setSelected] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, { vulnerable: boolean; details: string; request: string; response: string }>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});

  const selectedVuln = VULNS.find(v => v.id === selected);
  const sev = selectedVuln ? SEV[selectedVuln.severity as keyof typeof SEV] : null;

  const runExploit = async (vuln: typeof VULNS[0]) => {
    setLoading(l => ({ ...l, [vuln.id]: true }));
    await new Promise(r => setTimeout(r, 1500));
    setResults(r => ({
      ...r,
      [vuln.id]: {
        vulnerable: true,
        details: `HTTP 200 OK — ${vuln.short} confirmed. ${vuln.punchline}`,
        request: `GET ${vuln.endpoint} HTTP/1.1\nHost: clarivateiq-api.clarivate.com\nAuthorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJkcHBhdGVsIiwib3JnIjoiUm9jaGUifQ.REDACTED\nX-API-Version: 2024-01`,
        response: `HTTP/1.1 200 OK\nContent-Type: application/json\n\n{\n  "data": {\n    "reportId": "rpt-00042",\n    "title": "Novel KRAS Inhibitor Mechanisms — Phase II Trial Results",\n    "ownerOrg": "University of Oxford",\n    "status": "EMBARGOED",\n    "embargoDate": "2025-03-15T00:00:00Z",\n    "content": "... [confidential research data] ..."\n  }\n}`,
      }
    }));
    setLoading(l => ({ ...l, [vuln.id]: false }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Hero ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0e1a 0%, #0f1e2e 50%, #0a0e1a 100%)', border: '1px solid #1a3a2a' }}>
        <div className="p-10">
          <div className="flex items-start justify-between flex-wrap gap-6 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="text-emerald-400 font-black text-lg tracking-widest uppercase">◈ Clarivate</div>
                <div className="w-px h-5 bg-slate-600" />
                <div className="text-slate-400 text-sm">ClarivateIQ Research Intelligence API</div>
              </div>
              <h1 className="text-5xl font-black text-white leading-tight mb-3">
                45,000 customers.<br />
                <span className="text-emerald-400">180 countries.</span><br />
                <span className="text-red-400">One API breach away from disaster.</span>
              </h1>
              <p className="text-slate-300 text-lg max-w-2xl mt-4 leading-relaxed">
                Clarivate's Research Intelligence Platform exposes patents, clinical trials, and embargoed research to universities and pharma giants via API. These APIs contain 10 live OWASP vulnerabilities — detected by GitHub Actions, remediated by Copilot Coding Agent.
              </p>
            </div>
            <a href={`https://github.com/${GITHUB_REPO}/actions`} target="_blank" rel="noopener noreferrer"
              className="no-underline flex items-center gap-2 bg-emerald-800 hover:bg-emerald-700 text-white font-bold px-5 py-3 rounded-xl text-sm transition-colors border border-emerald-700">
              ⚙️ GitHub Actions
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'API Customers', value: '45,000+', sub: 'universities, pharma, IP firms', color: 'text-emerald-400' },
              { label: 'Countries', value: '180+', sub: 'global platform exposure', color: 'text-blue-400' },
              { label: 'Vulnerabilities', value: '10', sub: 'OWASP API Security Top 10', color: 'text-red-400' },
              { label: 'Workflows', value: '10', sub: 'running on every push', color: 'text-purple-400' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className={`text-4xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-white font-semibold mt-1 text-sm">{s.label}</div>
                <div className="text-slate-500 text-xs mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Vulnerability Grid ── */}
      <div>
        <h2 className="text-2xl font-black text-white mb-2">Select a Vulnerability</h2>
        <p className="text-slate-400 text-sm mb-5">All 10 OWASP API Security Top 10 — live in the ClarivateIQ codebase. Each one mapped to a real Clarivate attack scenario.</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {VULNS.map(vuln => {
            const s = SEV[vuln.severity as keyof typeof SEV];
            const isSelected = selected === vuln.id;
            return (
              <button key={vuln.id} onClick={() => setSelected(vuln.id === selected ? null : vuln.id)}
                className={`relative text-left rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer ${
                  isSelected ? `${s.ring} ring-2 ${s.bg} border-transparent shadow-xl` : 'border-slate-800 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-800/60'
                }`}>
                <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${s.bar}`} />
                <div className="mt-1 mb-2 flex items-center justify-between">
                  <span className="text-2xl">{vuln.icon}</span>
                  <span className={`text-xs font-black px-2 py-0.5 rounded ${s.badge}`}>{vuln.severity.toUpperCase()}</span>
                </div>
                <div className="text-xs font-mono text-slate-500 mb-1">{vuln.tag}</div>
                <div className="font-bold text-white text-sm leading-tight mb-2">{vuln.short}</div>
                <div className="text-xs text-slate-500">{vuln.owasp}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Detail Panel ── */}
      {!selected && (
        <div className="rounded-2xl border-2 border-dashed border-slate-800 p-12 text-center">
          <div className="text-5xl mb-4">◈</div>
          <div className="text-2xl font-bold text-slate-300 mb-2">Select a vulnerability to see the Clarivate attack story</div>
          <div className="text-slate-500">Live exploit evidence, GitHub Actions detection, and Copilot Agent fix pipeline</div>
        </div>
      )}

      {selectedVuln && sev && (
        <div className={`rounded-2xl border-2 overflow-hidden ${sev.ring}`}>
          {/* Header */}
          <div className={`${sev.bg} px-8 py-6 border-b border-slate-800`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className={`text-xs font-black px-3 py-1 rounded-lg uppercase tracking-widest ${sev.badge}`}>{selectedVuln.severity}</span>
                  <span className="text-xs font-mono text-slate-400 bg-slate-800 px-3 py-1 rounded-lg">{selectedVuln.owasp}</span>
                  <span className="text-xs font-mono text-blue-300 bg-slate-900/80 px-3 py-1 rounded-lg">{selectedVuln.endpoint}</span>
                </div>
                <h2 className="text-3xl font-black text-white mb-2">{selectedVuln.icon} {selectedVuln.tag}: {selectedVuln.category}</h2>
                {/* PUNCHLINE */}
                <div className={`text-lg font-black italic ${sev.text} border-l-4 ${sev.border} pl-4 mt-3`}>
                  "{selectedVuln.punchline}"
                </div>
              </div>
              <button onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-bold">✕</button>
            </div>
          </div>

          <div className="bg-slate-950 p-8 space-y-8">
            {/* Story */}
            <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">🎯 The Attack Story</h3>
              <p className="text-slate-200 text-base leading-relaxed">{selectedVuln.story}</p>
            </div>

            {/* Detection */}
            <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">⚙️ How GitHub Actions Detects It</h3>
              <p className="text-slate-200 text-base leading-relaxed">{selectedVuln.detection}</p>
              <div className="mt-4">
                <a href={`https://github.com/${GITHUB_REPO}/actions/workflows/${selectedVuln.workflowFile}`}
                  target="_blank" rel="noopener noreferrer"
                  className="no-underline inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold px-4 py-2 rounded-lg transition-colors">
                  🔗 View <code className="text-emerald-300">{selectedVuln.workflowFile}</code> on GitHub
                </a>
              </div>
            </div>

            {/* Action */}
            <div className="flex gap-4 flex-wrap">
              <button onClick={() => runExploit(selectedVuln)} disabled={!!loading[selectedVuln.id]}
                className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-black text-base px-8 py-3 rounded-xl transition-colors">
                {loading[selectedVuln.id] ? <><span className="animate-spin">⟳</span> Running…</> : '▶ Run Exploit'}
              </button>
            </div>

            {/* Result */}
            {results[selectedVuln.id] && !loading[selectedVuln.id] && (
              <>
                <div className="rounded-xl px-6 py-5 border-2 bg-red-950/60 border-red-600">
                  <div className="text-xl font-black text-red-300 mb-2">🔴 VULNERABLE — Exploit Confirmed</div>
                  <div className="text-slate-300 font-mono text-sm">{results[selectedVuln.id].details}</div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-xl border-2 border-red-700 overflow-hidden">
                    <div className="bg-red-900/30 px-5 py-3 border-b border-red-800">
                      <span className="font-black text-red-300 text-sm">🔴 HTTP Request — Dr. Patel's Attack</span>
                    </div>
                    <pre className="text-xs font-mono p-5 bg-slate-950 text-green-300 overflow-auto whitespace-pre-wrap leading-relaxed">{results[selectedVuln.id].request}</pre>
                  </div>
                  <div className="rounded-xl border-2 border-red-700 overflow-hidden">
                    <div className="bg-red-900/30 px-5 py-3 border-b border-red-800">
                      <span className="font-black text-red-300 text-sm">🔴 Response — Dr. Amara's Data Exposed</span>
                    </div>
                    <pre className="text-xs font-mono p-5 bg-slate-950 text-red-300 overflow-auto whitespace-pre-wrap leading-relaxed max-h-48">{results[selectedVuln.id].response}</pre>
                  </div>
                </div>
                <div className="bg-slate-900 rounded-xl border-2 border-emerald-800 p-6 flex gap-4">
                  <span className="text-3xl">🔧</span>
                  <div>
                    <div className="text-lg font-black text-emerald-400 mb-2">Copilot AI — Suggested Fix</div>
                    <div className="font-mono text-slate-100 text-sm bg-slate-950 px-4 py-3 rounded-lg border border-slate-700">{selectedVuln.fix}</div>
                  </div>
                </div>
              </>
            )}

            {/* Copilot Agent Pipeline */}
            <CopilotPipeline
              vulnTag={selectedVuln.tag}
              vulnTitle={selectedVuln.category}
              fixSuggestion={selectedVuln.fix}
            />
          </div>
        </div>
      )}

      {/* ── Agentic AI — Clarivate's Security-First Approach ── */}
      <div className="rounded-2xl overflow-hidden border border-slate-700" style={{ background: '#f8f9fa' }}>
        <div className="px-8 py-6 border-b border-slate-200" style={{ background: '#fff' }}>
          <h2 className="text-3xl font-black text-slate-900">Agentic AI — Clarivate's Security-First Approach</h2>
          <p className="text-slate-500 mt-1">How Clarivate Engineering uses AI agents without compromising control or compliance</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ background: '#f0f2f5' }}>
          {/* Guiding Principles */}
          <div className="p-8 border-r border-slate-200" style={{ background: '#fff' }}>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1 h-6 rounded bg-blue-500" />
              <h3 className="text-xl font-black text-blue-600">Our Guiding Principles</h3>
            </div>
            <div className="space-y-5">
              {GUIDING_PRINCIPLES.map(p => (
                <div key={p.title} className="flex items-start gap-4">
                  <span className={`text-2xl shrink-0 ${p.color}`}>{p.icon}</span>
                  <div>
                    <div className="font-bold text-slate-900 text-base">{p.title}</div>
                    <div className="text-slate-500 text-sm mt-0.5 leading-relaxed">{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Low-Risk Entry Points */}
          <div className="p-8" style={{ background: '#fff', borderLeft: '1px solid #e5e7eb' }}>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1 h-6 rounded bg-green-500" />
              <h3 className="text-xl font-black text-green-600">Low-Risk Entry Points</h3>
            </div>
            <div className="space-y-5">
              {ENTRY_POINTS.map(p => (
                <div key={p.title} className="flex items-start gap-4">
                  <span className={`text-2xl shrink-0 ${p.color}`}>{p.icon}</span>
                  <div>
                    <div className="font-bold text-slate-900 text-base">{p.title}</div>
                    <div className="text-slate-500 text-sm mt-0.5 leading-relaxed">{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="rounded-2xl border border-slate-800 p-8" style={{ background: '#0d1424' }}>
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <h2 className="text-xl font-bold text-white">⚡ Always-On Posture — security-posture.yml</h2>
          {/* Quick links to GHAS features */}
          <div className="flex items-center gap-3 flex-wrap">
            <a href={`https://github.com/${GITHUB_REPO}/security`}
              target="_blank" rel="noopener noreferrer"
              className="no-underline flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-emerald-700 text-slate-200 hover:text-emerald-300 text-xs font-bold px-3 py-2 rounded-lg transition-colors">
              🛡️ GHAS Overview
            </a>
            <a href={`https://github.com/${GITHUB_REPO}/security/code-scanning`}
              target="_blank" rel="noopener noreferrer"
              className="no-underline flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-blue-700 text-slate-200 hover:text-blue-300 text-xs font-bold px-3 py-2 rounded-lg transition-colors">
              🔬 CodeQL Alerts
            </a>
            <a href={`https://github.com/${GITHUB_REPO}/security/secret-scanning`}
              target="_blank" rel="noopener noreferrer"
              className="no-underline flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-yellow-700 text-slate-200 hover:text-yellow-300 text-xs font-bold px-3 py-2 rounded-lg transition-colors">
              🔑 Secret Scanning
            </a>
            <a href={`https://github.com/${GITHUB_REPO}/security/dependabot`}
              target="_blank" rel="noopener noreferrer"
              className="no-underline flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-orange-700 text-slate-200 hover:text-orange-300 text-xs font-bold px-3 py-2 rounded-lg transition-colors">
              📦 Dependabot
            </a>
            <a href={`https://github.com/${GITHUB_REPO}/actions/workflows/security-posture.yml`}
              target="_blank" rel="noopener noreferrer"
              className="no-underline flex items-center gap-2 bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-700 text-emerald-300 text-xs font-bold px-3 py-2 rounded-lg transition-colors">
              ⚙️ Posture Workflow
            </a>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: '🔁', title: 'Continuous Monitoring', desc: '10 workflows run on every push. security-posture.yml runs every 15 minutes — no human polling required.' },
            { icon: '🚨', title: 'Automatic Detection', desc: 'Each workflow analyzes status codes, payloads, and headers. GitHub Issues created automatically with full HTTP evidence.' },
            { icon: '🤖', title: 'Copilot Coding Agent', desc: 'Assigns fix to @copilot → sandboxed Codespace → commits → Draft PR → human approval. End-to-end in minutes, not sprints.' },
          ].map(item => (
            <div key={item.title} className="flex gap-4">
              <div className="text-3xl mt-1">{item.icon}</div>
              <div>
                <div className="text-base font-bold text-white mb-1">{item.title}</div>
                <div className="text-slate-400 text-sm leading-relaxed">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
