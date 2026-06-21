document.addEventListener('DOMContentLoaded', () => {
  const trigger = document.getElementById('auth-bypass-trigger');
  const panel = document.getElementById('auth-bypass-panel');
  const bypassInput = document.getElementById('bypass-key-input');
  const bypassSubmit = document.getElementById('bypass-submit');
  const bypassCancel = document.getElementById('bypass-cancel');
  const bypassError = document.getElementById('bypass-error');

  if (trigger && panel) {
    trigger.addEventListener('click', () => {
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) {
        if (bypassError) bypassError.classList.add('hidden');
      }
    });
  }

  async function handleBypass() {
    const raw = (bypassInput && bypassInput.value || '').trim();
    if (!raw) {
      if (bypassError) {
        bypassError.textContent = 'Enter your bypass key.';
        bypassError.classList.remove('hidden');
      }
      return;
    }

    let k1Addr = null;
    let token = raw;

    try {
      const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
      if (decoded && typeof decoded.k1 === 'string') {
        k1Addr = decoded.k1;
      }
    } catch (_) {
      // not base64url JSON; use raw as token directly
    }

    const body = {};
    if (k1Addr) {
      body.k1Addr = k1Addr;
      body.token = raw;
    } else {
      body.token = raw;
    }

    try {
      const res = await fetch('/api/bypass-verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        if (bypassError) bypassError.classList.add('hidden');
        panel.classList.add('hidden');
        if (bypassInput) bypassInput.value = '';
        try { sessionStorage.setItem('sg_bypass_passed', '1'); } catch (_) {}
      } else {
        const msg = data.error || 'Bypass rejected.';
        if (bypassError) {
          bypassError.textContent = msg;
          bypassError.classList.remove('hidden');
        }
      }
    } catch (e) {
      if (bypassError) {
        bypassError.textContent = 'Verification failed.';
        bypassError.classList.remove('hidden');
      }
    }
  }

  if (bypassSubmit) bypassSubmit.addEventListener('click', handleBypass);
  if (bypassInput) {
    bypassInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleBypass();
    });
  }
  if (bypassCancel) {
    bypassCancel.addEventListener('click', () => {
      panel.classList.add('hidden');
      if (bypassError) bypassError.classList.add('hidden');
    });
  }
});
