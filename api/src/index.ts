import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { authRouter } from './routes/auth';
import { propertyRouter } from './routes/properties';
import { contractorRouter } from './routes/contractors';
import { jobRouter } from './routes/jobs';
import { recommendationRouter } from './routes/recommendations';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// VULN-7: CORS Misconfiguration — wildcard origin with credentials: true (invalid but accepted by many browsers in dev)
app.use(cors({
  origin: '*', // VULN-7: Should be specific origin list, not wildcard
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // VULN-7: credentials: true with origin: '*' is a misconfiguration
}));

app.use(helmet());
app.use(express.json({ limit: '50mb' })); // VULN-4: No JSON body size cap
app.use(express.urlencoded({ extended: true }));

// Public routes
app.use('/api/auth', authRouter);

// Protected routes (auth required)
app.use('/api/properties', authMiddleware, propertyRouter);
app.use('/api/contractors', authMiddleware, contractorRouter);
app.use('/api/jobs', authMiddleware, jobRouter);
app.use('/api/recommendations', authMiddleware, recommendationRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'proptracker-api', timestamp: new Date().toISOString() });
});

// Vulnerability status endpoint — lists all 10 vulns for the dashboard
app.get('/api/vulnerabilities', (_req, res) => {
  res.json({
    data: [
      { id: 1, category: 'BOLA', owasp: 'API1:2023', endpoint: 'GET /api/jobs/:id', description: 'Any authenticated user can access any job by ID — no ownership check', severity: 'critical' },
      { id: 2, category: 'Broken Authentication', owasp: 'API2:2023', endpoint: 'All protected routes', description: 'Expired JWT tokens are accepted — ignoreExpiration: true in middleware', severity: 'high' },
      { id: 3, category: 'Mass Assignment', owasp: 'API3:2023', endpoint: 'PUT /api/contractors/:id', description: 'isVerified and role fields are writable by contractor via req.body spread', severity: 'high' },
      { id: 4, category: 'Large Payload DoS', owasp: 'API4:2023', endpoint: 'POST /api/jobs/:id/attachments', description: 'No file size limit on multipart upload — large files burn CPU/memory', severity: 'medium' },
      { id: 5, category: 'Pagination Abuse', owasp: 'API4:2023', endpoint: 'GET /api/properties?limit=N', description: 'No maximum page size — limit=999999 returns the entire table', severity: 'medium' },
      { id: 6, category: 'Rate Limit Abuse', owasp: 'API4:2023', endpoint: 'POST /api/jobs/:id/bids', description: 'No per-user rate limiting — one user can flood hundreds of bids', severity: 'medium' },
      { id: 7, category: 'CORS Misconfiguration', owasp: 'API7:2023', endpoint: 'All routes', description: 'Access-Control-Allow-Origin: * with credentials: true — any origin accepted', severity: 'high' },
      { id: 8, category: 'SQL Injection', owasp: 'API8:2023', endpoint: 'GET /api/properties/search', description: 'Search term concatenated directly into SQL query — classic injection', severity: 'critical' },
      { id: 9, category: 'Unrestricted Business Flow', owasp: 'API5:2023', endpoint: 'POST /api/jobs/:id/complete', description: 'Any contractor can mark any job as complete — no assigned-contractor check', severity: 'high' },
      { id: 10, category: 'SSRF', owasp: 'API10:2023', endpoint: 'POST /api/contractors/:id/trigger-webhook', description: 'Server fetches user-supplied webhook URL — can hit internal Azure metadata service', severity: 'critical' },
    ]
  });
});

// Trigger a GitHub Actions workflow dispatch (for the demo dashboard "Run Workflow" button)
app.post('/api/workflows/:filename/trigger', authMiddleware, async (req: any, res) => {
  const { filename } = req.params;
  if (!filename.match(/^[\w-]+\.yml$/)) {
    return res.status(400).json({ error: 'Invalid filename' }) as any;
  }
  const githubToken = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!githubToken || !repo) {
    return res.status(503).json({ error: 'GITHUB_TOKEN not configured on server' });
  }
  try {
    // Trigger workflow_dispatch
    const triggerRes = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${filename}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
      }
    );
    if (triggerRes.status !== 204 && !triggerRes.ok) {
      const text = await triggerRes.text();
      return res.status(400).json({ error: `GitHub API: ${text}` });
    }
    // Wait 2 s then fetch the latest run URL so the frontend can link to it
    await new Promise(r => setTimeout(r, 2000));
    const runsRes = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${filename}/runs?per_page=1`,
      { headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' } }
    );
    const runsData: any = await runsRes.json();
    const runUrl: string =
      runsData.workflow_runs?.[0]?.html_url ??
      `https://github.com/${repo}/actions/workflows/${filename}`;
    res.json({ message: 'Workflow triggered', runUrl });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Serve GitHub Actions workflow YAML files for the demo dashboard
app.get('/api/workflows/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!filename.match(/^[\w-]+\.yml$/)) {
    return res.status(400).json({ error: 'Invalid filename' }) as any;
  }
  const workflowsDir = path.resolve(__dirname, '../../.github/workflows');
  const filePath = path.join(workflowsDir, filename);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ data: content, filename });
  } catch {
    res.status(404).json({ error: 'Workflow not found' });
  }
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`PropTracker API running on port ${PORT}`);
});

export default app;