// Nạp trước backend khi kiểm thử: thay R2 và fal.ai bằng bản giả (không gọi dịch vụ thật)
const Module = require('module');
const crypto = require('crypto');
const origLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  const real = origLoad.apply(this, arguments);
  if (/r2\.service(\.js)?$/.test(request)) {
    return {
      ...real,
      uploadFileToR2: async (buf, mime) => {
        const key = crypto.randomBytes(8).toString('hex');
        // Môi trường chạy thử giao diện: lưu tệp ra thư mục để máy chủ ảnh giả phục vụ lại
        if (process.env.FAKE_R2_DIR) {
          const fs = require('fs');
          const p = require('path');
          fs.writeFileSync(p.join(process.env.FAKE_R2_DIR, key), buf);
          fs.writeFileSync(p.join(process.env.FAKE_R2_DIR, `${key}.mime`), mime);
          return { key, url: `${process.env.FAKE_R2_BASE}/r2/${key}` };
        }
        return { key, url: `https://r2.test/${key}?type=${encodeURIComponent(mime)}&bytes=${buf.length}` };
      },
      deleteFileFromR2: async () => {},
    };
  }
  if (request === '@fal-ai/client') {
    return {
      fal: {
        config() {},
        subscribe: async (model, { input }) => {
          global.__falCalls = (global.__falCalls || []);
          global.__falCalls.push({ model, input });
          const base = process.env.FAKE_IMG_BASE;
          return { images: Array.from({ length: input.num_images || 1 }, (_, i) => ({ url: `${base}/img${i}.png` })) };
        },
      },
    };
  }
  return real;
};
