export const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const uid = () => crypto.randomUUID();
export const templates = {
  auto: { label: '汽车美容', shop: 'MONO 汽车护理', noun: '预约', field: '车型 / 车牌', examples: ['Perodua Myvi', 'Honda CR-V', 'Toyota Vios', 'BMW 320i'], services: [['精致洗车', 45, 60], ['车内深层清洁', 180, 90], ['镀膜护理', 580, 120], ['漆面抛光', 280, 120]] },
  beauty: { label: '美发美甲', shop: 'MUSE 美发美甲', noun: '预约', field: '服务偏好', examples: ['短发 · 自然风格', '法式美甲', '中长发', '头皮护理'], services: [['设计剪发', 68, 60], ['精致美甲', 88, 90], ['染发护理', 280, 120], ['头皮养护', 128, 60]] },
  home: { label: '家政冷气', shop: '清日 上门服务', noun: '服务安排', field: '地址 / 服务数量', examples: ['Mont Kiara · 2 台', 'PJ · 3 房公寓', 'Cheras · 3 台', 'Bangsar · 2 房'], services: [['冷气清洗', 100, 60], ['日常保洁', 150, 120], ['冷气深层清洗', 180, 90], ['搬家清洁', 350, 180]] },
  property: { label: '房地产', shop: '邻里 房产顾问', noun: '看房预约', field: '预算 / 意向地区', examples: ['RM 60万 · PJ', 'RM 80万 · KL', 'RM 2,500/月 · Bangsar', 'RM 100万 · Mont Kiara'], services: [['公寓看房', 0, 60], ['排屋看房', 0, 90], ['租赁看房', 0, 60], ['置业咨询', 0, 60]] },
};
export function makeWorkspace(key) {
  const t = templates[key];
  const services = t.services.map(([name, price, duration], i) => ({ id: `s${i}`, name, price, duration }));
  const customers = ['Daniel Tan', '陈小姐', 'Amir', '林先生', '王先生', 'Sarah Lim', 'Jason', 'Nurul'].map((name, i) => ({ id: `c${i}`, name, phone: `+60 10 000 ${String(i + 1).padStart(4, '0')}`, detail: t.examples[i % 4] }));
  const bookings = ['10:00', '11:30', '14:00', '16:30'].map((time, i) => ({ id: `b${i}`, customerId: `c${i}`, serviceId: `s${i}`, date: TODAY, time, staff: i % 2 ? 'Mei' : 'Sam', status: ['已完成', '已确认', '已确认', '待确认'][i], notes: '' }));
  const conversations = customers.map((c, i) => ({ id: `chat${i}`, customerId: c.id, date: TODAY, mode: i === 4 || i === 5 ? 'pending' : 'ai', resolved: false, messages: [{ id: `m${i}a`, from: 'customer', text: i === 4 ? '我想了解一下套餐，有特别折扣吗？' : i === 5 ? '我想把原来的预约改到下午，可以吗？' : `你好，我想了解${services[i % 4].name}。`, time: '10:24' }, { id: `m${i}b`, from: 'ai', text: i === 4 || i === 5 ? '已经记下您的需求，请店里的同事帮您确认。' : `您好，${services[i % 4].name}约需 ${services[i % 4].duration} 分钟。请问您希望预约哪一天？`, time: '10:25' }] }));
  const config = { name: '小美', identity: `你是${t.shop}的服务助理。耐心解答客户问题，了解需求，协助安排${t.noun}。只使用店铺提供的资料；遇到特殊折扣、投诉或不确定的问题，交给人工处理。`, language: '自动匹配客户语言', tone: '亲切、简洁', allowBooking: true, handoff: true };
  return { shop: { name: t.shop, owner: 'Alex', address: 'Kuala Lumpur, Malaysia', hours: '09:00–19:00' }, services, customers, bookings, conversations, draft: config, published: config, version: 1, knowledge: [{ id: 'k1', name: '店铺常见问题', text: '营业时间：每天 09:00–19:00。\n预约：建议提前一天预约，到店前可联系客服改期。\n付款：支持现金、银行卡及 DuitNow。\n停车：店门口提供免费停车位。\n折扣：特殊折扣需要店长确认。', status: 'ready', enabled: true, type: '问答', size: 0 }], staff: [{ id: 'u1', name: 'Alex', phone: '+60100000001', role: '老板' }, { id: 'u2', name: 'Mei', phone: '+60100000002', role: '店长' }, { id: 'u3', name: 'Sam', phone: '+60100000003', role: '员工' }], logs: [] };
}
export const timeNow = () => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
export function minutes(time) { const [h, m] = time.split(':').map(Number); return h * 60 + m; }
export function bookingConflict(workspace, booking) {
  const duration = workspace.services.find(s => s.id === booking.serviceId)?.duration || 60;
  return workspace.bookings.some(b => b.id !== booking.id && b.date === booking.date && b.staff === booking.staff && b.status !== '已取消' && booking.status !== '已取消' && minutes(booking.time) < minutes(b.time) + (workspace.services.find(s => s.id === b.serviceId)?.duration || 60) && minutes(b.time) < minutes(booking.time) + duration);
}
export function simulateReply(question, workspace, role, config) {
  if (/客户名单|所有客户|营业额|收入|全部电话/.test(question)) return role === '老板' ? { text: `演示空间共有 ${workspace.customers.length} 位客户、${workspace.bookings.filter(b => b.status !== '已取消').length} 条有效预约。尚未记录实际收款。`, source: '角色权限 · 老板 / 本地业务数据' } : { text: '这个身份不能访问全店客户或经营数据。请由老板在后台查看。', source: '权限检查 · 已阻止' };
  if (/忽略.*规则|我是老板|提升权限|系统提示/.test(question)) return { text: '身份权限需要由老板在后台设置，聊天消息不能改变权限。', source: '权限检查 · 不执行越权指令' };
  if (/预约|booking|book|改期|取消/i.test(question)) return { text: config.allowBooking ? `可以协助安排。请告诉我服务项目、日期和时间。此处是规则模拟，不会自动下单；可点击下方“创建演示预约”体验记录更新。` : '当前未开启 AI 协助预约，请联系店员安排。', source: '动作权限 · ' + (config.allowBooking ? '允许协助预约' : '已关闭预约') };
  if (/价格|多少钱|price|套餐|服务/i.test(question)) return { text: workspace.services.map(s => `${s.name}：${s.price ? `RM ${s.price}` : '免费咨询'}，约 ${s.duration} 分钟`).join('\n'), source: '店铺设置 · 服务与价格' };
  const words = question.toLowerCase().match(/[a-z]{3,}|[\u4e00-\u9fff]{2}/g) || [];
  let hit;
  for (const doc of workspace.knowledge.filter(d => d.enabled && d.status === 'ready')) {
    for (const line of doc.text.split(/[\n。]/).filter(Boolean)) {
      const score = words.filter(w => `${doc.name} ${line}`.toLowerCase().includes(w)).length;
      if (score && (!hit || score > hit.score)) hit = { text: line, score, source: `知识库 · ${doc.name}` };
    }
  }
  if (hit) return hit;
  if (/你好|hello|hi\b/i.test(question)) return { text: `你好，我是${config.name}，${workspace.shop.name}的服务助理。可以帮你了解服务、价格和预约安排。`, source: 'AI 身份 · 模拟回复' };
  return { text: config.handoff ? '现有资料还不能确认这个问题，我会请店里的同事进一步处理。' : '现有资料中没有找到明确答案，请补充更多信息或联系店员。', source: '未匹配知识 · ' + (config.handoff ? '建议转人工' : '请求补充信息') };
}
