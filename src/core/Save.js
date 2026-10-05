// Guardado en localStorage (tolerante a navegadores sin almacenamiento).
const KEY = 'newrol.save.v1';

export const Save = {
  load() {
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  },
  write(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
  },
  clear() { try { localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ } },
};
