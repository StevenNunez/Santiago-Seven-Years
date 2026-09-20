export function registerPushBadgeReset() {
  if (!('serviceWorker' in navigator)) return;
  const reset = () => {
    if (document.visibilityState !== 'visible') return;
    void navigator.serviceWorker.ready.then(registration => registration.active?.postMessage({ type: 'SANTIAGO_OPEN', path: location.pathname + location.search })).catch(() => {});
  };
  reset();
  document.addEventListener('visibilitychange', reset);
}
