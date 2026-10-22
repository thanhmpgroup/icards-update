// src/utils/html.js
// Các hàm xử lý chuỗi trước khi đưa vào HTML (thẻ meta, email) để tránh lỗi XSS.

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const escapeHtml = (value) => (value === undefined || value === null)
    ? ''
    : String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

const NAMED_ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Bỏ thẻ HTML, giải mã entity cơ bản và gom khoảng trắng: "<p>Mô tả&nbsp;mẫu</p>" -> "Mô tả mẫu" */
const stripHtml = (value) => {
    if (!value) return '';
    return String(value)
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
            if (code[0] === '#') {
                const num = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
                return Number.isFinite(num) ? String.fromCodePoint(num) : match;
            }
            return NAMED_ENTITIES[code.toLowerCase()] ?? match;
        })
        .replace(/\s+/g, ' ')
        .trim();
};

/** Cắt chuỗi ở ranh giới từ, thêm "…" nếu bị cắt (dùng cho meta description ~160 ký tự). */
const truncate = (value, max = 160) => {
    const text = String(value || '').trim();
    if (text.length <= max) return text;
    const cut = text.slice(0, max - 1);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
};

/**
 * Tách bài FAQ soạn bằng trình soạn thảo (mỗi câu hỏi là một thẻ <h2>/<h3>, ngay sau là câu trả lời)
 * thành dạng khối mà trang /faq của frontend đọc được:
 * [{ type: 'text', content: 'Câu hỏi' }, { type: 'text', content: '<p>Trả lời</p>' }, ...]
 */
const htmlToFaqBlocks = (html) => {
    const source = String(html || '');
    const headings = [...source.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)];
    return headings.flatMap((match, index) => {
        const answerStart = match.index + match[0].length;
        const answerEnd = index + 1 < headings.length ? headings[index + 1].index : source.length;
        const question = stripHtml(match[1]);
        const answer = source.slice(answerStart, answerEnd).trim();
        return question && stripHtml(answer)
            ? [{ type: 'text', content: question }, { type: 'text', content: answer }]
            : [];
    });
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { escapeHtml, stripHtml, truncate, escapeRegex, htmlToFaqBlocks };
