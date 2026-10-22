// src/Pages/AdminDashboard/BannerTextPositioner.js
// Xem trước banner và KÉO THẢ khung chữ (tiêu đề, tiêu đề phụ, nút) tới vị trí bất kỳ,
// kéo góc phải để co giãn bề rộng. Vị trí lưu theo % kích thước banner (textBox.x, y, width),
// cỡ chữ theo bề rộng banner (cqw), nên trang web hiển thị giống hệt bản xem trước này.
import React, { useRef } from 'react';

export const DEFAULT_TEXT_BOX = { x: 8, y: 50, width: 45, align: 'left', color: '#ffffff', scale: 1 };

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const BannerTextPositioner = ({ banner, onChange }) => {
    const frameRef = useRef(null);
    const box = { ...DEFAULT_TEXT_BOX, ...(banner.textBox || {}) };
    const isVideo = banner.mediaType === 'video';
    const mediaUrl = isVideo ? banner.videoUrl : banner.imageUrl;
    const hasText = banner.title || banner.subtitle || (banner.buttonText && banner.buttonLink);
    const overlay = typeof banner.overlayOpacity === 'number' ? banner.overlayOpacity : 0;

    const startDrag = (mode) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        const frame = frameRef.current;
        if (!frame) return;
        const rect = frame.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const start = { ...box };

        const onMove = (ev) => {
            const dx = ((ev.clientX - startX) / rect.width) * 100;
            const dy = ((ev.clientY - startY) / rect.height) * 100;
            if (mode === 'move') {
                onChange({
                    ...start,
                    x: Math.round(clamp(start.x + dx, 0, 100 - start.width) * 10) / 10,
                    y: Math.round(clamp(start.y + dy, 0, 100) * 10) / 10,
                });
            } else {
                onChange({ ...start, width: Math.round(clamp(start.width + dx, 10, 100 - start.x) * 10) / 10 });
            }
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    // Dùng bàn phím: mũi tên dịch 1%, Shift + mũi tên dịch 5%
    const onKeyDown = (e) => {
        const step = e.shiftKey ? 5 : 1;
        const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (!moves[e.key]) return;
        e.preventDefault();
        const [dx, dy] = moves[e.key];
        onChange({ ...box, x: clamp(box.x + dx, 0, 100 - box.width), y: clamp(box.y + dy, 0, 100) });
    };

    return (
        <div className="banner-positioner">
            <div className="banner-positioner__frame" ref={frameRef}>
                {mediaUrl ? (
                    isVideo
                        ? <video src={mediaUrl} autoPlay loop muted playsInline className="banner-positioner__media" />
                        : <img src={mediaUrl} alt="" className="banner-positioner__media" />
                ) : (
                    <div className="banner-positioner__empty">Tải ảnh hoặc video banner lên để xem trước</div>
                )}
                {overlay > 0 && <div className="banner-positioner__overlay" style={{ backgroundColor: `rgba(0,0,0,${overlay})` }} />}

                {hasText && (
                    <div
                        className="banner-positioner__box"
                        role="button"
                        tabIndex={0}
                        aria-label="Khung chữ banner: kéo để di chuyển, dùng phím mũi tên để dịch"
                        onPointerDown={startDrag('move')}
                        onKeyDown={onKeyDown}
                        style={{
                            left: `${box.x}%`,
                            top: `${box.y}%`,
                            width: `${box.width}%`,
                            color: box.color,
                            textAlign: box.align,
                        }}
                    >
                        {banner.title && <div style={{ fontSize: `clamp(10px, ${3.6 * box.scale}cqw, 72px)`, fontWeight: 700, lineHeight: 1.2, marginBottom: '0.4em' }}>{banner.title}</div>}
                        {banner.subtitle && <div style={{ fontSize: `clamp(8px, ${1.7 * box.scale}cqw, 30px)`, fontWeight: 500, lineHeight: 1.45 }}>{banner.subtitle}</div>}
                        {banner.buttonText && banner.buttonLink && (
                            <span className="banner-positioner__btn">{banner.buttonText}</span>
                        )}
                        <span
                            className="banner-positioner__resize"
                            onPointerDown={startDrag('resize')}
                            title="Kéo để đổi bề rộng khung chữ"
                        />
                    </div>
                )}
            </div>

            <div className="banner-positioner__controls">
                <span className="banner-positioner__hint">
                    {hasText
                        ? 'Kéo khung chữ để đặt vị trí, kéo góc phải dưới để co giãn.'
                        : 'Nhập tiêu đề, tiêu đề phụ hoặc nút bấm để hiện khung chữ trên banner.'}
                </span>
                <div className="banner-positioner__row">
                    <label>Căn chữ
                        <select value={box.align} onChange={(e) => onChange({ ...box, align: e.target.value })}>
                            <option value="left">Trái</option>
                            <option value="center">Giữa</option>
                            <option value="right">Phải</option>
                        </select>
                    </label>
                    <label>Màu chữ
                        <input type="color" value={box.color} onChange={(e) => onChange({ ...box, color: e.target.value })} />
                    </label>
                    <label>Cỡ chữ
                        <input type="range" min="0.6" max="1.8" step="0.1" value={box.scale} onChange={(e) => onChange({ ...box, scale: Number(e.target.value) })} />
                    </label>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange({ ...DEFAULT_TEXT_BOX })}>Đặt lại vị trí</button>
                </div>
            </div>
        </div>
    );
};

export default BannerTextPositioner;
