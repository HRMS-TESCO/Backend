/**
 * Allowance routes — proxy to the Tesco ERM mobile backend.
 *
 * Employees submit petrol/travel allowance requests from the mobile app,
 * which stores them in the mobile backend's MongoDB. The HRMS web app
 * forwards the request via this proxy and reshapes the response into the
 * exact field shape the existing HRMS Allowance.jsx page expects:
 *
 *   { id, empName, from, to, distance, amount, status, date }
 *
 * The HRMS frontend doesn't change UI — only its data source flips from
 * hardcoded mock arrays to this endpoint.
 *
 * Required env vars on the HRMS backend (.env):
 *   MOBILE_API_URL        e.g. https://backend-emqy.onrender.com
 *   MOBILE_ADMIN_SECRET   same value as ADMIN_SECRET on the mobile backend
 */

const express = require('express');
const router  = express.Router();

const MOBILE_API      = (process.env.MOBILE_API_URL    || 'https://backend-emqy.onrender.com').replace(/\/+$/, '');
const ADMIN_SECRET    =  process.env.MOBILE_ADMIN_SECRET || '';
const FETCH_TIMEOUT_MS = 30_000;

/* ─── Helpers ───────────────────────────────────────────────────────── */
function titleCaseStatus(s) {
  if (!s) return 'Pending';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
function shortId(_id, type) {
  const prefix = type === 'petrol' ? 'REQ' : 'TRV';
  return `${prefix}-${String(_id).slice(-6).toUpperCase()}`;
}

/**
 * Reshape a mobile allowance document into the HRMS Allowance.jsx shape.
 * The mobile doc has more fields (purpose, transport, notes, hrComment,
 * etc.) — we surface the ones the UI uses today and tack the rest under
 * `extras` in case the page wants them later.
 */
function reshape(a) {
  const dateStr = a.date
    ? (typeof a.date === 'string' ? a.date : new Date(a.date).toISOString().split('T')[0])
    : '';
  return {
    _id:      a._id,                          // real mongo id (used by PATCH)
    id:       shortId(a._id, a.type),         // visible short id, e.g. REQ-ABC123
    empName:  a.user?.name || '—',
    from:     a.fromLocation || '',
    to:       a.toLocation   || '',
    distance: Number(a.distance) || 0,
    amount:   Number(a.amount)   || 0,
    status:   titleCaseStatus(a.status),      // Pending / Approved / Rejected
    date:     dateStr,
    // Useful extras the HRMS page may want later
    type:     a.type,                         // 'petrol' | 'travel'
    purpose:  a.purpose   || '',
    transport:a.transport || '',
    notes:    a.notes     || '',
    employee: {
      userId:      a.user?.userId      || '',
      email:       a.user?.email       || '',
      designation: a.user?.designation || '',
    },
    hrComment:  a.hrComment  || '',
    reviewedAt: a.reviewedAt || null,
    createdAt:  a.createdAt  || null,
  };
}

function configReady(res) {
  if (!ADMIN_SECRET) {
    res.status(503).json({
      success: false,
      message: 'MOBILE_ADMIN_SECRET is not configured on the HRMS server. ' +
               'Set it in .env to enable mobile allowance sync.',
    });
    return false;
  }
  return true;
}

async function fwd(path, init = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('global fetch is not available — Node 18+ required.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(MOBILE_API + path, {
      ...init,
      signal:  controller.signal,
      headers: {
        ...(init.headers || {}),
        'x-admin-secret': ADMIN_SECRET,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /api/allowances
 *   ?type=petrol|travel          (optional — filters single bucket)
 *   ?status=pending|approved|rejected
 *
 * Returns { petrol: [...], travel: [...] } so the HRMS UI can split the
 * two tabs without filtering client-side. Each list is already in the
 * shape the existing page expects.
 */
router.get('/', async (req, res) => {
  if (!configReady(res)) return;
  try {
    const q = new URLSearchParams();
    if (req.query.type)   q.set('type',   req.query.type);
    if (req.query.status) q.set('status', req.query.status);
    if (req.query.limit)  q.set('limit',  req.query.limit);
    const qs = q.toString() ? `?${q.toString()}` : '';

    const r    = await fwd(`/api/allowance/admin/all${qs}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({
        success: false,
        message: data?.message || `Mobile API responded ${r.status}`,
      });
    }
    const reshaped = (Array.isArray(data.items) ? data.items : []).map(reshape);
    const petrol = reshaped.filter((x) => x.type === 'petrol');
    const travel = reshaped.filter((x) => x.type === 'travel');
    res.json({
      success: true,
      petrol,
      travel,
      summary: data.summary || {},
      total:   reshaped.length,
    });
  } catch (err) {
    console.error('[allowance proxy GET]', err.message);
    res.status(502).json({
      success: false,
      message: 'Could not reach the mobile backend. ' + err.message,
    });
  }
});

/**
 * PATCH /api/allowances/:id
 * Body: { status, hrComment?, reviewedBy? }
 * Forwards to PATCH /api/allowance/admin/:id which also notifies the
 * employee in the mobile app.
 */
router.patch('/:id', async (req, res) => {
  if (!configReady(res)) return;
  try {
    const body = req.body || {};
    const payload = {};
    if (body.status     !== undefined) payload.status     = String(body.status).toLowerCase();
    if (body.hrComment  !== undefined) payload.hrComment  = String(body.hrComment);
    if (body.reviewedBy !== undefined) payload.reviewedBy = String(body.reviewedBy);

    const r = await fwd(`/api/allowance/admin/${encodeURIComponent(req.params.id)}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({
        success: false,
        message: data?.message || `Mobile API responded ${r.status}`,
      });
    }
    res.json({
      success: true,
      allowance: data.allowance ? reshape(data.allowance) : null,
    });
  } catch (err) {
    console.error('[allowance proxy PATCH]', err.message);
    res.status(502).json({
      success: false,
      message: 'Could not reach the mobile backend. ' + err.message,
    });
  }
});

module.exports = router;
