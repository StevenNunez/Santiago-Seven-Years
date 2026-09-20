/* Imported by the generated PWA worker. No invitation tokens in push payloads. */
const pushStore = async (write) => {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('santiago-push', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('settings');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('settings', write ? 'readwrite' : 'readonly');
    const store = transaction.objectStore('settings');
    const request = write ? store.put(write, 'state') : store.get('state');
    transaction.oncomplete = () => { database.close(); resolve(write || request.result || { count: 0, path: '/' }); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
};
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let message = {};
    try { message = event.data?.json() || {}; } catch { /* Always show a visible notification. */ }
    await self.registration.showNotification(message.title || 'Santiago · Nivel 7', {
      body: message.body || 'Tienes un recordatorio del cumpleaños.', icon: '/icon-192.png',
      badge: '/icon-192.png', tag: message.key || 'santiago-reminder', data: { path: '/' },
    });
    try {
      const state = await pushStore();
      state.count = (state.count || 0) + 1;
      await pushStore(state);
      if (self.navigator.setAppBadge) await self.navigator.setAppBadge(state.count);
    } catch { /* Badge availability does not affect delivery. */ }
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'SANTIAGO_OPEN') return;
  event.waitUntil((async () => {
    const url = new URL(event.data.path || '/', self.location.origin);
    if (url.origin !== self.location.origin) return;
    const previous = await pushStore();
    await pushStore({ count: 0, path: url.searchParams.has('invite') ? url.pathname + url.search : previous.path || '/' });
    if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
    const notifications = await self.registration.getNotifications();
    notifications.forEach(notification => notification.close());
  })().catch(() => {}));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const state = await pushStore().catch(() => ({ path: '/' }));
    await pushStore({ ...state, count: 0 }).catch(() => {});
    if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge().catch(() => {});
    const url = new URL(state.path || '/', self.location.origin);
    if (url.origin !== self.location.origin) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).pathname + new URL(client.url).search === url.pathname + url.search);
    if (existing) await existing.focus();
    else await self.clients.openWindow(url.href);
  })());
});
