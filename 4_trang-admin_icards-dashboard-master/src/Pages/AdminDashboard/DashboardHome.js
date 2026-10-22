// Bảng điều khiển: số liệu thật từ database (GET /admin/dashboard?days=7|30|90), không có số giả.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import {
    FileHeart, Users, LayoutTemplate, MailCheck, Eye, MessageCircleHeart, FileText, Star, ShoppingBag, Library,
    RefreshCw, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle, ExternalLink, PlusCircle, PenSquare, Type,
    MessageSquareText, Paintbrush, Globe, Gauge, SearchCheck, BarChart3, Map, Bot, Info,
} from 'lucide-react';
import AuthService from '../../services/auth.service';
import { useAuth } from './AdminDashboard';
import { canAccess } from './adminNav';
import './DashboardHome.css';

const RANGES = [7, 30, 90];
const nf = new Intl.NumberFormat('vi-VN');
const fmt = (n) => nf.format(Math.round(Number(n) || 0));
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const shortDate = (key) => { const [, m, d] = key.split('-'); return `${d}/${m}`; };
const fullDate = (key) => { const [y, m, d] = key.split('-'); return `${d}/${m}/${y}`; };
const timeAgo = (iso) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} ngày trước`;
    return new Date(iso).toLocaleDateString('vi-VN');
};
const updatedAt = (iso) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });

// So sánh 7 ngày gần nhất với 7 ngày trước đó
const Delta = ({ cur, prev }) => {
    if (!prev && !cur) return <span className="dh-delta dh-delta--flat">Chưa có trong 14 ngày qua</span>;
    if (!prev) return <span className="dh-delta dh-delta--up"><ArrowUpRight size={14} /> mới so với tuần trước</span>;
    const change = Math.round(((cur - prev) / prev) * 100);
    if (change === 0) return <span className="dh-delta dh-delta--flat">bằng tuần trước</span>;
    const up = change > 0;
    return (
        <span className={`dh-delta ${up ? 'dh-delta--up' : 'dh-delta--down'}`}>
            {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(change)}% so với tuần trước
        </span>
    );
};

const Kpi = ({ icon: Icon, tone, label, value, foot, children }) => (
    <article className="dh-kpi">
        <div className="dh-kpi__head">
            <span className={`dh-kpi__icon dh-tone--${tone}`}><Icon size={18} strokeWidth={1.9} /></span>
            <span className="dh-kpi__label">{label}</span>
        </div>
        <p className="dh-kpi__value">{value}</p>
        {children}
        {foot && <p className="dh-kpi__foot">{foot}</p>}
    </article>
);

const Mini = ({ icon: Icon, label, value, note, to }) => {
    const body = (
        <>
            <span className="dh-mini__icon"><Icon size={16} strokeWidth={1.9} /></span>
            <span className="dh-mini__text"><b>{value}</b><small>{label}</small>{note && <em>{note}</em>}</span>
        </>
    );
    return to ? <Link className="dh-mini dh-mini--link" to={to}>{body}</Link> : <div className="dh-mini">{body}</div>;
};

const Panel = ({ title, sub, action, children, className = '' }) => (
    <section className={`dh-panel ${className}`}>
        <header className="dh-panel__head">
            <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
            {action}
        </header>
        {children}
    </section>
);

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="dh-tooltip">
            <b>{fullDate(label)}</b>
            {payload.map(p => <span key={p.dataKey}><i style={{ background: p.color }} />{p.name}: <strong>{fmt(p.value)}</strong></span>)}
        </div>
    );
};

const Thumb = ({ src, alt }) => (
    <span className="dh-thumb">{src ? <img src={src} alt={alt} loading="lazy" /> : <LayoutTemplate size={18} />}</span>
);

const QUICK_ACTIONS = [
    { to: '/dashboard/templates', icon: PlusCircle, label: 'Thêm mẫu thiệp' },
    { to: '/dashboard/pages', icon: PenSquare, label: 'Viết bài mới', href: '/dashboard/pages/create' },
    { to: '/dashboard/products', icon: ShoppingBag, label: 'Thêm sản phẩm' },
    { to: '/dashboard/fonts', icon: Type, label: 'Cài font chữ' },
    { to: '/dashboard/reviews', icon: MessageSquareText, label: 'Duyệt đánh giá' },
    { to: '/dashboard/settings', icon: Paintbrush, label: 'Banner & giao diện' },
];

const EXTERNAL_TOOLS = [
    { href: 'https://icards.com.vn', icon: Globe, label: 'Mở website', note: 'icards.com.vn' },
    { href: 'https://search.google.com/search-console?resource_id=sc-domain:icards.com.vn', icon: SearchCheck, label: 'Google Search Console', note: 'Từ khoá, lượt hiển thị, lỗi lập chỉ mục' },
    { href: 'https://analytics.google.com/', icon: BarChart3, label: 'Google Analytics', note: 'Lượt truy cập (cần gắn mã đo)' },
    { href: 'https://pagespeed.web.dev/analysis?url=https%3A%2F%2Ficards.com.vn%2F', icon: Gauge, label: 'Kiểm tra tốc độ', note: 'PageSpeed Insights' },
    { href: 'https://icards.com.vn/sitemap.xml', icon: Map, label: 'Sitemap', note: 'Danh sách trang gửi Google' },
    { href: 'https://icards.com.vn/robots.txt', icon: Bot, label: 'robots.txt', note: 'Quy tắc cho máy tìm kiếm' },
];

const CATEGORY_COLORS = { active: '#27548A', hidden: '#C9D3E1' };

const DashboardHome = () => {
    const { user } = useAuth();
    const role = user?.role;
    const [range, setRange] = useState(() => {
        try { const v = Number(localStorage.getItem('admin-dash-range')); return RANGES.includes(v) ? v : 30; } catch (e) { return 30; }
    });
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async (days) => {
        setLoading(true);
        setError(null);
        try {
            setData(await AuthService.getDashboardData(days));
        } catch (e) {
            setError(e?.response?.data?.message || 'Không tải được số liệu. Kiểm tra kết nối rồi bấm Tải lại.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(range); }, [load, range]);

    const changeRange = (d) => {
        setRange(d);
        try { localStorage.setItem('admin-dash-range', String(d)); } catch (e) { /* bỏ qua */ }
    };

    const k = data?.kpis;
    const rangeTotals = useMemo(() => (data?.series || []).reduce((acc, d) => ({ invitations: acc.invitations + d.invitations, customers: acc.customers + d.customers }), { invitations: 0, customers: 0 }), [data]);
    const categoryRows = useMemo(() => (data?.templatesByCategory || []).map(c => ({ category: c.category, active: c.active, hidden: c.total - c.active })), [data]);
    const maxUses = Math.max(1, ...(data?.topUsedTemplates || []).map(t => t.uses));
    const maxViews = Math.max(1, ...(data?.topViewedTemplates || []).map(t => t.views));

    const todos = k ? [
        { show: canAccess(role, '/dashboard/reviews'), count: k.reviews.pending, text: 'đánh giá của khách chờ duyệt', to: '/dashboard/reviews' },
        { show: canAccess(role, '/dashboard/templates'), count: k.templates.hidden, text: 'mẫu thiệp đang ẩn khỏi website', to: '/dashboard/templates' },
        { show: canAccess(role, '/dashboard/pages'), count: k.content.postsDraft, text: 'bài viết còn ở dạng nháp', to: '/dashboard/pages' },
        { show: canAccess(role, '/dashboard/pages'), count: k.content.postsNoSeo, text: 'bài đã đăng thiếu mô tả SEO', to: '/dashboard/pages' },
    ].filter(t => t.show) : [];
    const openTodos = todos.filter(t => t.count > 0);

    if (loading && !data) {
        return (
            <div className="dh">
                <div className="dh-head"><div><h1 className="dh-title">Bảng điều khiển</h1><p className="dh-sub">Đang tải số liệu…</p></div></div>
                <div className="dh-kpis">{[0, 1, 2, 3].map(i => <div key={i} className="dh-kpi dh-skeleton" />)}</div>
                <div className="dh-grid dh-grid--main"><div className="dh-panel dh-skeleton dh-skeleton--tall" /><div className="dh-panel dh-skeleton dh-skeleton--tall" /></div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="dh">
                <div className="dh-head"><div><h1 className="dh-title">Bảng điều khiển</h1></div></div>
                <div className="dh-error"><AlertCircle size={20} /><span>{error}</span><button className="btn btn-primary" onClick={() => load(range)}><RefreshCw size={16} /> Tải lại</button></div>
            </div>
        );
    }

    const g = k.guests;
    const responded = g.attending + g.declined;

    return (
        <div className={`dh ${loading ? 'dh--refreshing' : ''}`}>
            <div className="dh-head">
                <div>
                    <h1 className="dh-title">Bảng điều khiển</h1>
                    <p className="dh-sub">Cập nhật lúc {updatedAt(data.generatedAt)} · số liệu thật từ hệ thống</p>
                </div>
                <div className="dh-head__actions">
                    <div className="dh-range" role="group" aria-label="Khoảng thời gian">
                        {RANGES.map(d => (
                            <button key={d} type="button" aria-pressed={range === d} onClick={() => changeRange(d)}>{d} ngày</button>
                        ))}
                    </div>
                    <button type="button" className="dh-icon-btn" onClick={() => load(range)} title="Tải lại số liệu" aria-label="Tải lại số liệu">
                        <RefreshCw size={17} className={loading ? 'dh-spin' : ''} />
                    </button>
                </div>
            </div>

            {error && <div className="dh-error dh-error--inline"><AlertCircle size={18} /><span>{error}</span></div>}

            <div className="dh-kpis">
                <Kpi icon={FileHeart} tone="brand" label="Thiệp khách đã tạo" value={fmt(k.invitations.total)} foot={`Hôm nay: ${fmt(k.invitations.today)} · 7 ngày: ${fmt(k.invitations.last7)}`}>
                    <Delta cur={k.invitations.last7} prev={k.invitations.prev7} />
                </Kpi>
                <Kpi icon={Users} tone="gold" label="Khách hàng đăng ký" value={fmt(k.customers.total)} foot={`Mới 7 ngày: ${fmt(k.customers.last7)} · ${fmt(k.customers.staff)} tài khoản nhân viên (không tính)`}>
                    <Delta cur={k.customers.last7} prev={k.customers.prev7} />
                </Kpi>
                <Kpi icon={LayoutTemplate} tone="teal" label="Mẫu thiệp đang hiển thị" value={<>{fmt(k.templates.active)}<small> / {fmt(k.templates.total)}</small></>} foot={`${fmt(k.templates.hidden)} mẫu đang ẩn · ${fmt(k.templates.free)} mẫu miễn phí`}>
                    <div className="dh-bar" aria-hidden="true"><span style={{ width: `${pct(k.templates.active, k.templates.total)}%` }} /></div>
                </Kpi>
                <Kpi icon={MailCheck} tone="rose" label="Khách mời trong các thiệp" value={fmt(g.total)} foot={`${fmt(g.attending)} tham dự · ${fmt(g.declined)} từ chối · ${fmt(g.pending)} chưa trả lời`}>
                    <div className="dh-stack" aria-label={`${pct(responded, g.total)}% khách mời đã phản hồi`}>
                        <span className="dh-stack__yes" style={{ width: `${pct(g.attending, g.total)}%` }} />
                        <span className="dh-stack__no" style={{ width: `${pct(g.declined, g.total)}%` }} />
                    </div>
                </Kpi>
            </div>

            <div className="dh-minis">
                <Mini icon={Eye} label="lượt xem trang mẫu thiệp" value={fmt(k.templates.views)} />
                <Mini icon={MessageCircleHeart} label="lời chúc khách đã gửi" value={fmt(g.wishes)} />
                <Mini icon={FileText} label="bài viết đã đăng" value={fmt(k.content.postsPublished)} note={k.content.postsDraft ? `${fmt(k.content.postsDraft)} nháp` : null} to={canAccess(role, '/dashboard/pages') ? '/dashboard/pages' : null} />
                <Mini icon={Star} label="đánh giá đang hiện" value={fmt(k.reviews.approved)} note={k.reviews.avgRating ? `★ ${String(k.reviews.avgRating).replace('.', ',')}/5` : null} to={canAccess(role, '/dashboard/reviews') ? '/dashboard/reviews' : null} />
                <Mini icon={ShoppingBag} label="sản phẩm & dịch vụ" value={fmt(k.products.total)} to={canAccess(role, '/dashboard/products') ? '/dashboard/products' : null} />
                <Mini icon={Library} label="font · tài sản · ảnh" value={`${fmt(k.library.fonts)} · ${fmt(k.library.designAssets)} · ${fmt(k.library.media)}`} />
            </div>

            <div className="dh-grid dh-grid--main">
                <Panel title={`Hoạt động ${range} ngày qua`} sub={`${fmt(rangeTotals.invitations)} thiệp mới · ${fmt(rangeTotals.customers)} khách hàng mới`} className="dh-panel--chart">
                    <div className="dh-chart">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="dhInv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#27548A" stopOpacity={0.28} /><stop offset="100%" stopColor="#27548A" stopOpacity={0} /></linearGradient>
                                    <linearGradient id="dhCus" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D9932E" stopOpacity={0.24} /><stop offset="100%" stopColor="#D9932E" stopOpacity={0} /></linearGradient>
                                </defs>
                                <CartesianGrid stroke="#E7ECF3" vertical={false} />
                                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 12, fill: '#6B778C' }} axisLine={false} tickLine={false} minTickGap={18} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6B778C' }} axisLine={false} tickLine={false} width={44} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                                <Area type="monotone" name="Thiệp mới" dataKey="invitations" stroke="#27548A" strokeWidth={2} fill="url(#dhInv)" dot={false} activeDot={{ r: 4 }} />
                                <Area type="monotone" name="Khách hàng mới" dataKey="customers" stroke="#D9932E" strokeWidth={2} fill="url(#dhCus)" dot={false} activeDot={{ r: 4 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>

                <Panel title="Việc cần xử lý" sub={openTodos.length ? `${openTodos.length} việc đang chờ` : 'Không có việc tồn đọng'}>
                    <ul className="dh-todos">
                        {todos.map(t => (
                            <li key={t.text} className={t.count ? 'is-open' : 'is-done'}>
                                {t.count ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                                <span><b>{fmt(t.count)}</b> {t.text}</span>
                                {t.count > 0 && <Link to={t.to} className="dh-todos__go">Xử lý</Link>}
                            </li>
                        ))}
                        <li className="is-info">
                            <Info size={18} />
                            <span>Website chưa gắn công cụ đo lượt truy cập, nên Bảng điều khiển không hiển thị số người xem web. Gắn Google Analytics để có số liệu này.</span>
                        </li>
                    </ul>
                </Panel>
            </div>

            <div className="dh-grid dh-grid--three">
                <Panel title="Mẫu được dùng nhiều nhất" sub="Theo số thiệp khách đã tạo">
                    {data.topUsedTemplates.length ? (
                        <ol className="dh-rank">
                            {data.topUsedTemplates.map((t, i) => (
                                <li key={t.id}>
                                    <span className="dh-rank__no">{i + 1}</span>
                                    <Thumb src={t.imgSrc} alt={t.title} />
                                    <span className="dh-rank__main">
                                        <b title={t.title}>{t.title}</b>
                                        <span className="dh-rank__meter"><span style={{ width: `${pct(t.uses, maxUses)}%` }} /></span>
                                    </span>
                                    <span className="dh-rank__num">{fmt(t.uses)}<small>thiệp</small></span>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="dh-empty">Chưa có thiệp nào được tạo.</p>}
                </Panel>

                <Panel title="Mẫu được xem nhiều nhất" sub="Lượt mở trang chi tiết mẫu">
                    {data.topViewedTemplates.length ? (
                        <ol className="dh-rank">
                            {data.topViewedTemplates.map((t, i) => (
                                <li key={t.id}>
                                    <span className="dh-rank__no">{i + 1}</span>
                                    <Thumb src={t.imgSrc} alt={t.name} />
                                    <span className="dh-rank__main">
                                        <b title={t.name}>{t.name}</b>
                                        <span className="dh-rank__meter dh-rank__meter--gold"><span style={{ width: `${pct(t.views, maxViews)}%` }} /></span>
                                    </span>
                                    <span className="dh-rank__num">{fmt(t.views)}<small>lượt xem</small></span>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="dh-empty">Chưa có mẫu nào đang hiển thị.</p>}
                </Panel>

                <Panel title="Mẫu thiệp theo danh mục" sub="Đang hiện và đang ẩn">
                    {categoryRows.length ? (
                        <div className="dh-chart dh-chart--bars" style={{ height: Math.max(180, categoryRows.length * 44 + 40) }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={categoryRows} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap={10}>
                                    <XAxis type="number" allowDecimals={false} hide />
                                    <YAxis type="category" dataKey="category" width={128} tick={{ fontSize: 12, fill: '#344055' }} axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{ fill: '#F2F5F9' }} formatter={(v, n) => [fmt(v), n]} />
                                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="active" name="Đang hiện" stackId="a" fill={CATEGORY_COLORS.active} radius={[4, 0, 0, 4]} />
                                    <Bar dataKey="hidden" name="Đang ẩn" stackId="a" fill={CATEGORY_COLORS.hidden} radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <p className="dh-empty">Chưa có mẫu thiệp.</p>}
                </Panel>
            </div>

            <div className={`dh-grid ${data.recentCustomers.length ? 'dh-grid--main' : ''}`}>
                <Panel title="Thiệp mới tạo gần đây" sub="6 thiệp mới nhất của khách">
                    {data.recentInvitations.length ? (
                        <div className="dh-table-wrap">
                            <table className="dh-table">
                                <thead><tr><th>Mẫu thiệp</th>{role === 'admin' && <th>Khách hàng</th>}<th className="num">Khách mời</th><th className="num">Thời gian</th></tr></thead>
                                <tbody>
                                    {data.recentInvitations.map(inv => (
                                        <tr key={inv.id}>
                                            <td><span className="dh-cell-tpl"><Thumb src={inv.imgSrc} alt={inv.template} /><span title={inv.template}>{inv.template}</span></span></td>
                                            {role === 'admin' && <td>{inv.customer}</td>}
                                            <td className="num">{fmt(inv.guests)}</td>
                                            <td className="num dh-muted">{timeAgo(inv.createdAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <p className="dh-empty">Chưa có thiệp nào.</p>}
                </Panel>

                {data.recentCustomers.length > 0 && (
                    <Panel title="Khách hàng mới" sub="Tài khoản vừa đăng ký" action={canAccess(role, '/dashboard/users') ? <Link className="dh-link" to="/dashboard/users">Xem tất cả</Link> : null}>
                        <ul className="dh-people">
                            {data.recentCustomers.map(c => (
                                <li key={c.id}>
                                    <span className="dh-people__avatar" aria-hidden="true">{(c.name || '?').trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase()}</span>
                                    <span className="dh-people__main"><b>{c.name}</b><small>{c.email}</small></span>
                                    <span className="dh-muted">{timeAgo(c.createdAt)}</span>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                )}
            </div>

            <Panel title="Công cụ" sub="Lối tắt thao tác thường dùng và công cụ theo dõi website" className="dh-tools">
                <div className="dh-tools__grid">
                    <div>
                        <h3 className="dh-tools__title">Thao tác nhanh</h3>
                        <div className="dh-actions">
                            {QUICK_ACTIONS.filter(a => canAccess(role, a.to)).map(({ to, href, icon: Icon, label }) => (
                                <Link key={label} to={href || to} className="dh-action"><Icon size={18} strokeWidth={1.9} /><span>{label}</span></Link>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3 className="dh-tools__title">Theo dõi website</h3>
                        <div className="dh-ext">
                            {EXTERNAL_TOOLS.map(({ href, icon: Icon, label, note }) => (
                                <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="dh-ext__item">
                                    <Icon size={18} strokeWidth={1.9} />
                                    <span><b>{label}</b><small>{note}</small></span>
                                    <ExternalLink size={14} className="dh-ext__arrow" />
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            </Panel>
        </div>
    );
};

export default DashboardHome;
