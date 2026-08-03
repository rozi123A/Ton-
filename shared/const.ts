export const COOKIE_NAME = "app_session_id";
// Browser storage key for the signed guest session that lets the same device
// restore its guest account after the normal session cookie is cleared.
export const GUEST_TOKEN_KEY = "guest_token";
export const GUEST_SESSION_ACTIVE_KEY = "guest_session_active";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
