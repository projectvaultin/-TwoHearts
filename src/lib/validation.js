export const usernamePattern=/^[A-Za-z0-9_]{3,30}$/;
export function assertUsername(v){ if(!usernamePattern.test(v)) throw new Error('Invalid username'); return v; }
