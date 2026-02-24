import { useState, useEffect } from 'react';
import axios from 'axios';
import { getToken } from '../api/auth';
import { exploitBOLA, exploitRateLimit } from '../api/exploits';

interface Job {
  id: string;
  title: string;
  description: string;
  status: string;
  required_specialty: string;
  owner_id: string;
  property_id?: string;
  assigned_contractor_id?: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-900 text-blue-300 border-blue-700',
  assigned: 'bg-purple-900 text-purple-300 border-purple-700',
  in_progress: 'bg-yellow-900 text-yellow-300 border-yellow-700',
  completed: 'bg-green-900 text-green-300 border-green-700',
  disputed: 'bg-red-900 text-red-300 border-red-700',
};

const SPECIALTY_ICONS: Record<string, string> = {
  plumbing: '🔧',
  electrical: '⚡',
  roofing: '🏠',
  hvac: '❄️',
  painting: '🎨',
};

const STATUS_TABS = ['All', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];

function ExploitPanel({
  title, severity, children,
}: { title: string; severity: 'critical' | 'high' | 'medium'; children: React.ReactNode }) {
  const colors = {
    critical: 'bg-red-950 border-red-700',
    high: 'bg-orange-950 border-orange-700',
    medium: 'bg-yellow-950 border-yellow-700',
  };
  const badge = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-black',
  };
  return (
    <div className={`${colors[severity]} border rounded-lg p-5 mb-4`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${badge[severity]}`}>{severity}</span>
        <h3 className="font-bold text-white text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  // BOLA state
  const [bolaRunning, setBolaRunning] = useState(false);
  const [bolaResult, setBolaResult] = useState<{ details: string; request: string; response: string; vulnerable: boolean } | null>(null);

  // Rate limit state
  const [rateRunning, setRateRunning] = useState(false);
  const [rateResult, setRateResult] = useState<{ details: string; request: string; response: string; vulnerable: boolean } | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const token = await getToken('alice');
        const r = await axios.get('/api/jobs', { headers: { Authorization: `Bearer ${token}` } });
        setJobs(r.data.data ?? []);
      } catch {
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const runBola = async () => {
    setBolaRunning(true);
    setBolaResult(null);
    const result = await exploitBOLA();
    setBolaResult(result);
    setBolaRunning(false);
  };

  const runRateLimit = async () => {
    setRateRunning(true);
    setRateResult(null);
    const result = await exploitRateLimit();
    setRateResult(result);
    setRateRunning(false);
  };

  const filteredJobs = statusFilter === 'All'
    ? jobs
    : jobs.filter(j => j.status.toUpperCase() === statusFilter);

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">📋 Jobs Board</h1>

      {/* VULN-1 BOLA Panel */}
      <ExploitPanel title="VULN-1: BOLA — Bob Accesses Alice's Job" severity="critical">
        <p className="text-slate-300 text-sm mb-3">
          Bob (a different property owner) uses his valid token to fetch Alice's job{' '}
          <code className="bg-slate-800 px-1 rounded text-xs">cccccccc-0000-0000-0000-000000000001</code>.
          The server returns it without checking ownership.
        </p>
        <button
          onClick={runBola}
          disabled={bolaRunning}
          className="flex items-center gap-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded mb-3"
        >
          {bolaRunning ? <><span className="animate-spin inline-block">⟳</span> Running…</> : '▶ Run Exploit'}
        </button>
        {bolaResult && (
          <div className="space-y-2">
            <div className={`text-sm font-mono px-3 py-2 rounded ${bolaResult.vulnerable ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}`}>
              {bolaResult.vulnerable ? '🔴' : '🟢'} {bolaResult.details}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <div className="text-xs font-bold text-slate-400 mb-1">Request</div>
                <pre className="text-xs font-mono bg-slate-900 text-green-300 p-2 rounded border border-slate-700 whitespace-pre-wrap">{bolaResult.request}</pre>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 mb-1">Response</div>
                <pre className="text-xs font-mono bg-slate-900 text-yellow-300 p-2 rounded border border-slate-700 whitespace-pre-wrap">{bolaResult.response}</pre>
              </div>
            </div>
          </div>
        )}
      </ExploitPanel>

      {/* VULN-6 Rate Limit Panel */}
      <ExploitPanel title="VULN-6: Rate Limiting — Flood Bids (15 rapid requests)" severity="medium">
        <p className="text-slate-300 text-sm mb-3">
          Charlie sends 15 bid requests in parallel to Job 1. If no rate limiting exists, all succeed with 0 HTTP 429 responses.
        </p>
        <button
          onClick={runRateLimit}
          disabled={rateRunning}
          className="flex items-center gap-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded mb-3"
        >
          {rateRunning ? <><span className="animate-spin inline-block">⟳</span> Running 15 bids…</> : '▶ Run Exploit'}
        </button>
        {rateResult && (
          <div className="space-y-2">
            <div className={`text-sm font-mono px-3 py-2 rounded ${rateResult.vulnerable ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}`}>
              {rateResult.vulnerable ? '🔴' : '🟢'} {rateResult.details}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <div className="text-xs font-bold text-slate-400 mb-1">Request</div>
                <pre className="text-xs font-mono bg-slate-900 text-green-300 p-2 rounded border border-slate-700 whitespace-pre-wrap">{rateResult.request}</pre>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 mb-1">Response</div>
                <pre className="text-xs font-mono bg-slate-900 text-yellow-300 p-2 rounded border border-slate-700 whitespace-pre-wrap">{rateResult.response}</pre>
              </div>
            </div>
          </div>
        )}
      </ExploitPanel>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${statusFilter === tab ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-400 text-center py-12 animate-pulse">Loading jobs…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredJobs.map(job => (
            <div key={job.id} className="bg-slate-800 rounded-lg border border-slate-700 p-5">
              <div className="flex justify-between items-start mb-2 gap-2">
                <h3 className="font-bold text-white">{job.title}</h3>
                <span className={`text-xs px-2 py-1 rounded border capitalize whitespace-nowrap ${STATUS_COLORS[job.status] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                  {job.status.toUpperCase()}
                </span>
              </div>
              <p className="text-slate-400 text-sm line-clamp-2 mb-3">{job.description}</p>
              <div className="text-sm text-slate-300 mb-1">
                {SPECIALTY_ICONS[job.required_specialty] ?? '🔩'} {job.required_specialty}
              </div>
              <div className="text-xs text-slate-500 mb-1">
                Property: {job.property_id ? job.property_id.substring(0, 18) + '…' : 'N/A'}
              </div>
              <div className="text-xs text-slate-500 mb-2">
                {job.assigned_contractor_id
                  ? `Assigned to: ${job.assigned_contractor_id.substring(0, 18)}…`
                  : 'Unassigned'}
              </div>
              <div className="text-xs text-slate-600 font-mono">ID: {job.id.substring(0, 18)}…</div>
            </div>
          ))}
          {filteredJobs.length === 0 && (
            <div className="col-span-2 text-slate-400 text-center py-12">No jobs found</div>
          )}
        </div>
      )}
    </div>
  );
}