import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { makeWorkspace, templates, uid } from './data';
const Context = createContext(null);
const KEY = 'little-shop-demo-v1';
function initial() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.schema === 1 && templates[s.industry] && s.workspaces?.[s.industry]?.bookings) return s; } catch { /* Fresh workspace if browser data is unavailable. */ }
  return { schema: 1, industry: 'auto', workspaces: { auto: makeWorkspace('auto') } };
}
export function Store({ children }) {
  const [state, setState] = useState(initial);
  const [toast, setToast] = useState('');
  const [storageError, setStorageError] = useState(false);
  const timer = useRef();
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); setStorageError(false); } catch { setStorageError(true); } }, [state]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const notify = text => { setToast(text); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 3800); };
  const update = (fn, action) => setState(s => { const w = structuredClone(s.workspaces[s.industry]); fn(w); if (action) w.logs.unshift({ id: uid(), action, date: new Date().toISOString() }); w.logs = w.logs.slice(0, 100); return { ...s, workspaces: { ...s.workspaces, [s.industry]: w } }; });
  const switchIndustry = industry => { setState(s => ({ ...s, industry, workspaces: { ...s.workspaces, [industry]: s.workspaces[industry] || makeWorkspace(industry) } })); notify(`已切换至${templates[industry].label}演示，原行业数据已保留`); };
  return <Context.Provider value={{ workspace: state.workspaces[state.industry], industry: state.industry, template: templates[state.industry], update, switchIndustry, notify, toast, storageError }}>{children}</Context.Provider>;
}
export const useStore = () => useContext(Context);
