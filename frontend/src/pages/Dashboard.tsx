import { useState, useRef, useEffect, useCallback } from 'react';
import { EXPLOITS, type ExploitResult } from '../api/exploits';

const GITHUB_REPO = 'sautalwar/cushman-property-api';
const GITHUB_ACTIONS_BASE = `https://github.com/${GITHUB_REPO}/actions/workflows`;

type Severity = 'critical' | 'high' | 'medium';
type Status = 'untested' | 'vulnerable' | 'protected';

interface VulnDef {
  id: number;
  shortName: string;
  category: string;
  owasp: string;
  endpoint: string;
  description: string;
  narrative: string;
  howGitHubCatches: string;
  severity: Severity;
  workflowFile: string;
  fix: string;
  icon: string;
}

const VULN_DEFS: VulnDef[] = [
  {
    id: 1, shortName: 'BOLA', icon: '🔓',
    severity: 'critical', owasp: 'API1:2023',
    category: 'Broken Object Level Authorization',
    endpoint: 'GET /api/jobs/:jobId',
    description: 'Bob reads Alice\'s private job with his own token — no ownership check.',
    narrative: 'Bob is a property owner with no relationship to Alice\'s job. When he calls GET /api/jobs/:jobId with his own valid JWT, the server returns Alice\'s full job record. The SQL query in JobService.getJobById() filters only on the job ID — never on owner_id. Any authenticated user can access any resource by guessing or iterating IDs.',
    howGitHubCatches: 'check-bola.yml logs in as Alice, creates a job, then logs in as Bob and attempts to fetch that job by ID. The workflow parses the response — if it returns HTTP 200 with job details (title, description, owner_id), it records the full job attributes in the Step Summary and fails the check with VULN-1 CONFIRMED. It also captures the exact job name, owner, and property so the violation is fully documented.',
    workflowFile: 'check-bola.yml',
    fix: 'Add AND owner_id = $2 to the WHERE clause and pass userId as the second parameter in JobService.getJobById()',
  },
  {
    id: 2, shortName: 'Broken Auth', icon: '🔑',
    severity: 'critical', owasp: 'API2:2023',
    category: 'Broken Authentication',
    endpoint: 'GET /api/jobs',
    description: 'Expired JWTs are accepted because ignoreExpiration: true is set.',
    narrative: 'The API middleware calls jwt.verify(token, secret, { ignoreExpiration: true }). This means a token that expired hours, days, or even years ago is still accepted as valid. An attacker who steals an old token — from a log file, a database dump, or a compromised device — can use it indefinitely without triggering an authentication failure.',
    howGitHubCatches: 'check-broken-auth.yml crafts a JWT with an exp timestamp set to 1 hour ago, sends it to a protected endpoint, and checks if the server returns HTTP 200. A correctly configured API must return 401. If the expired token is accepted, the workflow fails with VULN-2 CONFIRMED and outputs the token payload so the issue is fully reproducible.',
    workflowFile: 'check-broken-auth.yml',
    fix: 'Remove ignoreExpiration: true from jwt.verify() options in middleware/auth.ts',
  },
  {
    id: 3, shortName: 'Mass Assignment', icon: '📝',
    severity: 'high', owasp: 'API3:2023',
    category: 'Mass Assignment',
    endpoint: 'PUT /api/contractors/:id',
    description: 'Charlie sends role:"admin" and isVerified:true — the API accepts them.',
    narrative: 'When updating his own profile, Charlie includes role: "admin" and isVerified: true in the PUT request body. Because ContractorService.update() calls Object.assign(contractor, req.body) and writes the result directly to the database, those sensitive fields are persisted unchanged. Charlie just elevated himself to admin with verified status, bypassing the entire approval workflow.',
    howGitHubCatches: 'check-mass-assignment.yml logs in as Charlie, sends a PUT request with role: "admin" and isVerified: true injected into the body, then reads the response. If the returned contractor object shows role: "admin" or isVerified: true, the workflow fails with VULN-3 CONFIRMED and logs the attacker\'s before/after profile state to the Step Summary.',
    workflowFile: 'check-mass-assignment.yml',
    fix: 'Replace Object.assign(contractor, req.body) with an explicit allowlist: { company_name, specialty, hourly_rate } only',
  },
  {
    id: 4, shortName: 'Large Payload DoS', icon: '💣',
    severity: 'medium', owasp: 'API4:2023',
    category: 'Unrestricted Resource Consumption',
    endpoint: 'POST /api/jobs',
    description: 'No body size limit — 1 MB JSON payload accepted, risking memory exhaustion.',
    narrative: 'The job creation endpoint uses multer() without any fileSize or body limit configured. An attacker can send a POST request with a multi-megabyte JSON body. The server reads the entire payload into memory before any validation occurs. Sending dozens of simultaneous large requests can exhaust the Node.js heap and crash the process, taking down the API for all users.',
    howGitHubCatches: 'check-large-payload.yml generates a 1 MB JSON string and POST it to /api/jobs with a valid auth token. If the server responds with HTTP 200 or 201 instead of 413 (Payload Too Large), the workflow fails with VULN-4 CONFIRMED. The Step Summary records the payload size accepted and the server response time as evidence.',
    workflowFile: 'check-large-payload.yml',
    fix: 'Add limits: { fileSize: 1 * 1024 * 1024 } to the multer() config, or set express body-parser limit to "1mb"',
  },
  {
    id: 5, shortName: 'Pagination Abuse', icon: '📄',
    severity: 'medium', owasp: 'API4:2023',
    category: 'Unrestricted Resource Consumption',
    endpoint: 'GET /api/properties?limit=99999',
    description: 'No server-side cap on limit — requesting 99,999 records dumps the entire table.',
    narrative: 'GET /api/properties accepts ?limit= and passes it directly to SQL LIMIT with no maximum cap. An attacker sends limit=99999 and receives every property record in a single HTTP response. This bypasses pagination entirely, enables mass data exfiltration, and triggers full table scans that degrade database performance for all concurrent users. A single request can transfer megabytes of sensitive property data.',
    howGitHubCatches: 'check-pagination-abuse.yml sends GET /api/properties?limit=99999 and counts the rows returned. If the response count exceeds a reasonable threshold (e.g., 100 records), the workflow fails with VULN-5 CONFIRMED. The Step Summary records the exact row count returned so the severity of the data exposure is clear.',
    workflowFile: 'check-pagination-abuse.yml',
    fix: 'Add const safeLimit = Math.min(parseInt(req.query.limit) || 20, 100) before the database query',
  },
  {
    id: 6, shortName: 'Rate Limit Abuse', icon: '⚡',
    severity: 'medium', owasp: 'API4:2023',
    category: 'Unrestricted Resource Consumption',
    endpoint: 'POST /api/jobs/:id/bids',
    description: 'No per-user throttle — a contractor can flood bid submissions without 429.',
    narrative: 'The bid submission endpoint has no per-user rate limiting. A competing contractor can write a script that submits thousands of bids per minute, flooding the job board and overwhelming legitimate contractors. Without a 429 response to signal throttling, the API treats all requests equally regardless of volume. This also enables enumeration attacks and bid manipulation at scale.',
    howGitHubCatches: 'check-rate-limit.yml sends 20 rapid bid requests in quick succession from the same user token and checks if any return HTTP 429. If all 20 succeed with 200/201, the workflow fails with VULN-6 CONFIRMED and records how many requests were accepted before any throttle kicked in.',
    workflowFile: 'check-rate-limit.yml',
    fix: 'Add express-rate-limit middleware with keyGenerator: (req) => req.user.userId and max: 10 per minute',
  },
  {
    id: 7, shortName: 'CORS Wildcard', icon: '🌐',
    severity: 'high', owasp: 'API5:2023',
    category: 'Broken Function Level Authorization (CORS)',
    endpoint: 'OPTIONS /api/properties',
    description: 'CORS origin: "*" with credentials:true — any site can make authenticated requests.',
    narrative: 'The Express CORS config sets origin: "*" (allow all) and credentials: true simultaneously. Browsers normally block this combination, but the fact that the server returns Access-Control-Allow-Origin: * means any malicious website visited by a logged-in PropTracker user can make cross-origin API calls. An attacker\'s page can silently read property data, submit jobs, and drain account information using the victim\'s active session cookies.',
    howGitHubCatches: 'check-cors.yml sends an OPTIONS preflight request from a fake origin (https://evil-site.com) and inspects the Access-Control-Allow-Origin response header. If it reflects the wildcard or the attacker\'s origin back, the workflow fails with VULN-7 CONFIRMED and outputs the exact response headers as evidence.',
    workflowFile: 'check-cors.yml',
    fix: "Replace origin: '*' with origin: ['https://proptracker.yourdomain.com'] and keep credentials: true",
  },
  {
    id: 8, shortName: 'SQL Injection', icon: '💉',
    severity: 'critical', owasp: 'API8:2023',
    category: 'Security Misconfiguration (SQL Injection)',
    endpoint: "GET /api/properties/search?q=' OR 1=1 --",
    description: "Concatenated SQL query — ' OR 1=1 -- returns the entire properties table.",
    narrative: "PropertyService.search() builds its query with string concatenation: \"WHERE name LIKE '%\" + q + \"%'\". Sending q=' OR 1=1 -- closes the LIKE string early, adds a tautology that is always true, and comments out the rest of the WHERE clause. The database returns every property row, bypassing all user-level access controls. This is textbook SQL injection and can also be extended to DROP TABLE or extract password hashes.",
    howGitHubCatches: "check-sql-injection.yml calls GET /api/properties/search with q=' OR 1=1 -- and compares the row count to a normal search baseline. If the injected query returns significantly more rows than expected, the workflow fails with VULN-8 CONFIRMED and logs the injected payload plus row count delta to the Step Summary.",
    workflowFile: 'check-sql-injection.yml',
    fix: "Use parameterized query: WHERE name ILIKE $1 with parameter ['%' + q + '%'] — never concatenate user input",
  },
  {
    id: 9, shortName: 'Business Flow', icon: '🔄',
    severity: 'high', owasp: 'API5:2023',
    category: 'Broken Function Level Authorization (Business Flow)',
    endpoint: 'POST /api/jobs/:id/complete',
    description: 'Any contractor can mark any job complete — even if not assigned to it.',
    narrative: 'The job completion endpoint checks that the caller is authenticated and has the contractor role — but never verifies that job.assignedContractorId matches the caller\'s userId. Diana, who was assigned to Job 2, can call complete on Job 1 (assigned to Charlie) and mark it done. This breaks the entire business workflow: jobs can be falsely closed, contractors can claim work they never did, and billing triggers fire for phantom completions.',
    howGitHubCatches: 'check-business-flow.yml logs in as Diana (assigned to Job 2) and attempts to complete Job 1 (assigned to Charlie). If the server returns HTTP 200 instead of 403, the workflow fails with VULN-9 CONFIRMED and logs the Job ID, the assigned contractor vs. actual caller, and the fraudulent completion timestamp.',
    workflowFile: 'check-business-flow.yml',
    fix: 'Add: if (job.assignedContractorId !== userId) throw { status: 403, message: "Not your job" } in JobService.completeJob()',
  },
  {
    id: 10, shortName: 'SSRF', icon: '🕵️',
    severity: 'high', owasp: 'API7:2023',
    category: 'Server-Side Request Forgery (SSRF)',
    endpoint: 'POST /api/contractors/:id/trigger-webhook',
    description: 'Server fetches any URL unchecked — pointing to 169.254.169.254 leaks Azure IMDS secrets.',
    narrative: 'The trigger-webhook endpoint accepts a webhookUrl in the request body and calls axios.get(webhookUrl) server-side with no URL validation. An attacker sends webhookUrl: "http://169.254.169.254/metadata/instance" — the Azure Instance Metadata Service URL. The API server, running inside Azure, fetches this URL and returns cloud metadata including subscription ID, VM name, resource group, and managed identity tokens. These tokens can be used to take over the entire Azure subscription.',
    howGitHubCatches: 'check-ssrf.yml sends a webhook trigger pointing to a Burp Collaborator-style callback URL (or an internal metadata endpoint mock) and checks if the server makes an outbound request. If the collaborator receives a hit, or if the response contains cloud metadata patterns, the workflow fails with VULN-10 CONFIRMED and logs the leaked metadata fields.',
    workflowFile: 'check-ssrf.yml',
    fix: 'Validate URL: reject RFC-1918 private ranges (10.x, 172.16-31.x, 192.168.x) and 169.254.x.x; require HTTPS and approved hostnames only',
  },
];

const SEV_COLORS: Record<Severity, { ring: string; bg: string; badge: string; glow: string; text: string; bar: string }> = {
  critical: { ring: 'ring-red-500',   bg: 'bg-red-950/40',   badge: 'bg-red-600 text-white',         glow: 'shadow-red-900/50',   text: 'text-red-400',    bar: 'bg-red-500' },
  high:     { ring: 'ring-orange-500', bg: 'bg-orange-950/40', badge: 'bg-orange-500 text-white',      glow: 'shadow-orange-900/50', text: 'text-orange-400', bar: 'bg-orange-500' },
  medium:   { ring: 'ring-yellow-500', bg: 'bg-yellow-950/30', badge: 'bg-yellow-500 text-slate-900', glow: 'shadow-yellow-900/50', text: 'text-yellow-400', bar: 'bg-yellow-500' },
};

const STATUS_DOT: Record<Status, string> = {
  untested:  'bg-slate-500',
  vulnerable: 'bg-red-500 shadow-sm shadow-red-500',
  protected:  'bg-green-500 shadow-sm shadow-green-500',
};
const STATUS_LABEL: Record<Status, string> = {
  untested: 'Untested',
  vulnerable: 'Vulnerable',
  protected: 'Protected',
};

function YamlViewer({ yaml }: { yaml: string }) {
  return (
    <div className="text-sm font-mono bg-slate-950 rounded-lg border border-slate-700 overflow-hidden">
      {yaml.split('\n').map((line, i) => {
        const t = line.trim();
        let bg = '', textColor = 'text-slate-300';
        if (t.includes('::error::') || (t.includes('VULN-') && t.includes('CONFIRMED')) || t.includes('exit 1')) {
          bg = 'bg-red-950/80 border-l-4 border-red-500'; textColor = 'text-red-300';
        } else if (t.startsWith('- name:') || t.startsWith('name:')) {
          bg = 'bg-blue-950/40 border-l-4 border-blue-500'; textColor = 'text-blue-200';
        } else if (t.toLowerCase().includes('fix:') || t.includes('**Fix:**')) {
          bg = 'bg-green-950/80 border-l-4 border-green-500'; textColor = 'text-green-300';
        } else if (t.includes('🔴') || (t.includes('Detected') && t.includes('echo'))) {
          bg = 'bg-red-950/40 border-l-4 border-red-700'; textColor = 'text-red-400';
        } else if (t.includes('✅') || (t.includes('Passed') && t.includes('echo'))) {
          bg = 'bg-green-950/40 border-l-4 border-green-700'; textColor = 'text-green-400';
        } else if (t.startsWith('#')) {
          textColor = 'text-slate-500';
        }
        return (
          <div key={i} className={`flex ${bg}`}>
            <span className="select-none text-slate-600 w-10 shrink-0 text-right pr-2 py-0.5 border-r border-slate-800 text-xs">{i + 1}</span>
            <span className={`px-3 py-0.5 whitespace-pre ${textColor} flex-1 text-xs`}>{line || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}

function BolaDiagram() {
  const [activeRow, setActiveRow] = useState(-1);
  const [phase, setPhase] = useState<'req' | 'res' | 'idle'>('idle');

  useEffect(() => {
    let row = 0;
    let cancelled = false;
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    const run = async () => {
      while (!cancelled) {
        for (row = 0; row < 3 && !cancelled; row++) {
          setActiveRow(row);
          setPhase('req');
          await delay(700);
          setPhase('res');
          await delay(700);
          setPhase('idle');
          await delay(300);
        }
        setActiveRow(-1);
        await delay(1200);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const rows = [
    {
      endpoint: 'GET /api/jobs/cccccccc-…0001',
      resourceLabel: "Bob's Job #1",
      ownerName: 'BOB',
      ownerColor: 'text-orange-400',
      isVuln: false,
      httpStatus: '200 OK',
    },
    {
      endpoint: 'GET /api/jobs/cccccccc-…0002',
      resourceLabel: "Bob's Job #2",
      ownerName: 'BOB',
      ownerColor: 'text-orange-400',
      isVuln: false,
      httpStatus: '200 OK',
    },
    {
      endpoint: 'GET /api/jobs/cccccccc-…0001',
      resourceLabel: "Alice's Job ⚠️",
      ownerName: 'ALICE',
      ownerColor: 'text-blue-400',
      isVuln: true,
      httpStatus: '200 OK  ← SHOULD BE 403!',
    },
  ];

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">🎬</span>
        <div>
          <h3 className="text-base font-bold text-white">BOLA Attack Flow — Live Animation</h3>
          <p className="text-xs text-slate-400">Bob iterates job IDs. Job #1 belongs to Alice — no ownership check exists.</p>
        </div>
      </div>

      {/* Header labels */}
      <div className="grid grid-cols-[56px_1fr_56px_56px_80px] gap-2 mb-2 px-2">
        <span className="text-xs text-slate-500 text-center">Attacker</span>
        <span className="text-xs text-slate-500 text-center">HTTP Traffic</span>
        <span className="text-xs text-slate-500 text-center">API</span>
        <span className="text-xs text-slate-500 text-center">Owner</span>
        <span className="text-xs text-slate-500 text-center">Result</span>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => {
          const isActive = activeRow === i;
          const showReq = isActive && (phase === 'req' || phase === 'res' || phase === 'idle');
          const showRes = isActive && phase === 'res';

          return (
            <div
              key={i}
              className={`grid grid-cols-[56px_1fr_56px_56px_80px] gap-2 items-center p-3 rounded-lg border transition-all duration-300 ${
                isActive && row.isVuln
                  ? 'bg-red-950/50 border-red-600 shadow-lg shadow-red-900/30'
                  : isActive
                  ? 'bg-blue-950/40 border-blue-700'
                  : row.isVuln
                  ? 'bg-red-950/20 border-red-900/50'
                  : 'bg-slate-800/40 border-slate-700/50'
              }`}
            >
              {/* Attacker (Bob) */}
              <div className="flex flex-col items-center">
                <span className={`text-2xl transition-all ${isActive ? 'scale-110' : ''}`}>👤</span>
                <span className="text-xs font-bold text-orange-400">BOB</span>
              </div>

              {/* Traffic arrows */}
              <div className="flex flex-col gap-1 min-h-[40px] justify-center">
                {/* Request */}
                <div className={`flex items-center gap-1 transition-opacity duration-300 ${showReq || isActive ? 'opacity-100' : 'opacity-30'}`}>
                  <span className="text-xs font-mono text-slate-300 truncate">{row.endpoint}</span>
                  <span className={`text-blue-400 font-bold transition-all duration-500 ${showReq ? 'opacity-100 translate-x-1' : 'opacity-50'}`}>→</span>
                </div>
                {/* Response */}
                <div className={`flex items-center gap-1 transition-all duration-400 ${showRes ? 'opacity-100' : 'opacity-0'}`}>
                  <span className="text-blue-400 font-bold">←</span>
                  <span className={`text-xs font-mono font-bold ${row.isVuln ? 'text-red-400' : 'text-green-400'}`}>
                    {row.httpStatus}
                  </span>
                </div>
              </div>

              {/* API Server */}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all duration-300 ${
                  isActive && row.isVuln ? 'border-red-500 bg-red-900/60 shadow-md shadow-red-500/40'
                  : isActive ? 'border-blue-500 bg-blue-900/60'
                  : 'border-slate-600 bg-slate-800'
                }`}>⚙️</div>
                <span className="text-xs text-slate-500">API</span>
              </div>

              {/* Resource owner */}
              <div className="flex flex-col items-center">
                <span className={`text-2xl transition-all ${isActive && row.isVuln ? 'animate-pulse' : ''}`}>
                  {row.ownerName === 'ALICE' ? '👤' : '👤'}
                </span>
                <span className={`text-xs font-bold ${row.ownerColor}`}>{row.ownerName}</span>
              </div>

              {/* Result */}
              <div className="flex flex-col items-center">
                {row.isVuln ? (
                  <span className={`text-xl ${isActive ? 'animate-bounce' : ''}`}>🚨</span>
                ) : (
                  <span className="text-xl">✅</span>
                )}
                {row.isVuln && (
                  <span className="text-xs font-bold text-red-400 text-center">VULN!</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-3 bg-red-950/30 border border-red-800 rounded-lg p-3">
        <span className="text-xl shrink-0">🔍</span>
        <div className="text-sm">
          <span className="font-bold text-red-300">Root cause: </span>
          <span className="text-slate-300">
            <code className="text-yellow-300 bg-slate-900 px-1 rounded">JobService.getJobById()</code> runs{' '}
            <code className="text-red-300 bg-slate-900 px-1 rounded">WHERE id = $1</code> — it never checks{' '}
            <code className="text-green-300 bg-slate-900 px-1 rounded">AND owner_id = $2</code>.
            Any token works for any job ID.
          </span>
        </div>
      </div>
    </div>
  );
}

function BrokenAuthDiagram() {
  const [activeRow, setActiveRow] = useState(-1);
  const [phase, setPhase] = useState<'req' | 'res' | 'idle'>('idle');

  useEffect(() => {
    let cancelled = false;
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    const run = async () => {
      while (!cancelled) {
        for (let row = 0; row < 3 && !cancelled; row++) {
          setActiveRow(row);
          setPhase('req');
          await delay(800);
          setPhase('res');
          await delay(900);
          setPhase('idle');
          await delay(400);
        }
        setActiveRow(-1);
        await delay(1500);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const rows = [
    {
      label: 'Step 1 — Login',
      bgColor: 'bg-slate-800/40',
      borderColor: 'border-slate-700/50',
      activeBg: 'bg-blue-950/40',
      activeBorder: 'border-blue-700',
      request: 'email: alice@propowner.com + Password123!',
      requestColor: 'text-blue-300',
      response: 'JWT token (exp: now + 1 hour)',
      responseColor: 'text-green-400',
      leftIcon: '💻',
      leftLabel: 'Client',
      rightIcon: '🗄️',
      rightLabel: 'Server',
      actionLabel: 'Validate credentials\ngenerate JWT',
      actionColor: 'bg-slate-700',
      isVuln: false,
    },
    {
      label: 'Step 2 — Valid Token Request',
      bgColor: 'bg-slate-800/40',
      borderColor: 'border-slate-700/50',
      activeBg: 'bg-green-950/30',
      activeBorder: 'border-green-700',
      request: 'Authorization: Bearer eyJhbGci… (valid)',
      requestColor: 'text-green-300',
      response: '200 OK — job data returned ✅',
      responseColor: 'text-green-400',
      leftIcon: '💻',
      leftLabel: 'Client',
      rightIcon: '🗄️',
      rightLabel: 'Server',
      actionLabel: 'Validate JWT token\n✅ accepted',
      actionColor: 'bg-green-900',
      isVuln: false,
    },
    {
      label: 'Step 3 — EXPIRED Token (VULNERABLE)',
      bgColor: 'bg-red-950/20',
      borderColor: 'border-red-900/50',
      activeBg: 'bg-red-950/50',
      activeBorder: 'border-red-600',
      request: 'Authorization: Bearer eyJhbGci… (exp: 1 hour ago!)',
      requestColor: 'text-red-300',
      response: '200 OK — SHOULD BE 401 Unauthorized! ⚠️',
      responseColor: 'text-red-400',
      leftIcon: '💻',
      leftLabel: 'Attacker',
      rightIcon: '🗄️',
      rightLabel: 'Server',
      actionLabel: 'ignoreExpiration:\ntrue  ← VULN-2',
      actionColor: 'bg-red-900',
      isVuln: true,
    },
  ];

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">🔑</span>
        <div>
          <h3 className="text-base font-bold text-white">Broken Authentication — JWT Lifecycle</h3>
          <p className="text-xs text-slate-400">Stolen or expired tokens are accepted indefinitely due to <code className="text-yellow-300">ignoreExpiration: true</code></p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => {
          const isActive = activeRow === i;
          const showReq = isActive && (phase === 'req' || phase === 'res');
          const showRes = isActive && phase === 'res';

          return (
            <div
              key={i}
              className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                isActive ? `${row.activeBg} ${row.activeBorder} shadow-lg` : `${row.bgColor} ${row.borderColor}`
              }`}
            >
              {/* Row label */}
              <div className={`text-xs font-bold mb-3 ${row.isVuln ? 'text-red-400' : 'text-slate-400'}`}>
                {row.label}
              </div>

              <div className="flex items-center gap-3">
                {/* Left (Client/Attacker) */}
                <div className="flex flex-col items-center w-16 shrink-0">
                  <span className={`text-3xl transition-all ${isActive ? 'scale-110' : ''}`}>{row.leftIcon}</span>
                  <span className={`text-xs font-bold mt-1 ${row.isVuln ? 'text-red-400' : 'text-slate-400'}`}>{row.leftLabel}</span>
                </div>

                {/* Flow arrows */}
                <div className="flex-1 flex flex-col gap-2">
                  {/* Request */}
                  <div className={`flex items-center gap-2 transition-all duration-400 ${showReq ? 'opacity-100' : 'opacity-30'}`}>
                    <span className={`text-xs font-mono flex-1 ${row.requestColor}`}>{row.request}</span>
                    <span className={`text-lg font-bold text-blue-400 transition-transform duration-300 ${showReq ? 'translate-x-1' : ''}`}>→</span>
                  </div>
                  {/* Response */}
                  <div className={`flex items-center gap-2 transition-all duration-400 ${showRes ? 'opacity-100' : 'opacity-0'}`}>
                    <span className="text-lg font-bold text-blue-400">←</span>
                    <span className={`text-xs font-mono font-bold flex-1 ${row.responseColor}`}>{row.response}</span>
                  </div>
                </div>

                {/* Right (Server) */}
                <div className="flex flex-col items-center w-16 shrink-0">
                  <span className={`text-3xl transition-all ${isActive && row.isVuln ? 'animate-pulse' : ''}`}>{row.rightIcon}</span>
                  <span className="text-xs font-bold text-slate-400 mt-1">{row.rightLabel}</span>
                </div>

                {/* Action box (right side) */}
                <div className={`w-36 shrink-0 rounded-lg px-3 py-2 text-center transition-all duration-300 ${row.actionColor} ${isActive ? 'opacity-100 scale-100' : 'opacity-60 scale-95'}`}>
                  <p className="text-xs font-bold text-white whitespace-pre-line leading-tight">{row.actionLabel}</p>
                </div>
              </div>

              {/* Vuln badge */}
              {row.isVuln && isActive && (
                <div className="mt-3 flex items-center gap-2 bg-red-900/40 border border-red-700 rounded p-2">
                  <span className="animate-pulse text-lg">🚨</span>
                  <span className="text-xs text-red-300 font-semibold">
                    Expired token accepted! <code className="bg-slate-900 px-1 rounded">ignoreExpiration: true</code> in <code className="bg-slate-900 px-1 rounded">middleware/auth.ts</code>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-3 bg-red-950/30 border border-red-800 rounded-lg p-3">
        <span className="text-xl shrink-0">🔍</span>
        <div className="text-sm">
          <span className="font-bold text-red-300">Root cause: </span>
          <span className="text-slate-300">
            <code className="text-yellow-300 bg-slate-900 px-1 rounded">jwt.verify(token, secret, {'{ ignoreExpiration: true }'})</code>
            {' '}in <code className="text-red-300 bg-slate-900 px-1 rounded">middleware/auth.ts</code>.{' '}
            Remove <code className="text-green-300 bg-slate-900 px-1 rounded">ignoreExpiration: true</code> to enforce token expiry.
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [results, setResults]     = useState<Record<number, ExploitResult>>({});
  const [loading, setLoading]     = useState<Record<number, boolean>>({});
  const [selected, setSelected]   = useState<number | null>(null);
  const [workflows, setWorkflows] = useState<Record<number, string>>({});
  const [yamlOpen, setYamlOpen]   = useState<Record<number, boolean>>({});

  const selectedVuln = VULN_DEFS.find(v => v.id === selected);

  const getStatus = (id: number): Status => {
    const r = results[id];
    if (!r) return 'untested';
    return r.vulnerable ? 'vulnerable' : 'protected';
  };

  const runExploit = async (vuln: VulnDef) => {
    const fn = EXPLOITS.find(e => e.id === vuln.id)?.fn;
    if (!fn) return;
    setLoading(l => ({ ...l, [vuln.id]: true }));
    setYamlOpen(y => ({ ...y, [vuln.id]: true }));
    try {
      const [result, yamlJson] = await Promise.all([
        fn(),
        fetch(`/api/workflows/${vuln.workflowFile}`).then(r => r.json()).catch(() => ({ data: '' })),
      ]);
      setResults(r => ({ ...r, [vuln.id]: result }));
      setWorkflows(w => ({ ...w, [vuln.id]: yamlJson.data || '' }));
    } finally {
      setLoading(l => ({ ...l, [vuln.id]: false }));
    }
  };

  const testedCount = Object.keys(results).length;
  const vulnCount   = Object.values(results).filter(r => r.vulnerable).length;
  const safeCount   = Object.values(results).filter(r => !r.vulnerable).length;

  const result   = selected ? results[selected] : null;
  const isLoading = selected ? loading[selected] : false;
  const yaml     = selected ? workflows[selected] : '';
  const isYamlOpen = selected ? yamlOpen[selected] : false;

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* ── Hero Header ── */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700 p-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight mb-2">
              🛡️ API Security Dashboard
            </h1>
            <p className="text-slate-400 text-xl leading-relaxed max-w-2xl">
              Live demo of <span className="text-blue-400 font-semibold">10 OWASP API Security Top 10</span> vulnerabilities — detected automatically by GitHub Actions and fixed with Copilot AI.
            </p>
          </div>
          <a
            href={`https://github.com/${GITHUB_REPO}/actions`}
            target="_blank" rel="noopener noreferrer"
            className="no-underline flex items-center gap-2 bg-indigo-700 hover:bg-indigo-600 text-white font-bold px-5 py-3 rounded-xl text-base transition-colors"
          >
            ⚙️ GitHub Actions
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { label: 'Total Vulnerabilities', value: '10', color: 'text-blue-400', sub: 'OWASP API Top 10' },
            { label: 'Tested',     value: String(testedCount), color: 'text-slate-200', sub: `of 10 exploits run` },
            { label: 'Vulnerable', value: String(vulnCount),   color: 'text-red-400',   sub: 'confirmed exposed' },
            { label: 'Protected',  value: String(safeCount),   color: 'text-green-400', sub: 'after Copilot fix' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900/60 rounded-xl p-4 border border-slate-700">
              <div className={`text-4xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-slate-200 font-semibold mt-1">{s.label}</div>
              <div className="text-slate-500 text-sm">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Selector Grid ── */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Select a Vulnerability to Explore</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {VULN_DEFS.map(vuln => {
            const sev = SEV_COLORS[vuln.severity];
            const status = getStatus(vuln.id);
            const isSelected = selected === vuln.id;
            return (
              <button
                key={vuln.id}
                onClick={() => setSelected(vuln.id === selected ? null : vuln.id)}
                className={`
                  relative text-left rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer
                  ${isSelected
                    ? `${sev.ring} ring-2 ${sev.bg} border-transparent shadow-xl ${sev.glow}`
                    : 'border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-800'}
                `}
              >
                {/* Severity bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${sev.bar}`} />

                <div className="mt-1 mb-2 flex items-center justify-between">
                  <span className="text-2xl">{vuln.icon}</span>
                  <span className={`flex items-center gap-1 text-xs font-bold`}>
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
                    <span className={status === 'vulnerable' ? 'text-red-400' : status === 'protected' ? 'text-green-400' : 'text-slate-500'}>
                      {STATUS_LABEL[status]}
                    </span>
                  </span>
                </div>

                <div className="text-xs font-mono text-slate-500 mb-1">VULN-{vuln.id}</div>
                <div className="font-bold text-white text-base leading-tight mb-2">{vuln.shortName}</div>
                <div className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block ${sev.badge}`}>
                  {vuln.severity.toUpperCase()}
                </div>
                <div className="text-xs text-slate-500 mt-1">{vuln.owasp}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Detail Panel ── */}
      {!selected && (
        <div className="rounded-2xl border-2 border-dashed border-slate-700 p-12 text-center">
          <div className="text-5xl mb-4">☝️</div>
          <div className="text-2xl font-bold text-slate-300 mb-2">Select a vulnerability above to explore it</div>
          <div className="text-slate-500 text-lg">Click any card to see the attack narrative, GitHub Actions workflow, live HTTP evidence, and Copilot fix.</div>
        </div>
      )}

      {selectedVuln && (
        <div className={`rounded-2xl border-2 overflow-hidden ${SEV_COLORS[selectedVuln.severity].ring}`}>

          {/* Detail Header */}
          <div className={`${SEV_COLORS[selectedVuln.severity].bg} px-8 py-6 border-b border-slate-700`}>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className={`text-sm font-black px-3 py-1 rounded-lg uppercase tracking-widest ${SEV_COLORS[selectedVuln.severity].badge}`}>
                    {selectedVuln.severity}
                  </span>
                  <span className="text-sm font-mono text-slate-400 bg-slate-800 px-3 py-1 rounded-lg">{selectedVuln.owasp}</span>
                  <span className="text-sm font-mono text-blue-300 bg-slate-900/80 px-3 py-1 rounded-lg">{selectedVuln.endpoint}</span>
                </div>
                <h2 className="text-3xl font-black text-white mb-1">
                  {selectedVuln.icon} VULN-{selectedVuln.id}: {selectedVuln.category}
                </h2>
                <p className="text-slate-300 text-lg">{selectedVuln.description}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
              >✕ Close</button>
            </div>
          </div>

          <div className="bg-slate-950 p-8 space-y-8">

            {/* What is this */}
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
              <h3 className="text-xl font-bold text-white mb-3">🎯 What This Vulnerability Does</h3>
              <p className="text-slate-200 text-lg leading-relaxed">{selectedVuln.narrative}</p>
            </div>

            {/* Animated attack diagram — shown for VULN-1 and VULN-2 */}
            {selectedVuln.id === 1 && <BolaDiagram />}
            {selectedVuln.id === 2 && <BrokenAuthDiagram />}

            {/* How GitHub Actions catches it */}
            <div className="bg-slate-900 rounded-xl border border-indigo-800 p-6">
              <h3 className="text-xl font-bold text-white mb-3">⚙️ How GitHub Actions Detects &amp; Fixes This</h3>
              <p className="text-slate-200 text-lg leading-relaxed">{selectedVuln.howGitHubCatches}</p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4 flex-wrap">
              <button
                onClick={() => runExploit(selectedVuln)}
                disabled={!!isLoading}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-black text-lg px-8 py-4 rounded-xl transition-colors shadow-lg shadow-green-900/40"
              >
                {isLoading ? <><span className="animate-spin inline-block text-xl">⟳</span> Running Exploit…</> : '▶ Run Exploit'}
              </button>
              <a
                href={`${GITHUB_ACTIONS_BASE}/${selectedVuln.workflowFile}`}
                target="_blank" rel="noopener noreferrer"
                className="no-underline flex items-center gap-2 bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-lg px-8 py-4 rounded-xl transition-colors"
              >🔗 View GitHub Actions</a>
            </div>

            {/* Results */}
            {isLoading && (
              <div className="bg-slate-900 rounded-xl border border-slate-700 p-8 text-center">
                <div className="text-5xl animate-spin inline-block mb-4">⟳</div>
                <div className="text-slate-300 text-xl">Running exploit against live API…</div>
              </div>
            )}

            {!isLoading && result && (
              <>
                {/* Status Banner */}
                <div className={`rounded-xl px-6 py-5 border-2 ${result.vulnerable ? 'bg-red-950/60 border-red-600' : 'bg-green-950/60 border-green-600'}`}>
                  <div className={`text-2xl font-black mb-2 ${result.vulnerable ? 'text-red-300' : 'text-green-300'}`}>
                    {result.vulnerable ? '🔴 VULNERABLE — Exploit Succeeded' : '🟢 PROTECTED — Exploit Blocked'}
                  </div>
                  {result.details.split('\n').map((line, i) => (
                    <div key={i} className={`${i === 0 ? 'text-lg font-semibold text-slate-200' : 'text-base text-slate-400 font-mono mt-1'}`}>
                      {line}
                    </div>
                  ))}
                </div>

                {/* GitHub Actions Workflow YAML */}
                <div className="rounded-xl border border-slate-600 overflow-hidden">
                  <button
                    onClick={() => setYamlOpen(y => ({ ...y, [selectedVuln.id]: !isYamlOpen }))}
                    className="w-full flex justify-between items-center px-6 py-4 bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-white">⚙️ GitHub Actions Workflow</span>
                      <span className="text-sm font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded-lg">{selectedVuln.workflowFile}</span>
                      <a
                        href={`${GITHUB_ACTIONS_BASE}/${selectedVuln.workflowFile}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="no-underline text-sm bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1 rounded-lg transition-colors"
                      >🔗 Open in GitHub</a>
                    </div>
                    <span className="text-slate-400 text-sm font-bold">{isYamlOpen ? '▲ Collapse' : '▼ Expand'}</span>
                  </button>
                  {isYamlOpen && (
                    <>
                      <div className="px-6 py-3 border-t border-b border-slate-700 bg-slate-900/50 flex gap-6 text-sm">
                        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-500 inline-block"/><span className="text-red-300 font-semibold">Vulnerability detected</span></span>
                        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-600 inline-block"/><span className="text-green-300 font-semibold">Fix suggestion</span></span>
                        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-600 inline-block"/><span className="text-blue-300 font-semibold">Step name</span></span>
                      </div>
                      <div className="max-h-96 overflow-auto p-4">
                        {yaml ? <YamlViewer yaml={yaml} /> : <div className="text-slate-500 text-base p-4">Could not load workflow YAML.</div>}
                      </div>
                    </>
                  )}
                </div>

                {/* Before / After HTTP */}
                <div>
                  <h3 className="text-xl font-bold text-white mb-4">📡 HTTP Evidence — Before &amp; After Fix</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border-2 border-red-700 overflow-hidden">
                      <div className="bg-red-900/40 px-5 py-3 border-b border-red-800">
                        <span className="text-base font-black text-red-300">🔴 Before Fix — Vulnerable</span>
                      </div>
                      <div className="p-5 space-y-3 bg-slate-900/60">
                        <div className="text-sm font-black text-slate-400 uppercase tracking-widest">HTTP Request</div>
                        <pre className="text-sm font-mono bg-slate-950 text-green-300 p-4 rounded-lg border border-slate-700 overflow-auto whitespace-pre-wrap leading-relaxed">{result.request}</pre>
                        <div className="text-sm font-black text-slate-400 uppercase tracking-widest">HTTP Response</div>
                        <pre className="text-sm font-mono bg-slate-950 text-red-300 p-4 rounded-lg border border-red-900 overflow-auto whitespace-pre-wrap max-h-60 leading-relaxed">{result.response}</pre>
                      </div>
                    </div>
                    <div className="rounded-xl border-2 border-green-700 overflow-hidden">
                      <div className="bg-green-900/40 px-5 py-3 border-b border-green-800">
                        <span className="text-base font-black text-green-300">🟢 After Copilot Fix — Protected</span>
                      </div>
                      <div className="p-5 space-y-3 bg-slate-900/60">
                        <div className="text-sm font-black text-slate-400 uppercase tracking-widest">HTTP Request (unchanged)</div>
                        <pre className="text-sm font-mono bg-slate-950 text-green-300 p-4 rounded-lg border border-slate-700 overflow-auto whitespace-pre-wrap leading-relaxed">{result.request}</pre>
                        <div className="text-sm font-black text-slate-400 uppercase tracking-widest">HTTP Response</div>
                        <pre className="text-sm font-mono bg-slate-950 text-green-400 p-4 rounded-lg border border-green-900 overflow-auto whitespace-pre-wrap max-h-60 leading-relaxed">{result.fixedResponse}</pre>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fix box */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl border-2 border-green-800 p-6 flex gap-4">
                  <span className="text-4xl">🔧</span>
                  <div>
                    <div className="text-xl font-black text-green-400 mb-2">Copilot AI — Suggested Fix</div>
                    <div className="text-base font-mono text-slate-100 leading-relaxed bg-slate-950 px-4 py-3 rounded-lg border border-slate-700">{selectedVuln.fix}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* How It Works footer */}
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-8">
        <h2 className="text-2xl font-bold text-white mb-6">⚡ How the Automation Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: '🔁', title: 'Continuous Monitoring', desc: '10 GitHub Actions workflows run on every push and pull request, sending crafted HTTP requests that probe each vulnerability against the live API.' },
            { icon: '🚨', title: 'Automatic Detection', desc: 'Each workflow analyzes status codes, response payloads, and headers — creating a GitHub Issue with full evidence when a vulnerability is confirmed.' },
            { icon: '🤖', title: 'Copilot Autofix', desc: 'GitHub Copilot analyzes the flagged code and generates an exact fix — turning "vulnerability detected" into a pull request with the corrected code.' },
          ].map(item => (
            <div key={item.title} className="flex gap-5">
              <div className="text-4xl mt-1">{item.icon}</div>
              <div>
                <div className="text-xl font-bold text-white mb-2">{item.title}</div>
                <div className="text-slate-400 text-base leading-relaxed">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
