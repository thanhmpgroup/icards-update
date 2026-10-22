// src/Utils/shapes.js
// Khối hình trong trình thiết kế thiệp: hình học dùng chung cho
//  - hiển thị trên màn hình (SVG, xem components/ShapeSvg)
//  - xuất ảnh/PDF và xem trước (canvas 2D, drawShapeOnCanvas)
// Phần tử: { type: 'shape', shapeType, fill, fillEnabled, stroke, strokeEnabled, strokeWidth, strokeStyle, cornerRadius }
// shapeType 'line' | 'arrow' | 'arrow-both': đường kẻ ngang giữa khung (chỉ có nét).
// shapeType 'path': biểu tượng vector, pathData trong khung viewBox x viewBox (mặc định 24).
// Giữ file này giống hệt bản trong trang admin (icards-dashboard/src/Utils/shapes.js).

export const SHAPE_PRESETS = [
    { shapeType: 'rect', label: 'Chữ nhật', cornerRadius: 0 },
    { shapeType: 'rect', label: 'Bo góc', cornerRadius: 24 },
    { shapeType: 'ellipse', label: 'Tròn' },
    { shapeType: 'arch', label: 'Cổng vòm' },
    { shapeType: 'triangle', label: 'Tam giác' },
    { shapeType: 'diamond', label: 'Thoi' },
    { shapeType: 'star', label: 'Ngôi sao' },
    { shapeType: 'heart', label: 'Trái tim' },
];

// Đường kẻ: phần tử cao 24px để dễ bấm chọn, nét nằm giữa
export const LINE_PRESETS = [
    { shapeType: 'line', label: 'Đường liền', strokeStyle: 'solid' },
    { shapeType: 'line', label: 'Nét đứt', strokeStyle: 'dashed' },
    { shapeType: 'line', label: 'Chấm chấm', strokeStyle: 'dotted' },
    { shapeType: 'arrow', label: 'Mũi tên', strokeStyle: 'solid' },
    { shapeType: 'arrow-both', label: 'Mũi tên hai đầu', strokeStyle: 'solid' },
];

export const isLineShape = (shapeType) => shapeType === 'line' || shapeType === 'arrow' || shapeType === 'arrow-both';

export const SHAPE_COLOR_SWATCHES = [
    '#FFFFFF', '#F8F1E9', '#F3E3E6', '#E8D5B7', '#D4AF37', '#B76E79',
    '#8B1E3F', '#27548A', '#1F4E3D', '#6B7280', '#111827', 'transparent',
];

export const DEFAULT_SHAPE_PROPS = {
    type: 'shape',
    shapeType: 'rect',
    fill: '#F3E3E6',
    fillEnabled: true,
    stroke: '#B76E79',
    strokeEnabled: true,
    strokeWidth: 3,
    strokeStyle: 'solid', // solid | dashed | dotted
    cornerRadius: 0,
};

const f = (n) => Math.round(n * 100) / 100;

const rectPath = (x, y, w, h, r) => {
    const rr = Math.max(0, Math.min(r || 0, w / 2, h / 2));
    if (rr === 0) return `M${f(x)},${f(y)} H${f(x + w)} V${f(y + h)} H${f(x)} Z`;
    return [
        `M${f(x + rr)},${f(y)}`, `H${f(x + w - rr)}`, `A${f(rr)},${f(rr)} 0 0 1 ${f(x + w)},${f(y + rr)}`,
        `V${f(y + h - rr)}`, `A${f(rr)},${f(rr)} 0 0 1 ${f(x + w - rr)},${f(y + h)}`,
        `H${f(x + rr)}`, `A${f(rr)},${f(rr)} 0 0 1 ${f(x)},${f(y + h - rr)}`,
        `V${f(y + rr)}`, `A${f(rr)},${f(rr)} 0 0 1 ${f(x + rr)},${f(y)}`, 'Z',
    ].join(' ');
};

const starPath = (x, y, w, h, points = 5, innerRatio = 0.45) => {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const parts = [];
    for (let i = 0; i < points * 2; i += 1) {
        const outer = i % 2 === 0;
        const angle = -Math.PI / 2 + (i * Math.PI) / points;
        const rx = (w / 2) * (outer ? 1 : innerRatio);
        const ry = (h / 2) * (outer ? 1 : innerRatio);
        parts.push(`${i === 0 ? 'M' : 'L'}${f(cx + rx * Math.cos(angle))},${f(cy + ry * Math.sin(angle))}`);
    }
    return `${parts.join(' ')} Z`;
};

const heartPath = (x, y, w, h) => {
    const X = (u) => f(x + u * w);
    const Y = (v) => f(y + v * h);
    return [
        `M${X(0.5)},${Y(0.25)}`,
        `C${X(0.5)},${Y(0.1)} ${X(0.35)},${Y(0)} ${X(0.2)},${Y(0)}`,
        `C${X(0.05)},${Y(0)} ${X(0)},${Y(0.15)} ${X(0)},${Y(0.3)}`,
        `C${X(0)},${Y(0.55)} ${X(0.25)},${Y(0.75)} ${X(0.5)},${Y(1)}`,
        `C${X(0.75)},${Y(0.75)} ${X(1)},${Y(0.55)} ${X(1)},${Y(0.3)}`,
        `C${X(1)},${Y(0.15)} ${X(0.95)},${Y(0)} ${X(0.8)},${Y(0)}`,
        `C${X(0.65)},${Y(0)} ${X(0.5)},${Y(0.1)} ${X(0.5)},${Y(0.25)}`,
        'Z',
    ].join(' ');
};

/**
 * Đường viền SVG của khối hình trong hộp (0,0)-(w,h).
 * Khi có viền, hình được thu vào nửa độ dày viền để viền nằm trọn trong khung phần tử.
 */
const linePath = (item, w, h) => {
    const sw = Math.max(1, Number(item.strokeWidth) || 1);
    const cy = h / 2;
    const hs = Math.min(Math.max(6, sw * 3), w / 3, h / 2 + sw * 3);
    let d = `M${f(0)},${f(cy)} H${f(w)}`;
    if (item.shapeType === 'arrow' || item.shapeType === 'arrow-both') d += ` M${f(w - hs)},${f(cy - hs)} L${f(w)},${f(cy)} L${f(w - hs)},${f(cy + hs)}`;
    if (item.shapeType === 'arrow-both') d += ` M${f(hs)},${f(cy - hs)} L0,${f(cy)} L${f(hs)},${f(cy + hs)}`;
    return d;
};

export const getShapePath = (item, w, h) => {
    if (isLineShape(item.shapeType)) return linePath(item, w, h);
    const sw = item.strokeEnabled ? Math.max(0, Number(item.strokeWidth) || 0) : 0;
    const x = sw / 2;
    const y = sw / 2;
    const iw = Math.max(1, w - sw);
    const ih = Math.max(1, h - sw);

    switch (item.shapeType) {
        case 'ellipse': {
            const rx = iw / 2;
            const ry = ih / 2;
            const cy = y + ry;
            return `M${f(x)},${f(cy)} A${f(rx)},${f(ry)} 0 1 0 ${f(x + iw)},${f(cy)} A${f(rx)},${f(ry)} 0 1 0 ${f(x)},${f(cy)} Z`;
        }
        case 'triangle':
            return `M${f(x + iw / 2)},${f(y)} L${f(x + iw)},${f(y + ih)} L${f(x)},${f(y + ih)} Z`;
        case 'diamond':
            return `M${f(x + iw / 2)},${f(y)} L${f(x + iw)},${f(y + ih / 2)} L${f(x + iw / 2)},${f(y + ih)} L${f(x)},${f(y + ih / 2)} Z`;
        case 'star':
            return starPath(x, y, iw, ih);
        case 'heart':
            return heartPath(x, y, iw, ih);
        case 'arch': {
            const r = Math.min(iw / 2, ih);
            return `M${f(x)},${f(y + ih)} V${f(y + r)} A${f(iw / 2)},${f(r)} 0 0 1 ${f(x + iw)},${f(y + r)} V${f(y + ih)} Z`;
        }
        case 'rect':
        default:
            return rectPath(x, y, iw, ih, item.cornerRadius);
    }
};

export const getStrokeDash = (item) => {
    const sw = Math.max(1, Number(item.strokeWidth) || 1);
    if (item.strokeStyle === 'dashed') return [sw * 3, sw * 2];
    if (item.strokeStyle === 'dotted') return [0.1, sw * 2];
    return [];
};

const isPaint = (color) => color && color !== 'transparent';

/**
 * Vẽ khối hình lên canvas 2D. (originX, originY) là góc trên trái của phần tử
 * trong hệ toạ độ hiện tại của ctx (đã xoay/dịch nếu cần).
 */
// Biểu tượng vector: vẽ trong khung viewBox rồi phóng theo kích thước phần tử.
// Độ dày nét quy về đơn vị viewBox để nét trông bằng strokeWidth px (giống ShapeSvg).
// Nét vẽ tay / chữ ký: khung gốc chữ nhật viewBoxW x viewBoxH (toạ độ điểm vẽ lúc tạo).
export const pathIconScale = (item) => {
    const vb = Number(item.viewBox) > 0 ? Number(item.viewBox) : 24;
    const vbw = Number(item.viewBoxW) > 0 ? Number(item.viewBoxW) : vb;
    const vbh = Number(item.viewBoxH) > 0 ? Number(item.viewBoxH) : vb;
    const sx = (Number(item.width) || vbw) / vbw;
    const sy = (Number(item.height) || vbh) / vbh;
    return { vb, sx, sy, avg: (sx + sy) / 2 || 1 };
};

const drawPathIcon = (ctx, item) => {
    const { sx, sy, avg } = pathIconScale(item);
    const path = new Path2D(item.pathData || '');
    ctx.scale(sx, sy);
    if (item.fillEnabled !== false && isPaint(item.fill)) {
        ctx.fillStyle = item.fill;
        ctx.fill(path);
    }
    if (item.strokeEnabled !== false && isPaint(item.stroke) && Number(item.strokeWidth) > 0) {
        ctx.strokeStyle = item.stroke;
        ctx.lineWidth = Number(item.strokeWidth) / avg;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.setLineDash(getStrokeDash(item).map(v => v / avg));
        ctx.stroke(path);
    }
};

export const drawShapeOnCanvas = (ctx, item, originX, originY) => {
    if (typeof Path2D === 'undefined') return;
    if (item.shapeType === 'path') {
        ctx.save();
        ctx.translate(originX, originY);
        drawPathIcon(ctx, item);
        ctx.restore();
        return;
    }
    const path = new Path2D(getShapePath(item, item.width, item.height));
    ctx.save();
    ctx.translate(originX, originY);
    if (!isLineShape(item.shapeType) && item.fillEnabled !== false && isPaint(item.fill)) {
        ctx.fillStyle = item.fill;
        ctx.fill(path);
    }
    if ((item.strokeEnabled || isLineShape(item.shapeType)) && isPaint(item.stroke) && Number(item.strokeWidth) > 0) {
        ctx.strokeStyle = item.stroke;
        ctx.lineWidth = Number(item.strokeWidth);
        ctx.lineJoin = 'round';
        ctx.lineCap = item.strokeStyle === 'dotted' || isLineShape(item.shapeType) ? 'round' : 'butt';
        ctx.setLineDash(getStrokeDash(item));
        ctx.stroke(path);
    }
    ctx.restore();
};

const escapeAttr = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Chuỗi SVG của khối hình (dùng khi xuất ảnh bằng html2canvas: đưa vào <img src="data:image/svg+xml...">). */
/** Thuộc tính vẽ dùng chung cho ShapeSvg và shapeSvgMarkup. */
export const shapeSvgPaint = (item) => {
    const w = Math.max(1, Number(item.width) || 1);
    const h = Math.max(1, Number(item.height) || 1);
    const line = isLineShape(item.shapeType);
    const hasFill = !line && item.fillEnabled !== false && isPaint(item.fill);
    const strokeOn = line || (item.shapeType === 'path' ? item.strokeEnabled !== false : !!item.strokeEnabled);
    const hasStroke = strokeOn && isPaint(item.stroke) && Number(item.strokeWidth) > 0;
    if (item.shapeType === 'path') {
        const { sx, sy, avg } = pathIconScale(item);
        return {
            w, h, d: item.pathData || '', transform: `scale(${f(sx)} ${f(sy)})`,
            fill: hasFill ? item.fill : 'none', stroke: hasStroke ? item.stroke : 'none',
            strokeWidth: hasStroke ? Number(item.strokeWidth) / avg : 0,
            dash: hasStroke ? getStrokeDash(item).map(v => f(v / avg)).join(' ') : '',
            cap: 'round',
        };
    }
    return {
        w, h, d: getShapePath(item, w, h), transform: undefined,
        fill: hasFill ? item.fill : 'none', stroke: hasStroke ? item.stroke : 'none',
        strokeWidth: hasStroke ? Number(item.strokeWidth) : 0,
        dash: hasStroke ? getStrokeDash(item).join(' ') : '',
        cap: item.strokeStyle === 'dotted' || line ? 'round' : 'butt',
    };
};

export const shapeSvgMarkup = (item) => {
    const p = shapeSvgPaint(item);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}" viewBox="0 0 ${p.w} ${p.h}" overflow="visible">`
        + `<path d="${escapeAttr(p.d)}"${p.transform ? ` transform="${p.transform}"` : ''} fill="${escapeAttr(p.fill)}"`
        + ` stroke="${escapeAttr(p.stroke)}" stroke-width="${p.strokeWidth}"`
        + `${p.dash ? ` stroke-dasharray="${p.dash}"` : ''} stroke-linecap="${p.cap}" stroke-linejoin="round"/></svg>`;
};

export const shapeSvgDataUrl = (item) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(shapeSvgMarkup(item))}`;
