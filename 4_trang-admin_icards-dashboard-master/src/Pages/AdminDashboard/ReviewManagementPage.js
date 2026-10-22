// src/Pages/AdminDashboard/ReviewManagementPage.js
// Duyệt đánh giá của khách. Chỉ đánh giá "Đã duyệt" mới hiện ở trang chủ icards.com.vn (mục "Khách hàng nói gì về iCards").
// Khách sửa đánh giá thì đánh giá quay về "Chờ duyệt".
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { CheckCircle, EyeOff, Trash2, Search, Star } from 'lucide-react';
import api from '../../services/api';
import './AdminDashboard.css';

const TABS = [
    { id: 'pending', label: 'Chờ duyệt' },
    { id: 'approved', label: 'Đã duyệt' },
    { id: 'hidden', label: 'Đã ẩn' },
    { id: '', label: 'Tất cả' },
];
const STATUS_LABEL = { pending: 'Chờ duyệt', approved: 'Đã duyệt', hidden: 'Đã ẩn' };
const STATUS_COLOR = { pending: '#b45309', approved: '#15803d', hidden: '#6b7280' };

const Stars = ({ value }) => (
    <span aria-label={`${value} sao`} style={{ display: 'inline-flex', gap: 2 }}>
        {[1, 2, 3, 4, 5].map(i => (
            <Star key={i} size={14} fill={i <= value ? '#f59e0b' : 'none'} color={i <= value ? '#f59e0b' : '#d1d5db'} />
        ))}
    </span>
);

const ReviewManagementPage = () => {
    const [status, setStatus] = useState('pending');
    const [query, setQuery] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [items, setItems] = useState([]);
    const [counts, setCounts] = useState({});
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/reviews', { params: { status: status || undefined, q: search || undefined, page, limit: 20 } });
            setItems(res.data.data || []);
            setCounts(res.data.counts || {});
            setPages(res.data.pagination?.pages || 1);
        } catch (e) {
            console.error('Lỗi tải đánh giá', e);
        } finally {
            setLoading(false);
        }
    }, [status, search, page]);

    useEffect(() => { load(); }, [load]);

    const setReviewStatus = async (id, next) => {
        try {
            await api.put(`/admin/reviews/${id}`, { status: next });
            toast.success(next === 'approved' ? 'Đã duyệt, đánh giá hiện ở trang chủ.' : (next === 'hidden' ? 'Đã ẩn đánh giá.' : 'Đã chuyển về chờ duyệt.'));
            load();
        } catch (e) { /* api.js đã báo lỗi */ }
    };
    const remove = async (id) => {
        if (!window.confirm('Xoá hẳn đánh giá này? Không khôi phục được.')) return;
        try {
            await api.delete(`/admin/reviews/${id}`);
            toast.success('Đã xoá đánh giá.');
            load();
        } catch (e) { /* api.js đã báo lỗi */ }
    };

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return (
        <div>
            <header className="admin-header">
                <h1 className="admin-header__title">Đánh giá của khách</h1>
            </header>
            <p style={{ color: '#6b7280', marginTop: 0 }}>
                Khách đăng nhập viết đánh giá ở trang chủ. Chỉ đánh giá <strong>Đã duyệt</strong> mới hiện công khai; khách sửa đánh giá thì quay về Chờ duyệt.
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '1rem 0' }}>
                {TABS.map(t => {
                    const active = status === t.id;
                    const count = t.id ? (counts[t.id] || 0) : total;
                    return (
                        <button key={t.id || 'all'} type="button" onClick={() => { setStatus(t.id); setPage(1); }}
                            className={active ? 'btn btn-primary' : 'btn btn-secondary'}>
                            {t.label} ({count})
                        </button>
                    );
                })}
                <form onSubmit={(e) => { e.preventDefault(); setSearch(query.trim()); setPage(1); }} style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <input className="form-control" placeholder="Tìm tên, nội dung..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Tìm đánh giá" />
                    <button type="submit" className="btn btn-secondary" aria-label="Tìm"><Search size={16} /></button>
                </form>
            </div>

            <div className="card">
                {loading ? <p>Đang tải...</p> : items.length === 0 ? (
                    <p style={{ color: '#6b7280' }}>Không có đánh giá nào.</p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: 170 }}>Khách</th>
                                    <th>Đánh giá</th>
                                    <th style={{ width: 110 }}>Trạng thái</th>
                                    <th style={{ width: 120 }}>Ngày</th>
                                    <th style={{ width: 150 }}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(r => (
                                    <tr key={r._id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{r.displayName}</div>
                                            <div style={{ fontSize: 12, color: '#6b7280' }}>{r.user?.email || r.user?.username || 'Tài khoản đã xoá'}</div>
                                            {r.hasCreatedCard && <div style={{ fontSize: 11, color: '#15803d' }}>Đã tạo thiệp</div>}
                                        </td>
                                        <td>
                                            <Stars value={r.rating} />
                                            {r.title && <div style={{ fontWeight: 600, marginTop: 4 }}>{r.title}</div>}
                                            <div style={{ whiteSpace: 'pre-wrap', marginTop: 2 }}>{r.content}</div>
                                        </td>
                                        <td><span style={{ color: STATUS_COLOR[r.status], fontWeight: 600 }}>{STATUS_LABEL[r.status]}</span></td>
                                        <td style={{ fontSize: 13 }}>{new Date(r.updatedAt || r.createdAt).toLocaleDateString('vi-VN')}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {r.status !== 'approved' && (
                                                    <button type="button" className="btn btn-primary" title="Duyệt (hiện ở trang chủ)" onClick={() => setReviewStatus(r._id, 'approved')}><CheckCircle size={16} /></button>
                                                )}
                                                {r.status !== 'hidden' && (
                                                    <button type="button" className="btn btn-secondary" title="Ẩn" onClick={() => setReviewStatus(r._id, 'hidden')}><EyeOff size={16} /></button>
                                                )}
                                                <button type="button" className="btn btn-danger" title="Xoá hẳn" onClick={() => remove(r._id)}><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {pages > 1 && (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                        <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trang trước</button>
                        <span style={{ alignSelf: 'center' }}>{page} / {pages}</span>
                        <button type="button" className="btn btn-secondary" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Trang sau</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewManagementPage;
