import json, os, datetime

repo = os.environ.get('GITHUB_REPO', 'sautalwar/cushman-property-api')
code_count    = int(os.environ.get('CODE_SCAN_COUNT', 0))
secret_count  = int(os.environ.get('SECRET_COUNT', 0))
dep_count     = int(os.environ.get('DEP_COUNT', 0))
runtime_count = int(os.environ.get('RUNTIME_COUNT', 0))

with open('/tmp/runtime_findings.json') as f:
    runtime = json.load(f)

findings = runtime.get('findings', [])
critical = sum(1 for f in findings if f['severity'] == 'critical')
high     = sum(1 for f in findings if f['severity'] == 'high')
medium   = sum(1 for f in findings if f['severity'] == 'medium')

# Risk score: weighted sum (critical=10, high=6, medium=3, secret=15, dep=4)
risk_score = (critical * 10) + (high * 6) + (medium * 3) + (secret_count * 15) + (dep_count * 4) + (code_count * 5)
risk_label = "🔴 CRITICAL" if risk_score > 30 else "🟠 HIGH" if risk_score > 15 else "🟡 MEDIUM" if risk_score > 5 else "🟢 LOW"

now = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')
run_id = os.environ.get('GITHUB_RUN_ID', '')

summary = f"""# 🔐 Security Posture Dashboard
**Repository:** `{repo}` | **Scanned:** {now} | **Overall Risk:** {risk_label} (score: {risk_score})

---

## 📊 Security Signal Summary

| Source | Open Findings | Severity | Action Required |
|--------|-------------|----------|----------------|
| 🔬 Runtime API Probes | **{runtime_count}** | Critical: {critical} · High: {high} · Medium: {medium} | {'🚨 Immediate' if critical > 0 else '⚠️ Review'} |
| 🔍 GHAS Code Scanning | **{code_count}** | See Security tab | {'🚨 Review now' if code_count > 0 else '✅ Clean'} |
| 🔑 Secret Scanning | **{secret_count}** | Critical (always) | {'🚨 ROTATE NOW' if secret_count > 0 else '✅ No secrets exposed'} |
| 📦 Dependabot CVEs | **{dep_count}** | Mixed | {'⚠️ Upgrade deps' if dep_count > 0 else '✅ Dependencies clean'} |

---

## 🔬 Runtime Probe Findings
"""
if findings:
    for f in findings:
        icon = {'critical':'🔴','high':'🟠','medium':'🟡'}.get(f['severity'],'⚠️')
        summary += f"\n### {icon} `{f['id']}` — {f['rule']}\n"
        summary += f"**File:** `{f['file']}` line {f['line']}\n\n"
        summary += f"**Evidence:** {f['message']}\n\n"
        summary += f"**Fix:** `{f['fix']}`\n\n"
        summary += "---\n"
else:
    summary += "\n✅ **No runtime vulnerabilities detected in this scan.**\n\n---\n"

summary += f"""
## 🔗 Quick Links

- [Security Overview](https://github.com/{repo}/security) — All GHAS findings
- [Code Scanning Alerts](https://github.com/{repo}/security/code-scanning) — CodeQL results
- [Open Issues](https://github.com/{repo}/issues?q=label%3Aai-recommendation+is%3Aopen) — AI recommendations awaiting approval
- [Actions Run](https://github.com/{repo}/actions/runs/{run_id}) — This workflow run

---
*Security Posture Dashboard · Generated automatically by GitHub Actions · {now}*
"""

with open(os.environ.get('GITHUB_STEP_SUMMARY', '/tmp/summary.md'), 'w') as f:
    f.write(summary)
print("Security posture dashboard written to Step Summary")
