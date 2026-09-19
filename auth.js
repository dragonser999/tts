// ===== Google Sign-In handling =====
window.currentUser = null;

document.addEventListener('DOMContentLoaded', checkExistingSession);
window.addEventListener('load', initGoogleButton);

function initGoogleButton(retries = 20) {
  if (!window.google || !window.google.accounts || !window.GOOGLE_CLIENT_ID) {
    if (retries > 0) return setTimeout(() => initGoogleButton(retries - 1), 250);
    document.getElementById('authError').textContent =
      'Google Sign-In unavailable (missing GOOGLE_CLIENT_ID or blocked script).';
    document.getElementById('authError').classList.remove('hidden');
    return;
  }
  google.accounts.id.initialize({
    client_id: window.GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential
  });
  google.accounts.id.renderButton(
    document.getElementById('googleBtnContainer'),
    { theme: 'filled_black', size: 'large', type: 'standard' }
  );
}

async function checkExistingSession() {
  try {
    const res = await fetch('/auth/me');
    const data = await res.json();
    if (data.user) {
      window.currentUser = data.user;
      window.showLobbyScreen(data.user);
    }
  } catch (err) {
    console.warn('Session check failed', err);
  }
}

// called by Google Identity Services after a successful sign-in
async function handleGoogleCredential(response) {
  const authError = document.getElementById('authError');
  authError.classList.add('hidden');
  try {
    const res = await fetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Sign-in failed');
    window.currentUser = data.user;
    window.showLobbyScreen(data.user);
  } catch (err) {
    authError.textContent = 'Google sign-in failed: ' + err.message;
    authError.classList.remove('hidden');
  }
}
window.handleGoogleCredential = handleGoogleCredential;

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await fetch('/auth/logout', { method: 'POST' });
  window.currentUser = null;
  window.socket?.emit('leave-room');
  window.showLoginScreen();
});
