document.addEventListener('DOMContentLoaded', () => {
  const trigger = document.getElementById('auth-bypass-trigger');
  const panel = document.getElementById('auth-bypass-panel');
  if (trigger && panel) {
    trigger.addEventListener('click', () => panel.classList.toggle('hidden'));
  }
});
