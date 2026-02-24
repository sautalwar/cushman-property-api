import { useState, useEffect } from 'react';
import axios from 'axios';
import { getToken } from '../api/auth';
import { exploitSQLInjection, exploitPaginationAbuse } from '../api/exploits';
import VulnExploitPanel from '../components/VulnExploitPanel';

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  property_type: string;
  square_feet: number;
  monthly_rent: number;
  owner_id?: string;
}

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  commercial_office:     { label: 'Office',     icon: '🏢' },
  commercial_retail:     { label: 'Retail',     icon: '🛍️' },
  commercial_industrial: { label: 'Industrial', icon: '🏭' },
  residential:           { label: 'Residential', icon: '🏠' },
};

const FILTER_TYPES = ['All', 'commercial_office', 'commercial_retail', 'commercial_industrial', 'residential'];

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const token = await getToken('alice');
        const r = await axios.get('/api/properties', { headers: { Authorization: `Bearer ${token}` } });
        setProperties(r.data.data ?? []);
      } catch {
        setProperties([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const displayed = filter === 'All'
    ? properties
    : properties.filter(p => p.property_type === filter);

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">🏢 Properties</h1>

      {/* VULN-8 — SQL Injection */}
      <VulnExploitPanel
        vulnId={8}
        severity="critical"
        owasp="API8:2023 — Security Misconfiguration / Injection"
        title="SQL Injection — Bypass Property Search Authorization"
        narrative={`The property search endpoint (GET /api/properties/search?q=) builds its SQL query by concatenating the user-supplied search term directly into the query string: "SELECT * FROM properties WHERE name LIKE '%" + q + "%'". An attacker sends q=' OR 1=1 -- which closes the LIKE clause early and adds a tautology, causing the database to return ALL properties — including those owned by other users — bypassing row-level access control entirely.`}
        howGitHubCatches={`The check-sql-injection.yml workflow runs on every push and pull request targeting the main branch. It calls GET /api/properties/search with q=' OR 1=1 -- and compares the number of rows returned against a safe baseline count. If the response contains more rows than a logged-in user should see, the workflow fails with ::error:: VULN-8 CONFIRMED — SQL Injection Detected and blocks the PR from merging. Copilot then suggests replacing the string concatenation with a parameterized query: WHERE name ILIKE $1 with parameter ['%' + q + '%'].`}
        endpoint="GET /api/properties/search?q="
        workflowFile="check-sql-injection.yml"
        fix="Use parameterized query: WHERE name ILIKE $1 with value ['%' + q + '%']. Never concatenate user input into SQL strings."
        runExploit={exploitSQLInjection}
        isExpanded={activePanel === 8}
        onExpand={() => setActivePanel(8)}
        onCollapse={() => setActivePanel(null)}
      />

      {/* VULN-5 — Pagination Abuse */}
      <VulnExploitPanel
        vulnId={5}
        severity="medium"
        owasp="API4:2023 — Unrestricted Resource Consumption"
        title="Pagination Abuse — Uncapped limit Dumps Entire Database"
        narrative={`GET /api/properties accepts ?limit= and ?offset= query parameters for pagination. The API passes the limit value directly to the SQL LIMIT clause with no maximum cap. An attacker sends limit=99999 and retrieves every property record in a single response — bypassing pagination and potentially exfiltrating the entire properties table. This can also cause severe database and memory load on the server, constituting a denial of service.`}
        howGitHubCatches={`The check-pagination-abuse.yml workflow sends GET /api/properties?limit=99999 and checks if the response count exceeds a reasonable page threshold (e.g., 100). If so, it fails with ::error:: VULN-5 CONFIRMED — Pagination Abuse Detected, blocking the pull request. Copilot then suggests adding const safeLimit = Math.min(parseInt(limit) || 20, 100) before the query to cap the page size at 100 records regardless of what the caller requests.`}
        endpoint="GET /api/properties?limit=99999"
        workflowFile="check-pagination-abuse.yml"
        fix="Add const safeLimit = Math.min(parseInt(limit) || 20, 100) before the query to cap maximum page size."
        runExploit={exploitPaginationAbuse}
        isExpanded={activePanel === 5}
        onExpand={() => setActivePanel(5)}
        onCollapse={() => setActivePanel(null)}
      />

      {/* Filter buttons */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTER_TYPES.map(type => {
          const info = TYPE_LABELS[type];
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${filter === type ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              {info ? `${info.icon} ${info.label}` : 'All'}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-slate-400 text-center py-12 animate-pulse">Loading properties…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayed.map(p => {
            const typeInfo = TYPE_LABELS[p.property_type] ?? { label: p.property_type, icon: '🏗️' };
            return (
              <div key={p.id} className="bg-slate-800 rounded-lg border border-slate-700 p-5">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <h3 className="font-bold text-white">{p.name}</h3>
                  <span className="text-xs bg-blue-900 text-blue-300 border border-blue-700 px-2 py-1 rounded whitespace-nowrap">
                    {typeInfo.icon} {typeInfo.label}
                  </span>
                </div>
                <p className="text-slate-400 text-sm mb-3">{p.address}, {p.city}, {p.state}</p>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">{p.square_feet?.toLocaleString()} sq ft</span>
                  <span className="text-green-400 font-semibold">${p.monthly_rent?.toLocaleString()}/mo</span>
                </div>
                {p.owner_id && (
                  <div className="text-xs text-slate-500 font-mono">Owner: {p.owner_id.substring(0, 18)}…</div>
                )}
              </div>
            );
          })}
          {displayed.length === 0 && (
            <div className="col-span-3 text-slate-400 text-center py-12">No properties found</div>
          )}
        </div>
      )}
    </div>
  );
}