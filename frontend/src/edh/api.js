// Small fetch helper for the ED-H1 backend.
// RECONSTRUCTED from how the screens call it (api.get/post/put/del) - replace with your original if you have it.
// In dev (Vite on 5173/5174) the backend is on 127.0.0.1:8000; when ED-H1 is served by the backend itself, use the same origin.
const DEV_PORTS = ['5173', '5174'];
const BASE = DEV_PORTS.includes(window.location.port) ? 'http://127.0.0.1:8000' : '';

async function request(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${BASE}${path}`, opts);
  } catch (e) {
    throw new Error('Cannot reach ED-H1. Is it still running?');
  }
  let data = null;
  try { data = await res.json(); } catch (_) { /* empty or non-JSON body */ }
  if (!res.ok) {
    const d = data && data.detail;
    const msg = typeof d === 'string' ? d
      : Array.isArray(d) ? d.map((x) => x.msg || JSON.stringify(x)).join('; ')
      : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body === undefined ? {} : body),
  put: (path, body) => request('PUT', path, body === undefined ? {} : body),
  del: (path) => request('DELETE', path),
};
