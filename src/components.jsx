import { useEffect, useRef } from 'react';
import { X, ChevronRight, CalendarDays } from 'lucide-react';
import { useStore } from './store';
export function Button({ children, variant = '', className = '', ...props }) { return <button className={`button ${variant} ${className}`} {...props}>{children}</button>; }
export function Badge({ children, tone = '' }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function Avatar({ name, index = 0 }) { return <span className={`avatar color-${index % 4}`}>{name?.slice(0, 1)}</span>; }
export function Empty({ title = '这里还没有内容', text = '新的记录会出现在这里。' }) { return <div className="empty"><CalendarDays size={30}/><h3>{title}</h3><p>{text}</p></div>; }
export function Field({ label, children, hint }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
export function Modal({ title, children, onClose }) {
  const ref = useRef();
  useEffect(() => { const previous = document.activeElement; ref.current.showModal(); return () => { ref.current?.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) onClose(); }} className="modal"><div className="modal-header"><h2>{title}</h2><button className="icon-button" aria-label="关闭弹窗" onClick={onClose}><X size={20}/></button></div>{children}</dialog>;
}
export function BookingRows({ bookings, onEdit }) {
  const { workspace: w } = useStore();
  return bookings.length ? <div className="booking-rows">{bookings.map((b, i) => { const c = w.customers.find(x => x.id === b.customerId); const s = w.services.find(x => x.id === b.serviceId); return <button className="booking-row" key={b.id} onClick={() => onEdit(b)}><span className="booking-time">{b.time}</span><Avatar name={c?.name} index={i}/><span className="booking-info"><strong>{c?.name}</strong><span>{s?.name}</span><small>{c?.detail} · {s?.duration} 分钟</small></span><Badge tone={b.status === '已完成' ? 'green' : b.status === '待确认' ? 'amber' : b.status === '已取消' ? 'gray' : 'blue'}>{b.status}</Badge><ChevronRight size={17}/></button>; })}</div> : <Empty title="这一天还没有安排" text="点击新增预约，为客户安排一个时间。"/>;
}
