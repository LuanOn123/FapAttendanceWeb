import { portalCall } from './api.js';
import { auth } from '../firebase.js';

const vapidKey = import.meta.env.VITE_GROUP_PUSH_VAPID_KEY;
export const groupPushConfigured = !!vapidKey;
const preference = uid => `group-push:${uid}`;
let active;

export function wantsGroupPush(uid) {
  try { return groupPushConfigured && localStorage.getItem(preference(uid)) === 'on'; }
  catch { return false; }
}

async function waitForActiveWorker(registration) {
  const worker = registration.active || registration.installing || registration.waiting;
  if (!worker) throw new Error('Chưa khởi động được trình nhận thông báo.');
  await new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timeout);
      worker.removeEventListener('statechange', check);
      if (error) reject(error);
      else resolve();
    };
    const check = () => {
      if (worker.state === 'activated') finish();
      else if (worker.state === 'redundant') finish(new Error('Trình nhận thông báo chưa hoạt động.'));
    };
    const timeout = setTimeout(() => finish(new Error('Trình nhận thông báo khởi động quá lâu.')), 10000);
    worker.addEventListener('statechange', check);
    check();
  });
}

export async function enableGroupPush(uid, { ask = false } = {}) {
  if (!groupPushConfigured || !('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('Trình duyệt hoặc môi trường này chưa hỗ trợ thông báo chat.');
  }
  const permission = ask && Notification.permission === 'default'
    ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') throw new Error('Hãy cho phép trang web gửi thông báo.');
  if (active?.uid === uid) return;
  const sdk = await import('firebase/messaging');
  if (!await sdk.isSupported()) throw new Error('Trình duyệt này chưa hỗ trợ Firebase Messaging.');
  const { default: worker } = await import('../groupPushWorker.js?worker&url');
  const registration = await navigator.serviceWorker.register(worker, { type: 'module' });
  await waitForActiveWorker(registration);
  const messaging = sdk.getMessaging();
  const token = await sdk.getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token || auth.currentUser?.uid !== uid) throw new Error('Phiên đăng nhập đã thay đổi. Hãy thử lại.');
  await portalCall('registerGroupPushDevice', { platform: 'web', token });
  if (auth.currentUser?.uid !== uid) return;
  active?.unsubscribe();
  active = { uid, token, messaging, deleteToken: sdk.deleteToken,
    unsubscribe: sdk.onMessage(messaging, ({ data }) => {
      if (data?.screen === 'group-chat' && data.recipientUid === auth.currentUser?.uid) {
        window.dispatchEvent(new CustomEvent('fap-group-push', { detail: data }));
      }
    }),
  };
  try { localStorage.setItem(preference(uid), 'on'); } catch {}
}

export async function disableGroupPush(uid) {
  try { localStorage.removeItem(preference(uid)); } catch {}
  if (active?.uid !== uid) return;
  const device = active;
  active = undefined;
  device.unsubscribe();
  await Promise.allSettled([
    portalCall('unregisterGroupPushDevice', { platform: 'web', token: device.token }),
    device.deleteToken(device.messaging),
  ]);
}
