// src/services/ai.service.js
const { fal } = require("@fal-ai/client"); 
const axios = require('axios');
const { uploadFileToR2 } = require('./r2.service');

// Config Fal.ai
fal.config({
    credentials: process.env.FAL_KEY, 
});

/**
 * Helper: Tải ảnh từ URL về Buffer để upload lên R2
 */
const downloadImageToBuffer = async (url) => {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'arraybuffer'
    });
    return Buffer.from(response.data, 'binary');
};

/**
 * Quy trình Hybrid: Tạo nền Tết (Flux Schnell) -> Ghép mặt (Face Swap) -> Lưu R2
 * @param {string} userFaceUrl - URL ảnh khuôn mặt người dùng (đã có trên R2/Cloudflare)
 * @param {string} prompt - Mô tả bức ảnh mong muốn
 * @returns {Promise<object>} - Trả về URL ảnh cuối cùng trên R2 của bạn
 */
const generateHybridTetCard = async (userFaceUrl, prompt) => {
    try {
        console.log("AI Service: Đang tạo bối cảnh Tết với Flux Schnell...");
        
        const enhancedPrompt = `${prompt}, Vietnamese Tet holiday atmosphere, photorealistic, 8k, cinematic lighting, highly detailed, depth of field`;

        const bgResult = await fal.subscribe("fal-ai/flux/schnell", {
            input: {
                prompt: enhancedPrompt,
                image_size: "portrait_4_3",
                num_inference_steps: 4,
                seed: Math.floor(Math.random() * 1000000),
                enable_safety_checker: false
            },
        });

        if (!bgResult.images || !bgResult.images[0]) {
            throw new Error("Flux Schnell không trả về ảnh.");
        }
        const bgUrl = bgResult.images[0].url;

        console.log("AI Service: Đang ghép mặt...");
        const swapResult = await fal.subscribe("fal-ai/face-swap", {
            input: {
                base_image_url: bgUrl,
                swap_image_url: userFaceUrl
            }
        });

        const finalFalUrl = swapResult.image?.url || swapResult.images?.[0]?.url;

        if (!finalFalUrl) {
            throw new Error("Face Swap thất bại.");
        }

        console.log("AI Service: Đang lưu ảnh vào R2...");
        const imageBuffer = await downloadImageToBuffer(finalFalUrl);
        
        const r2Data = await uploadFileToR2(imageBuffer, 'image/jpeg');

        return {
            finalUrl: r2Data.url,
            cfKey: r2Data.key,
            tempBg: bgUrl
        };

    } catch (error) {
        console.error("AI Service Error:", error);
        if (error.message?.includes("balance") || error.body?.detail?.includes("locked")) {
            throw new Error("EXHAUSTED_BALANCE");
        }
        throw error;
    }
};

// ================== Tạo ảnh nền / hoạ tiết thiệp bằng AI (trình thiết kế) ==================
const sharp = require('sharp');

const CARD_STYLES = {
    'watercolor-floral': 'soft watercolor florals, blush pink and sage green, delicate wedding stationery background, elegant, paper texture',
    'minimal-luxury': 'minimal luxury invitation background, ivory textured paper, subtle gold foil lines and corners, refined, elegant',
    'vintage': 'vintage engraved botanical border, aged cream paper, antique ink illustration, classic stationery',
    'tet': 'Vietnamese Lunar New Year, red and gold, apricot and peach blossoms, paper lanterns, festive yet elegant',
    'birthday': 'cheerful birthday party background, pastel balloons, confetti, ribbons, playful and bright',
    'baby': 'baby first month celebration, soft pastel clouds, stars, cute gentle illustration',
    'corporate': 'modern corporate event background, navy blue and gold geometric shapes, premium, clean',
    'nature': 'romantic nature landscape, soft golden light, dreamy atmosphere, fine art photography',
};

// Một số từ tiếng Việt hay gặp -> tiếng Anh (mô hình ảnh hiểu tiếng Anh tốt hơn)
const VI_HINTS = [
    [/hoa\s*h[ồo]ng/i, 'roses'], [/hoa\s*sen/i, 'lotus flowers'], [/hoa\s*mai/i, 'yellow apricot blossoms'], [/hoa\s*đào|hoa\s*dao/i, 'peach blossoms'],
    [/hoa\s*cúc/i, 'daisies'], [/hoa\s*lan/i, 'orchids'], [/\bhoa\b/i, 'flowers'], [/\blá\b/i, 'leaves'],
    [/đỏ/i, 'red'], [/vàng/i, 'gold'], [/hồng/i, 'pink'], [/xanh\s*lá/i, 'green'], [/xanh\s*dương|xanh\s*biển/i, 'blue'], [/trắng/i, 'white'], [/tím/i, 'purple'], [/đen/i, 'black'], [/kem/i, 'cream'],
    [/cưới/i, 'wedding'], [/biển/i, 'beach'], [/núi/i, 'mountains'], [/trăng/i, 'moon'], [/sao\b/i, 'stars'], [/bướm/i, 'butterflies'], [/chim/i, 'birds'],
    [/tối\s*giản/i, 'minimalist'], [/sang\s*trọng/i, 'luxurious'], [/cổ\s*điển/i, 'vintage'], [/màu\s*nước/i, 'watercolor'], [/dễ\s*thương/i, 'cute'],
];
const viToEnHints = (text = '') => VI_HINTS.filter(([re]) => re.test(text)).map(([, en]) => en).join(', ');

const ASPECT_SIZES = { portrait: 'portrait_4_3', tall: 'portrait_16_9', square: 'square_hd', landscape: 'landscape_4_3' };

/**
 * Tạo 2 ảnh nền thiệp, lưu lên R2.
 * @returns {Promise<string[]>} các URL ảnh trên R2
 */
const generateCardArt = async ({ prompt = '', style = 'watercolor-floral', aspect = 'portrait' }) => {
    const styleText = CARD_STYLES[style] || CARD_STYLES['watercolor-floral'];
    const userText = String(prompt).slice(0, 300);
    const hints = viToEnHints(userText);
    const fullPrompt = [
        styleText,
        userText && `${userText}${hints ? ` (${hints})` : ''}`,
        'invitation card background artwork, large calm empty area in the center for text, no text, no letters, no words, no watermark, high quality',
    ].filter(Boolean).join('. ');
    try {
        const result = await fal.subscribe('fal-ai/flux/schnell', {
            input: {
                prompt: fullPrompt,
                image_size: ASPECT_SIZES[aspect] || ASPECT_SIZES.portrait,
                num_inference_steps: 4,
                num_images: 2,
                enable_safety_checker: true, // ảnh do khách yêu cầu: bật lọc nội dung
            },
        });
        const images = (result.images || result.data?.images || []).map(i => i.url).filter(Boolean);
        if (images.length === 0) throw new Error('AI không trả về ảnh.');
        const urls = [];
        for (const url of images) {
            // eslint-disable-next-line no-await-in-loop
            const raw = await downloadImageToBuffer(url);
            // eslint-disable-next-line no-await-in-loop
            const webp = await sharp(raw).webp({ quality: 90 }).toBuffer();
            // eslint-disable-next-line no-await-in-loop
            const saved = await uploadFileToR2(webp, 'image/webp');
            urls.push(saved.url);
        }
        return urls;
    } catch (error) {
        console.error('AI card art error:', error?.message || error);
        if (error.message?.includes('balance') || error.body?.detail?.includes?.('locked') || error.status === 403) {
            throw new Error('EXHAUSTED_BALANCE');
        }
        throw error;
    }
};

module.exports = {
    generateHybridTetCard,
    generateCardArt,
    CARD_STYLES,
    viToEnHints,
};