import { useState } from 'react';
import { Store as StoreIcon, House, MessageSquare, CalendarDays, Bot, Settings as SettingsIcon, ChevronRight, ChevronsUpDown, Check, Menu } from 'lucide-react';
import { useStore } from './store';
import { Badge, Avatar } from './components';
import Home from './Home';
import Messages from './Messages';
import Bookings, { BookingModal } from './Bookings';
import Assistant from './Assistant';
import Settings from './Settings';
export default function App() {
  const { workspace: w, template, industry, toast, storageError } = useStore();
  const [page, setPage] = useState('home'); const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState(null); const [chat, setChat] = useState('chat4');
  const nav = [{ id:'home', label:'首页', icon:House },{ id:'messages', label:'消息', icon:MessageSquare },{ id:'bookings',label:template.noun,icon:CalendarDays },{ id:'assistant',label:'AI 助手',icon:Bot },{ id:'settings',label:'设置',icon:SettingsIcon }];
  const navigate = p => { setPage(p); setMobileNav(false); };
  const onNew = () => setModal({}); const onEdit = booking => setModal({ booking });
  return <div className="app-shell"><aside className={`sidebar ${mobileNav ? 'open' : ''}`}><a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('home'); }}><span className="brand-mark"><StoreIcon size={24}/></span><span>小店搭子<span className="brand-caption">让生意，简单一点。</span></span></a><button className="shop-switch" onClick={() => navigate('settings')}><span className="shop-letter">{w.shop.name.slice(0,1)}</span><span><strong>{w.shop.name}</strong><small>{template.label} · 单店空间</small></span><ChevronsUpDown size={15}/></button><nav aria-label="主导航">{nav.map(n => <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => navigate(n.id)} aria-current={page === n.id ? 'page' : undefined}><n.icon size={20}/><span>{n.label}</span>{n.id === 'messages' && w.conversations.some(c => c.mode === 'pending' && !c.resolved) && <span className="nav-count">{w.conversations.filter(c => c.mode === 'pending' && !c.resolved).length}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="demo-note"><span className="tiny-spark">✦</span><strong>你的生意，有个好搭子。</strong><p>从第一条消息，到每一次预约。</p></div><button className="owner" onClick={() => navigate('settings')}><Avatar name={w.shop.owner}/><span><strong>{w.shop.owner}</strong><small>老板 · 演示空间</small></span><ChevronRight size={16}/></button></div></aside>{mobileNav && <button className="nav-scrim" aria-label="关闭导航" onClick={() => setMobileNav(false)}/>}
    <main className="main"><header className="topbar"><div className="inline"><button className="icon-button mobile-menu" aria-label="打开导航" onClick={() => setMobileNav(true)}><Menu size={22}/></button><span>工作台</span><ChevronRight size={14}/><strong>{nav.find(n => n.id === page).label}</strong></div><Badge tone="gray"><i className="status-dot amber"/>演示模式</Badge></header><div className="content" key={industry}>{storageError && <div className="error" role="alert">浏览器存储不可用或已满，当前改动只能暂存于本次会话。请减少知识文件容量。</div>}{page === 'home' && <Home navigate={navigate} onNew={onNew} onEdit={onEdit} openChat={id => { setChat(id); navigate('messages'); }}/>} {page === 'messages' && <Messages selected={chat} setSelected={setChat} onBook={customerId => setModal({ customerId })}/>} {page === 'bookings' && <Bookings onNew={onNew} onEdit={onEdit}/>} {page === 'assistant' && <Assistant onBook={onNew}/>} {page === 'settings' && <Settings/>}</div></main>{modal && <BookingModal {...modal} onClose={() => setModal(null)}/>} {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}</div>;
}
