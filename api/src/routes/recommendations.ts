import { Router, Request, Response } from 'express';

const router = Router();
const GITHUB_API = 'https://api.github.com';

interface RecommendationBody {
  vulnId: number;
  title: string;
  severity: string;
  owasp: string;
  endpoint: string;
  description: string;
  fix: string;
  evidence?: string;
}

// POST /api/recommendations — create a GitHub Issue for a detected vulnerability
router.post('/', async (req: Request, res: Response) => {
  const body = req.body as RecommendationBody;
  const { vulnId, title, severity, owasp, endpoint, description, fix, evidence } = body;

  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO || 'sautalwar/cushman-property-api';

  if (!token) {
    return res.status(503).json({ error: 'GITHUB_TOKEN not configured on API server' });
  }

  const sevEmoji: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡' };
  const icon = sevEmoji[severity] ?? '⚠️';

  const issueBody = `## ${icon} VULN-${vulnId}: ${title}

**Severity:** \`${severity.toUpperCase()}\`  **OWASP:** \`${owasp}\`  **Endpoint:** \`${endpoint}\`

---

### What was detected

${description}

${evidence ? `### Live Evidence\n\`\`\`\n${evidence}\n\`\`\`` : ''}

---

### 🤖 AI-Recommended Fix (GitHub Copilot)

\`\`\`typescript
${fix}
\`\`\`

---

### How to apply

1. Review the fix above in context of the codebase
2. Apply the change and run \`npm test\` in \`/api\`
3. Push to a branch — GitHub Actions will re-run the security check
4. If the check passes, merge the PR

> **Apply or dismiss?**
> - Add label \`apply-fix\` → triggers Copilot to open a PR with the patch
> - Add label \`risk-accepted\` → closes this issue as a known, accepted risk

---
*Generated automatically by the PropTracker API Security Dashboard*`;

  try {
    const ghRes = await fetch(`${GITHUB_API}/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title: `${icon} Security Recommendation: Fix VULN-${vulnId} — ${title}`,
        body: issueBody,
        labels: ['security', 'ai-recommendation', `vuln-${vulnId}`, severity],
      }),
    });

    if (!ghRes.ok) {
      const err = await ghRes.text();
      return res.status(ghRes.status).json({ error: `GitHub API error: ${err}` });
    }

    const issue = await ghRes.json() as { number: number; html_url: string; title: string };
    return res.json({
      data: {
        issueNumber: issue.number,
        issueUrl: issue.html_url,
        title: issue.title,
      },
      message: `Issue #${issue.number} created successfully`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: `Failed to create issue: ${err.message}` });
  }
});

// GET /api/recommendations — list open security recommendation issues
router.get('/', async (_req: Request, res: Response) => {
  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO || 'sautalwar/cushman-property-api';

  if (!token) {
    return res.status(503).json({ error: 'GITHUB_TOKEN not configured' });
  }

  try {
    const ghRes = await fetch(
      `${GITHUB_API}/repos/${repo}/issues?labels=ai-recommendation&state=open&per_page=20`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github+json',
        },
      }
    );
    const issues = await ghRes.json() as any[];
    return res.json({
      data: issues.map(i => ({
        number: i.number,
        title: i.title,
        url: i.html_url,
        labels: i.labels.map((l: any) => l.name),
        createdAt: i.created_at,
      })),
      count: issues.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export { router as recommendationRouter };
