'use strict';
/* Lemon Squeezy license API response parsing.
 *
 * Verified live against the real license API 2026-09-29:
 *   POST /v1/licenses/activate -> { activated: true, license_key: {...}, instance: { id }, meta }
 *   POST /v1/licenses/validate -> { valid: true, license_key: {...}, instance: { id }, meta }
 *   POST /v1/licenses/deactivate -> { deactivated: true, ... }
 * This is NOT the REST-API resource shape ({ data: { attributes } }) —
 * parsing that shape here was the bug fixed 2026-09-29.
 */

function parseActivateResponse(body) {
  const b = body || {};
  const instanceId = b.instance && b.instance.id;
  return { valid: b.activated === true || !!instanceId, instanceId: instanceId || null };
}

function parseValidateResponse(body) {
  const b = body || {};
  const instanceId = b.instance && b.instance.id;
  return { valid: b.valid === true || !!instanceId };
}

function parseDeactivateResponse(body) {
  const b = body || {};
  return { deactivated: b.deactivated === true };
}

module.exports = { parseActivateResponse, parseValidateResponse, parseDeactivateResponse };
