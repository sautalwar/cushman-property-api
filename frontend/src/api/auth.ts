import axios from 'axios';

const tokenCache: Record<string, string> = {};

export const SEED_USERS = {
  alice:   { email: 'alice@propowner.com',   password: 'Password123!' },
  bob:     { email: 'bob@propowner.com',     password: 'Password123!' },
  charlie: { email: 'charlie@plumbing.com',  password: 'Password123!' },
  diana:   { email: 'diana@electric.com',    password: 'Password123!' },
};

export async function getToken(user: keyof typeof SEED_USERS): Promise<string> {
  if (tokenCache[user]) return tokenCache[user];
  const r = await axios.post('/api/auth/login', SEED_USERS[user]);
  tokenCache[user] = r.data.data.token;
  return tokenCache[user];
}

export function clearTokens() {
  Object.keys(tokenCache).forEach(k => delete tokenCache[k]);
}

// Build an expired JWT (no valid signature — just for the broken auth demo)
export function makeExpiredJwt(): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({
    userId: '11111111-0000-0000-0000-000000000001',
    role: 'admin',
    iat: now - 7200,
    exp: now - 3600,
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${payload}.invalid-sig`;
}
