import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, CalendarDays, List } from 'lucide-react';
import { useStore } from './store';
import { TODAY, uid, bookingConflict, minutes } from './data';
import { Button, Field, Modal, BookingRows } from './components';
export function BookingModal({ booking, customerId, onClose }) {
  const { workspace: w, template, update, notify } = useStore();
  const [form, setForm] = useState(booking || { customerId: customerId || '', serviceId: w.services[0].id, date: TODAY, time: '09:00', staff: 'Mei', status: '已确认', notes: '' });
  const [customer, setCustomer] = useState({ name: '', phone: '', detail: '' });
  const [error, setError] = useState('');
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  function save(e) {
    e.preventDefault();
    if (!form.customerId && (!customer.name.trim() || !/^\+?[\d\s()-]{7,20}$/.test(customer.phone))) return setError('请填写客户姓名和有效电话号码。');
    const duration = w.services.find(s => s.id === form.serviceId).duration;
    const [open, close] = w.shop.hours.split('–');
    if (minutes(form.time) < minutes(open) || minutes(form.time) + duration > minutes(close)) return setError(`服务必须在营业时间 ${w.shop.hours} 内完成。`);
    if (bookingConflict(w, form)) return setError(`${form.staff} 在这个时段已有安排，请选择其他时间或员工。`);
    const normalized = customer.phone.replace(/[^\d+]/g, '');
    const existing = !form.customerId && w.customers.find(c => c.phone.replace(/[^\d+]/g, '') === normalized);
    const id = form.customerId || existing?.id || uid();
    const record = { ...form, id: booking?.id || uid(), customerId: id };
    if (w.bookings.some(b => b.id !== record.id && b.customerId === id && b.date === record.date && b.time === record.time && b.status !== '已取消' && record.status !== '已取消')) return setError('这位客户在这个时间已经有预约。');
    update(d => { if (!form.customerId && !existing) d.customers.push({ ...customer, phone: normalized, name: customer.name.trim(), id }); const i = d.bookings.findIndex(b => b.id === record.id); if (i >= 0) d.bookings[i] = record; else d.bookings.push(record); }, `${booking ? '更新' : '新增'}预约 · ${form.date} ${form.time}`);
    notify(booking ? '预约已更新' : '演示预约已建立'); onClose();
  }
  return <Modal title={booking ? `编辑${template.noun}` : `新增${template.noun}`} onClose={onClose}><form onSubmit={save} className="modal-form"><Field label="客户"><select value={form.customerId} onChange={e => set('customerId', e.target.value)}><option value="">＋ 新客户</option>{w.customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></Field>{!form.customerId && <><div className="form-grid"><Field label="客户姓名"><input required value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })}/></Field><Field label="电话号码"><input required type="tel" placeholder="+60 12 345 6789" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })}/></Field></div><Field label={template.field}><input value={customer.detail} onChange={e => setCustomer({ ...customer, detail: e.target.value })}/></Field></>}
    <Field label="服务项目"><select value={form.serviceId} onChange={e => set('serviceId', e.target.value)}>{w.services.map(s => <option key={s.id} value={s.id}>{s.name} · {s.duration} 分钟</option>)}</select></Field><div className="form-grid"><Field label="日期"><input type="date" required value={form.date} onChange={e => set('date', e.target.value)}/></Field><Field label="时间"><input type="time" required step="900" value={form.time} onChange={e => set('time', e.target.value)}/></Field><Field label="负责人"><select value={form.staff} onChange={e => set('staff', e.target.value)}>{w.staff.map(u => <option key={u.id}>{u.name}</option>)}</select></Field><Field label="状态"><select value={form.status} onChange={e => set('status', e.target.value)}>{['待确认', '已确认', '已完成', '已取消'].map(s => <option key={s}>{s}</option>)}</select></Field></div><Field label="备注"><textarea rows="2" value={form.notes} onChange={e => set('notes', e.target.value)}/></Field>{error && <p className="error" role="alert">{error}</p>}<div className="modal-actions"><Button type="button" onClick={onClose}>取消</Button><Button variant="primary">保存预约</Button></div></form></Modal>;
}
export default function Bookings({ onEdit, onNew }) {
  const { workspace: w, template } = useStore();
  const [date, setDate] = useState(TODAY);
  const [view, setView] = useState('day');
  const [status, setStatus] = useState('全部状态');
  const rows = w.bookings.filter(b => (view === 'all' || b.date === date) && (status === '全部状态' || b.status === status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const shift = n => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + n); setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); };
  return <><div className="page-heading"><div><h1>{template.noun}</h1><p>每一个安排，都清清楚楚。</p></div><Button variant="primary" onClick={onNew}><Plus size={18}/>新增{template.noun}</Button></div><div className="panel"><div className="panel-toolbar wrap"><div className="date-picker"><button className="icon-button" aria-label="前一天" onClick={() => shift(-1)}><ChevronLeft size={18}/></button><input aria-label="查看日期" type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)}/><button className="icon-button" aria-label="后一天" onClick={() => shift(1)}><ChevronRight size={18}/></button><Button variant="text" onClick={() => { setDate(TODAY); setView('day'); }}>今天</Button></div><div className="inline"><select aria-label="预约状态筛选" value={status} onChange={e => setStatus(e.target.value)}>{['全部状态', '待确认', '已确认', '已完成', '已取消'].map(s => <option key={s}>{s}</option>)}</select><div className="segmented"><button aria-label="按日查看" className={view === 'day' ? 'active' : ''} onClick={() => setView('day')}><CalendarDays size={17}/></button><button aria-label="全部预约" className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}><List size={17}/></button></div></div></div><div className="panel-body">{view === 'all' ? [...new Set(rows.map(r => r.date))].map(d => <section key={d}><h3 className="date-label">{d}</h3><BookingRows bookings={rows.filter(r => r.date === d)} onEdit={onEdit}/></section>) : <BookingRows bookings={rows} onEdit={onEdit}/>}<p className="subtle small">{rows.length} 条安排 · 时间为马来西亚时间</p></div></div></>;
}
