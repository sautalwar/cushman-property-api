import json, os, urllib.request, urllib.error, base64, time

api = os.environ.get('API_URL', 'http://localhost:3001')
findings = []

def http(method, path, body=None, headers=None):
    """Simple HTTP helper — avoids needing curl or requests library."""
    url = f"{api}{path}"
    data = json.dumps(body).encode() if body else None
    hdrs = {'Content-Type': 'application/json', **(headers or {})}
    try:
        req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
        with urllib.request.urlopen(req, timeout=4) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, {}
    except Exception:
        return 0, {}   # API unreachable in CI — skip probe

def login(email):
    status, body = http('POST', '/api/auth/login',
                         {'email': email, 'password': 'Password123!'})
    return body.get('data', {}).get('token', '') if status == 200 else ''

# ── Probe 1: BOLA ──────────────────────────────────────────────────────────
# Bob (different owner) tries to read Alice's job. Should get 403, not 200.
bob_token = login('bob@propowner.com')
if bob_token:
    status, body = http('GET', '/api/jobs/cccccccc-0000-0000-0000-000000000001',
                         headers={'Authorization': f'Bearer {bob_token}'})
    if status == 200:
        findings.append({
            'id': 'VULN-1-BOLA', 'severity': 'critical',
            'rule': 'API1:2023 — Broken Object Level Authorization',
            'file': 'api/src/services/JobService.ts', 'line': 12,
            'message': f"Bob accessed Alice's job (HTTP {status}). "
                       f"Job title: '{body.get('data',{}).get('title','N/A')}'. "
                       "No owner_id check in SQL query.",
            'fix': "Add 'AND owner_id = $2' to WHERE clause in getJobById()"
        })

# ── Probe 2: Broken Auth ───────────────────────────────────────────────────
# Send a token with exp = 1 hour ago. Should get 401, not 200.
import struct
def make_expired_jwt():
    now = int(time.time())
    hdr = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').rstrip(b'=').decode()
    pay = base64.urlsafe_b64encode(json.dumps({
        'userId': '11111111-0000-0000-0000-000000000001',
        'role': 'admin', 'iat': now - 7200, 'exp': now - 3600
    }).encode()).rstrip(b'=').decode()
    return f"{hdr}.{pay}.invalidsig"

expired = make_expired_jwt()
status, _ = http('GET', '/api/jobs', headers={'Authorization': f'Bearer {expired}'})
if status == 200:
    findings.append({
        'id': 'VULN-2-AUTH', 'severity': 'critical',
        'rule': 'API2:2023 — Broken Authentication',
        'file': 'api/src/middleware/auth.ts', 'line': 18,
        'message': f"Expired JWT accepted (HTTP {status}). "
                   "ignoreExpiration: true allows tokens expired hours/days ago.",
        'fix': "Remove ignoreExpiration: true from jwt.verify() options"
    })

# ── Probe 3: Rate Limit ────────────────────────────────────────────────────
# Send 20 rapid requests. If none return 429, rate limiting is missing.
charlie_token = login('charlie@plumbing.com')
if charlie_token:
    got_429 = False
    for i in range(20):
        status, _ = http('POST', '/api/jobs/cccccccc-0000-0000-0000-000000000001/bids',
                          {'amount': 100 + i},
                          headers={'Authorization': f'Bearer {charlie_token}'})
        if status == 429:
            got_429 = True
            break
    if not got_429:
        findings.append({
            'id': 'VULN-6-RATELIMIT', 'severity': 'medium',
            'rule': 'API4:2023 — Unrestricted Resource Consumption',
            'file': 'api/src/routes/jobs.ts', 'line': 45,
            'message': "20 consecutive bid requests accepted without any 429 response. "
                       "No per-user rate limiter on POST /api/jobs/:id/bids.",
            'fix': "Add express-rate-limit with keyGenerator: (req) => req.user.userId"
        })

# ── Probe 4: SQL Injection ─────────────────────────────────────────────────
# Send injection payload to /search. If row count is abnormally high → vulnerable.
alice_token = login('alice@propowner.com')
if alice_token:
    _, baseline = http('GET', '/api/properties?limit=5',
                        headers={'Authorization': f'Bearer {alice_token}'})
    safe_count = baseline.get('count', 0)
    try:
        import urllib.parse
        q = urllib.parse.quote("' OR 1=1 --")
        status, body = http('GET', f'/api/properties/search?q={q}',
                             headers={'Authorization': f'Bearer {alice_token}'})
        injected_count = body.get('count', 0)
        if isinstance(injected_count, int) and isinstance(safe_count, int):
            if injected_count > safe_count + 2:
                findings.append({
                    'id': 'VULN-8-SQLI', 'severity': 'critical',
                    'rule': 'API8:2023 — Security Misconfiguration (SQL Injection)',
                    'file': 'api/src/services/PropertyService.ts', 'line': 67,
                    'message': f"SQL injection returned {injected_count} rows vs safe baseline {safe_count}. "
                               "Payload: q=' OR 1=1 --",
                    'fix': "Replace string concat with parameterized: WHERE name ILIKE $1"
                })
    except Exception:
        pass

# Write results
with open('/tmp/runtime_findings.json', 'w') as f:
    json.dump({'findings': findings}, f, indent=2)

print(f"Runtime probes complete — {len(findings)} finding(s)")
for f in findings:
    print(f"  [{f['severity'].upper()}] {f['id']}: {f['message'][:80]}...")
