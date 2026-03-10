let _pendingEmail = null;

export const setPendingAutofillEmail = (email) => {
  _pendingEmail = email;
  // Also write to sessionStorage as a fallback for page refreshes
  try {
    sessionStorage.setItem("autofillEmail", email);
  } catch {}
};

export const consumePendingAutofillEmail = () => {
  // Try in-memory first (most reliable, no timing issues)
  const email = _pendingEmail || sessionStorage.getItem("autofillEmail");
  // Clear both sources
  _pendingEmail = null;
  try {
    sessionStorage.removeItem("autofillEmail");
  } catch {}
  return email || null;
};
