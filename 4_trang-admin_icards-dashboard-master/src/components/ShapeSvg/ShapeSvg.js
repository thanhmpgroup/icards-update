// src/Components/ShapeSvg/ShapeSvg.js
// Vẽ khối hình (phần tử type 'shape': hình cơ bản, đường kẻ, biểu tượng vector) bằng SVG, lấp đầy khung phần tử.
import React from 'react';
import { shapeSvgPaint } from '../../Utils/shapes';

const ShapeSvg = ({ item, style }) => {
    const p = shapeSvgPaint(item);
    return (
        <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${p.w} ${p.h}`}
            preserveAspectRatio="none"
            style={{ display: 'block', overflow: 'visible', ...style }}
            aria-hidden="true"
        >
            <path
                d={p.d}
                transform={p.transform}
                fill={p.fill}
                stroke={p.stroke}
                strokeWidth={p.strokeWidth}
                strokeDasharray={p.dash || undefined}
                strokeLinecap={p.cap}
                strokeLinejoin="round"
            />
        </svg>
    );
};

export default ShapeSvg;
