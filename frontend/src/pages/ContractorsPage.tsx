import { useState, useEffect } from 'react';
import axios from 'axios';
import { getToken } from '../api/auth';
import { exploitMassAssignment } from '../api/exploits';
import VulnExploitPanel from '../components/VulnExploitPanel';

interface Contractor {
  id: string;
  company_name: string;
  specialty: string;
  hourly_rate: number;
  is_verified: boolean;
  rating: number;
}

const SPECIALTY_ICONS: Record<string, string> = {
  plumbing: '🔧',
  electrical: '⚡',
  roofing: '🏠',
};

const SPECIALTY_LABELS: Record<string, string> = {
  '': 'All',
  plumbing: '🔧 Plumbing',
  electrical: '⚡ Electrical',
  roofing: '🏠 Roofing',
};

function StarRating({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="text-yellow-400">
      {'★'.repeat(full)}{'☆'.repeat(Math.max(0, 5 - full))}
      <span className="text-slate-400 text-xs ml-1">{rating?.toFixed(1)}</span>
    </span>
  );
}

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [specialty, setSpecialty] = useState('');
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const token = await getToken('alice');
        const url = specialty ? `/api/contractors?specialty=${specialty}` : '/api/contractors';
        const r = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        setContractors((r.data.data ?? []).map((c: any) => ({
          ...c,
          hourly_rate: parseFloat(c.hourly_rate),
          rating: parseFloat(c.rating),
        })));
      } catch {
        setContractors([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [specialty]);

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">🔧 Contractors Marketplace</h1>

      {/* VULN-3 Demo Panel */}
      <VulnExploitPanel
        vulnId={3}
        severity="high"
        owasp="API3:2023 — Excessive Data Exposure / Mass Assignment"
        title="Mass Assignment — Contractor Self-Elevates to Admin"
        narrative={`Charlie is a contractor registered on PropTracker. When updating his own profile via PUT /api/contractors/:id, he includes extra fields in the request body: role: "admin" and isVerified: true. Because the API blindly spreads the entire request body onto the database update (Object.assign), those sensitive fields are written directly — giving Charlie admin privileges and verified status he was never granted.`}
        howGitHubCatches={`The check-mass-assignment.yml workflow runs on every push and pull request. It logs in as Charlie, sends a crafted PUT request with role: "admin" and isVerified: true, then inspects the response body. If role or isVerified appear with the injected values, the workflow fails with ::error:: VULN-3 CONFIRMED — Mass Assignment Detected and blocks the PR. Copilot then suggests replacing Object.assign(contractor, req.body) with an explicit allowlist of safe fields (company_name, specialty, hourly_rate), so sensitive fields are never touched by user input.`}
        endpoint="PUT /api/contractors/:id"
        workflowFile="check-mass-assignment.yml"
        fix="Replace Object.assign(contractor, req.body) with explicit field allowlist: { company_name, specialty, hourly_rate } only."
        runExploit={exploitMassAssignment}
      />

      {/* Specialty filter */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {Object.entries(SPECIALTY_LABELS).map(([key, label]) => (
          <button
            key={key}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${specialty === key ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            onClick={() => setSpecialty(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-400 text-center py-12 animate-pulse">Loading contractors…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {contractors.map(c => (
            <div key={c.id} className="bg-slate-800 rounded-lg border border-slate-700 p-5">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-white">{c.company_name}</h3>
                {c.is_verified
                  ? <span className="text-xs bg-green-900 text-green-300 border border-green-700 px-2 py-1 rounded">✓ VERIFIED</span>
                  : <span className="text-xs bg-slate-700 text-slate-400 border border-slate-600 px-2 py-1 rounded">✗ UNVERIFIED</span>
                }
              </div>
              <div className="text-slate-300 text-sm mb-3">
                {SPECIALTY_ICONS[c.specialty] ?? '🔩'} {c.specialty.charAt(0).toUpperCase() + c.specialty.slice(1)}
              </div>
              <div className="flex justify-between items-center text-sm mb-2">
                <StarRating rating={c.rating} />
                <span className="text-green-400 font-semibold">${c.hourly_rate}/hr</span>
              </div>
              <div className="text-xs text-slate-500 font-mono">ID: {c.id.substring(0, 18)}…</div>
            </div>
          ))}
          {contractors.length === 0 && (
            <div className="col-span-3 text-slate-400 text-center py-12">No contractors found</div>
          )}
        </div>
      )}
    </div>
  );
}