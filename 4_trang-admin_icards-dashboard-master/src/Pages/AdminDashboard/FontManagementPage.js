// Quản lý font chữ: cài một hoặc nhiều font; font trùng tên được hỏi Ghi đè / Bỏ qua từng cái rồi cài tiếp phần còn lại.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';
import { PlusCircle, Trash2, UploadCloud, Search, Edit, Save, X, AlertTriangle, CheckCircle2, SkipForward, RefreshCcw, XCircle, Loader2 } from 'lucide-react';
import AuthService from '../../services/auth.service';
import './AdminDashboard.css';
import './FontManagementPage.css';

const FONT_CATEGORIES = [
    { id: 'all', label: 'Tất cả' },
    { id: 'Wedding', label: 'Font cưới' },
    { id: 'Uppercase', label: 'Font viết hoa' },
    { id: 'Vietnamese', label: 'Font tiếng Việt' },
    { id: 'General', label: 'Khác' }
];
const CATEGORY_LABEL = { Wedding: 'Cưới', Uppercase: 'Viết hoa', Vietnamese: 'Tiếng Việt', General: 'Khác' };
const FONT_EXT = /\.(ttf|otf|woff2?)$/i;
const BATCH_FILES = 15;               // mỗi lần gửi tối đa 15 file
const BATCH_BYTES = 12 * 1024 * 1024; // hoặc ~12 MB

const keyOf = (name) => String(name || '').trim().toLowerCase();
const baseName = (fileName) => fileName.split('.').slice(0, -1).join('.') || fileName;
const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Chia danh sách thành từng đợt nhỏ (giới hạn số file và dung lượng mỗi lần gửi)
const toBatches = (items) => {
    const out = [];
    let cur = []; let bytes = 0;
    items.forEach(it => {
        if (cur.length && (cur.length >= BATCH_FILES || bytes + it.file.size > BATCH_BYTES)) { out.push(cur); cur = []; bytes = 0; }
        cur.push(it); bytes += it.file.size;
    });
    if (cur.length) out.push(cur);
    return out;
};

// Xem trước chữ bằng chính file font (font trên máy hoặc font đã có trên R2).
// lazy: chỉ tải file font khi dòng hiện trên màn hình (danh sách có hàng trăm font).
const FontSample = ({ family, src, text = 'Aa Ăâ Đđ Ơơ 123', lazy = false }) => {
    const ref = useRef(null);
    const [visible, setVisible] = useState(!lazy);
    useEffect(() => {
        if (!lazy || visible || !ref.current) return undefined;
        if (typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined; }
        const io = new IntersectionObserver((entries) => { if (entries.some(e => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: '200px' });
        io.observe(ref.current);
        return () => io.disconnect();
    }, [lazy, visible]);
    return (
        <span ref={ref} className="fm-sample" style={{ fontFamily: visible ? `"${family}", sans-serif` : 'inherit' }}>
            {visible && <style>{`@font-face{font-family:"${family}";src:url('${src}');font-display:swap;}`}</style>}
            {text}
        </span>
    );
};

// === Hộp thoại thêm nhiều font ===
const BulkAddFontModal = ({ isOpen, onClose, onSave, defaultCategory, existingKeys }) => {
    const [files, setFiles] = useState([]);

    useEffect(() => {
        if (!isOpen) setFiles([]);
    }, [isOpen]);

    const handleFileChange = (e) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map(file => ({
                id: `${file.name}-${file.lastModified}-${file.size}`,
                file,
                name: baseName(file.name),
                category: defaultCategory,
            }));
            setFiles(prev => {
                const seen = new Set(prev.map(f => f.id));
                return [...prev, ...newFiles.filter(f => !seen.has(f.id))];
            });
            e.target.value = '';
        }
    };

    const handleUpdate = (id, field, value) => setFiles(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
    const handleRemove = (id) => setFiles(prev => prev.filter(f => f.id !== id));

    // Tên trùng nhau ngay trong danh sách chọn: phải đổi tên trước khi cài
    const dupInList = useMemo(() => {
        const count = new Map();
        files.forEach(f => { const k = keyOf(f.name); if (k) count.set(k, (count.get(k) || 0) + 1); });
        return new Set([...count].filter(([, n]) => n > 1).map(([k]) => k));
    }, [files]);
    const existingCount = files.filter(f => existingKeys.has(keyOf(f.name))).length;
    const emptyCount = files.filter(f => !keyOf(f.name)).length;
    const blocked = dupInList.size > 0 || emptyCount > 0 || files.length === 0;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (files.length === 0) { toast.warn('Vui lòng chọn ít nhất một file font.'); return; }
        if (blocked) return;
        onSave(files.map(f => ({ file: f.file, fileName: f.file.name, name: f.name.trim(), category: f.category })));
    };

    if (!isOpen) return null;
    return (
        <div className="modal-overlay" style={{ display: 'flex' }}>
            <div className="modal-content modal-content--large fm-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">Thêm font hàng loạt</h3>
                    <button onClick={onClose} className="modal-close-btn" aria-label="Đóng">×</button>
                </div>
                <form onSubmit={handleSubmit} className="fm-modal__form">
                    <div className="modal-body">
                        <label className="fm-drop">
                            <UploadCloud size={22} />
                            <span><b>Chọn file font</b> (.ttf, .otf, .woff, .woff2), chọn được nhiều file cùng lúc</span>
                            <input type="file" accept=".ttf,.otf,.woff,.woff2" multiple hidden onChange={handleFileChange} />
                        </label>
                        {files.length > 0 && (
                            <>
                                <p className="fm-note">
                                    {files.length} file đã chọn.
                                    {existingCount > 0 && <> <b>{existingCount}</b> font đã có trên hệ thống: bạn sẽ được hỏi ghi đè hay bỏ qua từng font trước khi cài.</>}
                                </p>
                                <div className="table-container minimal-table fm-list">
                                    <table className="table">
                                        <thead>
                                            <tr><th>Tên file</th><th>Tên font sẽ lưu *</th><th>Loại</th><th aria-label="Xoá" /></tr>
                                        </thead>
                                        <tbody>
                                            {files.map(f => {
                                                const k = keyOf(f.name);
                                                const dup = dupInList.has(k);
                                                const exists = existingKeys.has(k);
                                                return (
                                                    <tr key={f.id} className={dup || !k ? 'fm-row--error' : ''}>
                                                        <td className="fm-file"><span title={f.file.name}>{f.file.name}</span><small>{fmtSize(f.file.size)}</small></td>
                                                        <td>
                                                            <input type="text" value={f.name} onChange={(e) => handleUpdate(f.id, 'name', e.target.value)} className="form-control" aria-label={`Tên font cho ${f.file.name}`} />
                                                            {!k && <small className="fm-flag fm-flag--error">Nhập tên font</small>}
                                                            {dup && <small className="fm-flag fm-flag--error">Trùng tên với file khác trong danh sách, đổi một tên</small>}
                                                            {!dup && exists && <small className="fm-flag">Đã có font tên này</small>}
                                                        </td>
                                                        <td>
                                                            <select value={f.category} onChange={(e) => handleUpdate(f.id, 'category', e.target.value)} className="form-control" aria-label="Loại font">
                                                                <option value="Wedding">Cưới</option>
                                                                <option value="Uppercase">Viết hoa</option>
                                                                <option value="Vietnamese">Tiếng Việt</option>
                                                                <option value="General">Khác</option>
                                                            </select>
                                                        </td>
                                                        <td><button type="button" onClick={() => handleRemove(f.id)} className="delete-btn" title="Bỏ file này"><Trash2 size={18} /></button></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" onClick={onClose} className="btn btn-secondary">Huỷ</button>
                        <button type="submit" className="btn btn-primary" disabled={blocked}><UploadCloud size={16} /> Cài {files.length || ''} font</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// === Hộp thoại font trùng tên: chọn Ghi đè / Bỏ qua cho từng font ===
const ConflictResolveModal = ({ pending, onChoose, onChooseAll, onCancel, onContinue }) => {
    const conflictList = pending ? pending.conflicts : null;
    // URL tạm để xem trước file mới; chỉ thu hồi khi danh sách font trùng đổi hoặc hộp thoại đóng
    const fileUrls = useMemo(() => (conflictList ? Object.fromEntries(conflictList.map(c => [c.key, URL.createObjectURL(c.file)])) : {}), [conflictList]);
    useEffect(() => () => { Object.values(fileUrls).forEach(u => URL.revokeObjectURL(u)); }, [fileUrls]);
    if (!pending) return null;
    const { conflicts, fresh, choices } = pending;
    const fileUrl = (c) => fileUrls[c.key];
    const overwriteCount = conflicts.filter(c => choices[c.key] === 'overwrite').length;
    const total = fresh.length + overwriteCount;

    return (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 1100 }}>
            <div className="modal-content fm-conflict" role="dialog" aria-modal="true" aria-labelledby="fm-conflict-title">
                <div className="modal-header">
                    <h3 className="modal-title fm-conflict__title" id="fm-conflict-title"><AlertTriangle size={20} /> {conflicts.length} font đã có trên hệ thống</h3>
                    <button onClick={onCancel} className="modal-close-btn" aria-label="Huỷ cài đặt">×</button>
                </div>
                <div className="modal-body">
                    <p className="fm-note">
                        Chọn <b>Ghi đè</b> để thay file font cũ bằng file mới (giữ nguyên tên và loại font), hoặc <b>Bỏ qua</b> để giữ font cũ.
                        {fresh.length > 0 && <> {fresh.length} font mới còn lại sẽ được cài bình thường.</>}
                    </p>
                    <div className="fm-conflict__bulk">
                        <button type="button" className="btn btn-secondary" onClick={() => onChooseAll('overwrite')}><RefreshCcw size={15} /> Ghi đè tất cả</button>
                        <button type="button" className="btn btn-secondary" onClick={() => onChooseAll('skip')}><SkipForward size={15} /> Bỏ qua tất cả</button>
                    </div>
                    <ul className="fm-conflict__list">
                        {conflicts.map(c => (
                            <li key={c.key} className={choices[c.key] === 'overwrite' ? 'is-overwrite' : 'is-skip'}>
                                <div className="fm-conflict__info">
                                    <b>{c.existing.name}</b>
                                    <small>File mới: {c.fileName} · {fmtSize(c.file.size)} · Loại đang có: {CATEGORY_LABEL[c.existing.category] || 'Khác'}</small>
                                    <div className="fm-compare">
                                        <span><em>Đang có</em><FontSample family={`fm-old-${c.key}`} src={c.existing.url} /></span>
                                        <span><em>File mới</em><FontSample family={`fm-new-${c.key}`} src={fileUrl(c)} /></span>
                                    </div>
                                </div>
                                <div className="fm-choice" role="radiogroup" aria-label={`Xử lý font ${c.existing.name}`}>
                                    <button type="button" role="radio" aria-checked={choices[c.key] === 'overwrite'} className="fm-choice__btn fm-choice__btn--over" onClick={() => onChoose(c.key, 'overwrite')}>Ghi đè</button>
                                    <button type="button" role="radio" aria-checked={choices[c.key] === 'skip'} className="fm-choice__btn" onClick={() => onChoose(c.key, 'skip')}>Bỏ qua</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="modal-footer fm-conflict__foot">
                    <button onClick={onCancel} className="btn btn-secondary">Huỷ cài đặt</button>
                    <button onClick={onContinue} className="btn btn-primary">
                        {total > 0 ? <>Tiếp tục cài {total} font</> : <>Xong, không cài font nào</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

// === Đang cài & kết quả ===
const InstallProgress = ({ progress }) => {
    if (!progress) return null;
    const p = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 1200 }}>
            <div className="modal-content fm-progress" role="status" aria-live="polite">
                <Loader2 size={28} className="fm-spin" />
                <b>Đang cài font… {progress.done}/{progress.total}</b>
                <div className="fm-progress__bar"><span style={{ width: `${p}%` }} /></div>
                <small>Giữ trang này mở cho tới khi cài xong.</small>
            </div>
        </div>
    );
};

const InstallResult = ({ result, onClose }) => {
    if (!result) return null;
    const rows = [
        { key: 'added', icon: CheckCircle2, cls: 'ok', label: 'Cài mới', list: result.added },
        { key: 'overwritten', icon: RefreshCcw, cls: 'over', label: 'Đã ghi đè', list: result.overwritten },
        { key: 'skipped', icon: SkipForward, cls: 'skip', label: 'Bỏ qua (giữ font cũ)', list: result.skipped },
        { key: 'failed', icon: XCircle, cls: 'fail', label: 'Không cài được', list: result.failed.map(f => `${f.name}: ${f.reason}`) },
    ].filter(r => r.list.length);
    return (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 1200 }} onClick={onClose}>
            <div className="modal-content fm-result" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="fm-result-title">
                <div className="modal-header">
                    <h3 className="modal-title" id="fm-result-title">Kết quả cài font</h3>
                    <button onClick={onClose} className="modal-close-btn" aria-label="Đóng">×</button>
                </div>
                <div className="modal-body">
                    {rows.map(({ key, icon: Icon, cls, label, list }) => (
                        <details key={key} className={`fm-result__row fm-result__row--${cls}`} open={key === 'failed' || list.length <= 6}>
                            <summary><Icon size={18} /> <b>{list.length}</b> {label}</summary>
                            <ul>{list.map((n, i) => <li key={i}>{n}</li>)}</ul>
                        </details>
                    ))}
                </div>
                <div className="modal-footer"><button className="btn btn-primary" onClick={onClose}>Đóng</button></div>
            </div>
        </div>
    );
};

// === Trang chính ===
const FontManagementPage = () => {
    const [fonts, setFonts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newFontName, setNewFontName] = useState('');
    const [newFontFile, setNewFontFile] = useState(null);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFonts, setSelectedFonts] = useState({});
    const [editingFontId, setEditingFontId] = useState(null);
    const [editingFontName, setEditingFontName] = useState('');
    const [editingCategory, setEditingCategory] = useState('');

    const [activeTab, setActiveTab] = useState('all');
    const [newFontCategory, setNewFontCategory] = useState('General');
    const [bulkCategory, setBulkCategory] = useState('Wedding');

    // Cài đặt: font trùng chờ quyết định, tiến độ, kết quả
    const [pending, setPending] = useState(null);       // { fresh, conflicts, choices, onDone }
    const [progress, setProgress] = useState(null);     // { done, total }
    const [result, setResult] = useState(null);         // { added, overwritten, skipped, failed }

    useEffect(() => {
        setNewFontCategory(activeTab !== 'all' ? activeTab : 'General');
    }, [activeTab]);

    const fetchFonts = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await AuthService.getFonts();
            setFonts(data);
        } catch (error) {
            toast.error('Không thể tải danh sách font.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchFonts(); }, [fetchFonts]);

    const existingByKey = useMemo(() => new Map(fonts.map(f => [keyOf(f.name), f])), [fonts]);
    const existingKeys = useMemo(() => new Set(existingByKey.keys()), [existingByKey]);
    const counts = useMemo(() => fonts.reduce((acc, f) => { acc[f.category] = (acc[f.category] || 0) + 1; return acc; }, { all: fonts.length }), [fonts]);

    const filteredFonts = useMemo(() =>
        fonts.filter(font => {
            const matchesSearch = font.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesTab = activeTab === 'all' || font.category === activeTab;
            return matchesSearch && matchesTab;
        }), [fonts, searchTerm, activeTab]);

    // --- Cài font ---
    const runInstall = async (toInstall, skipped, onDone) => {
        const res = { added: [], overwritten: [], skipped, failed: [] };
        if (toInstall.length) {
            setProgress({ done: 0, total: toInstall.length });
            let done = 0;
            for (const overwrite of [false, true]) {
                const group = toInstall.filter(i => (i.mode === 'overwrite') === overwrite);
                for (const batch of toBatches(group)) {
                    try {
                        await AuthService.bulkAddFonts(
                            batch.map(i => ({ file: i.file })),
                            batch.map(i => ({ name: i.name, category: i.category })),
                            overwrite,
                            { silent: true }
                        );
                        (overwrite ? res.overwritten : res.added).push(...batch.map(i => i.name));
                    } catch (error) {
                        const raced = error.response?.status === 409 && error.response.data?.code === 'DUPLICATE_FONTS';
                        const reason = raced ? 'vừa có font cùng tên được thêm, hãy cài lại để chọn ghi đè' : (error.response?.data?.message || 'lỗi kết nối hoặc file không hợp lệ');
                        res.failed.push(...batch.map(i => ({ name: i.name, reason })));
                    }
                    done += batch.length;
                    setProgress({ done, total: toInstall.length });
                }
            }
            setProgress(null);
            await fetchFonts();
        }
        if (res.added.length + res.overwritten.length > 0 && onDone) onDone();
        const installed = res.added.length + res.overwritten.length;
        if (!res.failed.length && !res.skipped.length && installed === 1) {
            toast.success(res.overwritten.length ? `Đã ghi đè font "${res.overwritten[0]}".` : `Đã cài font "${res.added[0]}".`);
        } else {
            setResult(res);
        }
    };

    // Kiểm tra trùng tên (không phân biệt hoa thường) trước khi cài
    const startInstall = (items, onDone) => {
        const fresh = []; const conflicts = [];
        items.forEach((it, idx) => {
            const existing = existingByKey.get(keyOf(it.name));
            if (existing) conflicts.push({ ...it, key: `c${idx}`, existing });
            else fresh.push({ ...it, mode: 'new' });
        });
        if (!conflicts.length) { runInstall(fresh, [], onDone); return; }
        setPending({ fresh, conflicts, choices: Object.fromEntries(conflicts.map(c => [c.key, 'skip'])), onDone });
    };

    const continueInstall = () => {
        const { fresh, conflicts, choices, onDone } = pending;
        // Ghi đè: dùng đúng tên đang có để thay font cũ thay vì tạo font thứ hai khác chữ hoa/thường
        const overwrite = conflicts.filter(c => choices[c.key] === 'overwrite').map(c => ({ ...c, name: c.existing.name, category: c.existing.category || c.category, mode: 'overwrite' }));
        const skipped = conflicts.filter(c => choices[c.key] !== 'overwrite').map(c => c.existing.name);
        setPending(null);
        runInstall([...fresh, ...overwrite], skipped, onDone);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNewFontFile(file);
            setNewFontName(baseName(file.name));
        }
    };

    const resetSingleForm = () => {
        setNewFontName('');
        setNewFontFile(null);
        const input = document.getElementById('font-file-input');
        if (input) input.value = '';
    };

    const handleAddFont = (e) => {
        e.preventDefault();
        if (!newFontName.trim() || !newFontFile) { toast.warn('Vui lòng nhập tên và chọn file font.'); return; }
        if (!FONT_EXT.test(newFontFile.name)) { toast.warn('Chỉ nhận file .ttf, .otf, .woff, .woff2.'); return; }
        startInstall([{ file: newFontFile, fileName: newFontFile.name, name: newFontName.trim(), category: newFontCategory }], resetSingleForm);
    };

    const handleSaveBulkFonts = (items) => {
        setIsBulkModalOpen(false);
        startInstall(items);
    };

    // --- Chọn, xoá, sửa ---
    const handleSelectFont = (fontId) => setSelectedFonts(prev => {
        const next = { ...prev };
        if (next[fontId]) delete next[fontId]; else next[fontId] = true;
        return next;
    });
    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedFonts(filteredFonts.reduce((acc, f) => ({ ...acc, [f._id]: true }), {}));
        else setSelectedFonts({});
    };
    const handleBulkDelete = async () => {
        const ids = Object.keys(selectedFonts);
        if (!ids.length) return toast.warn('Chưa chọn font nào.');
        if (window.confirm(`Xoá ${ids.length} font đã chọn? Thiệp đang dùng các font này sẽ hiển thị bằng font mặc định.`)) {
            try {
                await AuthService.bulkDeleteFonts(ids);
                toast.success(`Đã xoá ${ids.length} font.`);
                setSelectedFonts({});
                fetchFonts();
            } catch (e) { /* api.js đã báo lỗi */ }
        }
    };
    const handleBulkUpdateCategory = async () => {
        const ids = Object.keys(selectedFonts);
        if (!ids.length) return toast.warn('Chưa chọn font nào để cập nhật.');
        if (window.confirm(`Đổi loại thành "${CATEGORY_LABEL[bulkCategory]}" cho ${ids.length} font đã chọn?`)) {
            try {
                await AuthService.bulkUpdateFontCategory(ids, bulkCategory);
                toast.success('Cập nhật phân loại thành công.');
                setSelectedFonts({});
                fetchFonts();
            } catch (error) { /* api.js đã báo lỗi */ }
        }
    };
    const handleStartEdit = (font) => {
        setEditingFontId(font._id);
        setEditingFontName(font.name);
        setEditingCategory(CATEGORY_LABEL[font.category] ? font.category : 'General');
    };
    const handleCancelEdit = () => { setEditingFontId(null); setEditingFontName(''); };
    const handleSaveEdit = async (fontId) => {
        try {
            await AuthService.updateFont(fontId, { name: editingFontName.trim(), category: editingCategory });
            toast.success('Cập nhật thành công');
            handleCancelEdit();
            fetchFonts();
        } catch (e) { /* api.js đã báo lỗi */ }
    };

    const selectedCount = Object.keys(selectedFonts).length;
    const isAllSelected = filteredFonts.length > 0 && selectedCount === filteredFonts.length;
    const singleExists = newFontName.trim() && existingKeys.has(keyOf(newFontName));

    return (
        <div className="fm">
            <header className="admin-header fm-head">
                <div>
                    <h1 className="admin-header__title">Font chữ</h1>
                    <p className="fm-sub">{counts.all || 0} font đang có · dùng trong trình thiết kế thiệp của khách và của admin</p>
                </div>
                <button type="button" onClick={() => setIsBulkModalOpen(true)} className="btn btn-primary"><UploadCloud size={17} /> Thêm nhiều font</button>
            </header>

            <div className="card fm-add">
                <h3 className="card__title">Thêm một font</h3>
                <form onSubmit={handleAddFont} className="fm-add__form">
                    <div className="form-group">
                        <label className="form-label" htmlFor="font-file-input">File font (.ttf, .otf, .woff, .woff2)</label>
                        <input id="font-file-input" type="file" className="form-control" onChange={handleFileChange} accept=".ttf,.otf,.woff,.woff2" />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="font-name-input">Tên font</label>
                        <input id="font-name-input" type="text" className="form-control" value={newFontName} onChange={(e) => setNewFontName(e.target.value)} placeholder="Tự điền theo tên file" />
                        {singleExists && <small className="fm-flag">Đã có font tên này: khi cài bạn sẽ được hỏi ghi đè hay huỷ</small>}
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="font-cat-input">Loại font</label>
                        <select id="font-cat-input" className="form-control" value={newFontCategory} onChange={(e) => setNewFontCategory(e.target.value)}>
                            <option value="Wedding">Font cưới</option>
                            <option value="Uppercase">Font viết hoa</option>
                            <option value="Vietnamese">Font tiếng Việt</option>
                            <option value="General">Khác</option>
                        </select>
                    </div>
                    <div className="form-group fm-add__submit">
                        <button type="submit" className="btn btn-primary" disabled={!newFontFile || !!progress}><PlusCircle size={17} /> Cài font</button>
                    </div>
                </form>
            </div>

            <div className="fm-tabs" role="tablist" aria-label="Lọc theo loại font">
                {FONT_CATEGORIES.map(tab => (
                    <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className="fm-tab" onClick={() => setActiveTab(tab.id)}>
                        {tab.label}<span>{counts[tab.id] || 0}</span>
                    </button>
                ))}
            </div>

            <div className="page-header-actions fm-toolbar">
                <div className="search-box" style={{ flexGrow: 1 }}>
                    <Search size={18} className="search-box__icon" />
                    <input type="text" placeholder="Tìm theo tên font…" className="form-control" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Tìm font" />
                </div>
                {selectedCount > 0 && (
                    <div className="fm-bulk">
                        <span>Đã chọn {selectedCount}</span>
                        <select className="form-control" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} aria-label="Loại mới">
                            <option value="Wedding">Font cưới</option>
                            <option value="Uppercase">Font viết hoa</option>
                            <option value="Vietnamese">Tiếng Việt</option>
                            <option value="General">Khác</option>
                        </select>
                        <button onClick={handleBulkUpdateCategory} className="btn btn-secondary">Đổi loại</button>
                        <button onClick={handleBulkDelete} className="btn btn-danger"><Trash2 size={16} /> Xoá</button>
                    </div>
                )}
            </div>

            <div className="table-container" style={{ marginTop: '1rem' }}>
                {isLoading && !fonts.length ? <p className="fm-empty">Đang tải…</p> : filteredFonts.length === 0 ? (
                    <p className="fm-empty">{searchTerm ? `Không có font nào khớp "${searchTerm}".` : 'Chưa có font trong mục này.'}</p>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th style={{ width: '48px' }}><input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} aria-label="Chọn tất cả" /></th>
                                <th>Tên font</th>
                                <th>Xem trước</th>
                                <th style={{ width: '90px' }}>Sửa</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFonts.map(font => (
                                <tr key={font._id}>
                                    <td><input type="checkbox" checked={!!selectedFonts[font._id]} onChange={() => handleSelectFont(font._id)} aria-label={`Chọn ${font.name}`} /></td>
                                    <td onDoubleClick={() => handleStartEdit(font)}>
                                        {editingFontId === font._id ? (
                                            <div className="fm-edit">
                                                <input type="text" value={editingFontName} onChange={(e) => setEditingFontName(e.target.value)} className="form-control" aria-label="Tên font" />
                                                <select value={editingCategory} onChange={(e) => setEditingCategory(e.target.value)} className="form-control" aria-label="Loại font">
                                                    {FONT_CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                                </select>
                                                <div className="fm-edit__actions">
                                                    <button onClick={() => handleSaveEdit(font._id)} className="btn btn-sm btn-primary"><Save size={14} /> Lưu</button>
                                                    <button onClick={handleCancelEdit} className="btn btn-sm btn-secondary"><X size={14} /> Huỷ</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="fm-name"><strong>{font.name}</strong><span className={`fm-badge fm-badge--${font.category || 'General'}`}>{CATEGORY_LABEL[font.category] || 'Khác'}</span></div>
                                        )}
                                    </td>
                                    <td className="fm-preview"><FontSample family={font.name} src={font.url} text="Thiệp cưới Minh & An 2026" lazy /></td>
                                    <td className="table__actions">
                                        <button onClick={() => handleStartEdit(font)} className="edit-btn" title="Sửa tên, loại"><Edit size={18} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <BulkAddFontModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                onSave={handleSaveBulkFonts}
                defaultCategory={activeTab === 'all' ? 'General' : activeTab}
                existingKeys={existingKeys}
            />
            <ConflictResolveModal
                pending={pending}
                onChoose={(key, choice) => setPending(p => ({ ...p, choices: { ...p.choices, [key]: choice } }))}
                onChooseAll={(choice) => setPending(p => ({ ...p, choices: Object.fromEntries(p.conflicts.map(c => [c.key, choice])) }))}
                onCancel={() => { setPending(null); toast.info('Đã huỷ cài đặt, chưa có font nào được thay đổi.'); }}
                onContinue={continueInstall}
            />
            <InstallProgress progress={progress} />
            <InstallResult result={result} onClose={() => setResult(null)} />
        </div>
    );
};

export default FontManagementPage;
