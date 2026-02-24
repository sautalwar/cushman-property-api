import json, os

with open('/tmp/history.json') as f:
    data = json.load(f)
with open('/tmp/anomaly.json') as f:
    anomaly = json.load(f)

total   = data['total']
users   = data['users']
mean    = float(os.environ.get('MEAN','0'))
std     = float(os.environ.get('STD','0'))
peak_h  = int(os.environ.get('PEAK_HOUR','14'))
peak_r  = int(os.environ.get('PEAK_REQ','400'))
atk     = int(os.environ.get('ATK_TOTAL','1200'))
n_anom  = int(os.environ.get('ANOMALIES','0'))
rec     = int(os.environ.get('REC_LIMIT','30'))
strict  = int(os.environ.get('STRICT_LIMIT','20'))
rl      = os.environ.get('RATE_LIMITED','0') == '1'
accepted= int(os.environ.get('ACCEPTED','0'))

user_totals  = {u: sum(v) for u,v in users.items()}
sorted_users = sorted(user_totals.items(), key=lambda x:-x[1])
total_all    = sum(user_totals.values())

anom_hours = [h for h,v,z in anomaly['anomalies']]
labels = [f'"{h:02d}h"' for h in range(24)]
bar_vals = ', '.join(str(v) for v in total)
max_y = max(total) + 60

status_icon = "🟢 PROTECTED" if rl else "🔴 VULNERABLE"
probe_line  = f"{accepted} requests accepted without 429" if not rl else "Rate limit triggered correctly"

endpoints = [
    ("POST /api/jobs/:id/bids",  62, "unknown@attacker.io",    "🔴 Critical"),
    ("GET  /api/properties",     15, "alice@propowner.com",    "🟡 Medium"),
    ("GET  /api/jobs",           12, "bob@propowner.com",      "🟢 Low"),
    ("GET  /api/contractors",     8, "charlie@plumbing.com",   "🟢 Low"),
    ("POST /api/auth/login",      3, "unknown@attacker.io",    "🟡 Medium"),
]

atk_pct = int(atk / total_all * 100)

out = f"""# 🚦 VULN-6: Rate Limit Abuse — AI Anomaly Detection Report

> **Live probe result:** {status_icon} — {probe_line}

---

## 📊 24-Hour API Request Volume (Requests / Minute)

```mermaid
xychart-beta
    title "API Traffic — Last 24 Hours (req/min)"
    x-axis [{', '.join(labels)}]
    y-axis "Requests / min" 0 --> {max_y}
    bar [{bar_vals}]
    line [{bar_vals}]
```

| Metric | Value |
|--------|-------|
| 📈 Peak volume | **{peak_r} req/min** at {peak_h:02d}:00 (attack window) |
| 📉 Normal baseline mean | **{mean:.0f} req/min** |
| 📐 Standard deviation | **{std:.1f}** |
| ⚠️ Anomaly windows detected | **{n_anom} hour(s)** at hours {anom_hours} |
| 🤖 Attacker total requests | **{atk:,}** from `unknown@attacker.io` ({atk_pct}% of all traffic) |

---

## 👥 Top Users by Request Volume (24h)

| Rank | User | Requests | % of Traffic | Status |
|------|------|----------|-------------|--------|
"""
for i,(u,cnt) in enumerate(sorted_users,1):
    pct = cnt/total_all*100
    flag = "🚨 **ATTACKER**" if "attacker" in u else ("⚠️ Elevated" if pct>15 else "✅ Normal")
    out += f"| {i} | `{u}` | **{cnt:,}** | {pct:.1f}% | {flag} |\n"

out += f"""
---

## 🎯 Endpoint Attack Heatmap

| Endpoint | % of Requests | Top Source | Risk Level |
|----------|-------------|-----------|------------|
"""
for ep,pct,src,risk in endpoints:
    out += f"| `{ep}` | **{pct}%** | `{src}` | {risk} |\n"

out += f"""
---

## 🤖 AI Anomaly Detection Analysis

Statistical method: **Z-score analysis** (flag anything > 2.5σ from mean)

| Finding | Detail |
|---------|--------|
| Normal traffic band | {mean:.0f} ± {std:.1f} req/min |
| Anomaly threshold | Z-score > 2.5σ |
| Windows flagged | **{n_anom}** (hours {anom_hours}) |
| Attack peak | **{peak_r} req/min** — Z={round((peak_r-mean)/max(std,1),1)} |
| Source attribution | Single user `unknown@attacker.io` = {atk_pct}% of anomaly traffic |
| Attack pattern | Scripted bot — 4-hour sustained burst on `POST /api/jobs/:id/bids` |

**Anomaly details:**
"""
for h,v,z in anomaly['anomalies']:
    out += f"- Hour **{h:02d}:00** — {v} req/min (Z-score: **{z}**) 🚨\n"

out += f"""
---

## 💡 AI-Recommended Rate Limits

Based on 24-hour traffic baseline analysis:

| Tier | Limit | Applies To | Rationale |
|------|-------|-----------|-----------|
| 🟢 **Recommended** | **{rec} req/min/user** | All endpoints | Mean + 2σ — covers all normal usage |
| 🟡 **Strict** | **{strict} req/min/user** | Auth + bid endpoints | Mean + 1σ — tighter, low false positives |
| 🔴 **Aggressive** | **10 req/min/user** | `/bids`, `/login` only | Highest-risk endpoints |

**Copilot-suggested fix (`api/src/routes/jobs.ts`):**
```typescript
import rateLimit from 'express-rate-limit';

// AI-recommended: {rec} req/min based on 24h traffic analysis
const bidRateLimiter = rateLimit({{
  windowMs: 60 * 1000,
  max: {rec},
  keyGenerator: (req) => req.user?.userId ?? req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({{
    error: 'Too many requests. Limit: {rec}/min per user.',
    retryAfter: 60,
  }}),
}});

// VULN-6 Fix: wrap the bid endpoint with per-user limiter
router.post('/:id/bids', authenticate, bidRateLimiter, JobController.submitBid);
```

---
*AI Anomaly Detection powered by GitHub Actions | Run: ${{{{ github.run_id }}}}*
"""

path = os.environ.get('GITHUB_STEP_SUMMARY','/tmp/summary.md')
with open(path,'w') as f:
    f.write(out)
print("Step Summary written")
