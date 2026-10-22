// src/utils/fileSniff.js
// Nhận dạng tệp theo nội dung (magic bytes), không tin đuôi tên hay Content-Type trình duyệt gửi lên.

const startsWith = (buf, bytes, offset = 0) => bytes.every((b, i) => buf[offset + i] === b);
const ascii = (buf, str, offset = 0) => startsWith(buf, [...str].map(c => c.charCodeAt(0)), offset);

/** Nhạc: trả về { mime, ext } hoặc null */
const detectAudio = (buf) => {
    if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
    if (ascii(buf, 'ID3') || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return { mime: 'audio/mpeg', ext: 'mp3' };
    if (ascii(buf, 'ftyp', 4)) return { mime: 'audio/mp4', ext: 'm4a' };
    if (ascii(buf, 'OggS')) return { mime: 'audio/ogg', ext: 'ogg' };
    if (ascii(buf, 'RIFF') && ascii(buf, 'WAVE', 8)) return { mime: 'audio/wav', ext: 'wav' };
    if (ascii(buf, 'fLaC')) return { mime: 'audio/flac', ext: 'flac' };
    if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: 'audio/webm', ext: 'webm' };
    return null;
};

/** Font: trả về { mime, format } hoặc null (format dùng cho @font-face) */
const detectFont = (buf) => {
    if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
    if (ascii(buf, 'wOF2')) return { mime: 'font/woff2', format: 'woff2' };
    if (ascii(buf, 'wOFF')) return { mime: 'font/woff', format: 'woff' };
    if (ascii(buf, 'OTTO')) return { mime: 'font/otf', format: 'opentype' };
    if (startsWith(buf, [0x00, 0x01, 0x00, 0x00]) || ascii(buf, 'true')) return { mime: 'font/ttf', format: 'truetype' };
    return null;
};

/** Tên font từ tên tệp: bỏ đuôi, chỉ giữ chữ (kể cả có dấu), số, khoảng trắng, gạch */
const fontNameFromFile = (originalName = '') => {
    const base = String(originalName).replace(/\.[^.]+$/, '').normalize('NFC');
    const clean = base.replace(/[^\p{L}\p{N} _-]+/gu, ' ').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    return clean || 'Font riêng';
};

module.exports = { detectAudio, detectFont, fontNameFromFile };
