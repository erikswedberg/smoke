// Ambient data store. The normalized rankings dataset is large and immutable,
// so it lives here (not in component attributes/DOM). Components pull it on
// connect via whenData(); interactive UI state still flows through the
// component tree via props-down / events-up.

const waiters = new Set();

export function setData(data) {
  window.Smoke = window.Smoke || {};
  window.Smoke.data = data;
  for (const cb of waiters) cb(data);
  waiters.clear();
}

export function whenData(cb) {
  if (window.Smoke?.data) cb(window.Smoke.data);
  else waiters.add(cb);
}
