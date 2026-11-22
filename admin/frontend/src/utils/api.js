export function parseApiError(resp) {
  const msg = resp?.json?.error?.message || resp?.json?.message;
  if (msg) return String(msg);
  return "Something went wrong. Please try again.";
}

