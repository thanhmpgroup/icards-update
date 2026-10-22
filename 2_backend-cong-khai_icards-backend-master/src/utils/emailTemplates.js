// src/utils/emailTemplates.js
// Giao diện email thống nhất theo nhận diện iCards.
// Dùng bảng + style inline để hiển thị đúng trên Gmail, Outlook, Apple Mail và điện thoại.
const { escapeHtml } = require('./html');
const { SITE_URL, BRAND_NAME, BRAND_COLOR } = require('../config/site');

const COLORS = {
    brand: BRAND_COLOR,
    brandDark: '#1B3D66',
    accent: '#C9A45C',
    page: '#F3F5F9',
    card: '#FFFFFF',
    border: '#E4E8F0',
    text: '#1F2937',
    muted: '#6B7280',
    soft: '#F6F8FC',
};

const FONT = "'Be Vietnam Pro', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Đổi xuống dòng thành <br> sau khi đã escape nội dung người dùng nhập. */
const textToHtml = (text) => escapeHtml(text).replace(/\r?\n/g, '<br>');

const button = (label, url) => `
<table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 28px auto 8px;">
  <tr>
    <td align="center" bgcolor="${COLORS.brand}" style="border-radius: 8px;">
      <a href="${escapeHtml(url)}" target="_blank"
         style="display: inline-block; padding: 14px 32px; font-family: ${FONT}; font-size: 16px; font-weight: 600; line-height: 20px; color: #FFFFFF; text-decoration: none; border-radius: 8px; border: 1px solid ${COLORS.brandDark};">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`;

/**
 * Khung email dùng chung.
 * @param {object} options
 * @param {string} options.title - Tiêu đề thẻ <title> (thường trùng subject).
 * @param {string} options.preheader - Dòng xem trước hiển thị cạnh tiêu đề trong hộp thư.
 * @param {string} options.eyebrow - Nhãn nhỏ phía trên tiêu đề nội dung.
 * @param {string} options.heading - Tiêu đề lớn trong thân email (đã là text thuần).
 * @param {string} options.bodyHtml - Nội dung chính (HTML đã escape).
 * @param {{label: string, url: string}} [options.cta] - Nút hành động chính.
 * @param {string} [options.footnote] - Ghi chú nhỏ cuối thẻ (text thuần).
 */
const renderEmailLayout = ({ title, preheader, eyebrow, heading, bodyHtml, cta, footnote }) => `<!DOCTYPE html>
<html lang="vi" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: ${COLORS.page}; -webkit-text-size-adjust: 100%;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all;">${escapeHtml(preheader || '')}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${COLORS.page};">
    <tr>
      <td align="center" style="padding: 32px 12px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 0 0 20px;">
              <a href="${SITE_URL}" target="_blank" style="font-family: ${FONT}; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; color: ${COLORS.brand}; text-decoration: none;">
                <span style="color: ${COLORS.accent};">i</span>Cards
              </a>
            </td>
          </tr>
          <!-- Thẻ nội dung -->
          <tr>
            <td style="background-color: ${COLORS.card}; border: 1px solid ${COLORS.border}; border-radius: 14px; overflow: hidden;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr><td style="height: 4px; line-height: 4px; font-size: 0; background-color: ${COLORS.brand};">&nbsp;</td></tr>
                <tr>
                  <td style="padding: 40px 40px 36px; font-family: ${FONT}; color: ${COLORS.text};">
                    ${eyebrow ? `<p style="margin: 0 0 10px; font-size: 12px; font-weight: 600; letter-spacing: 1.6px; text-transform: uppercase; color: ${COLORS.accent}; text-align: center;">${escapeHtml(eyebrow)}</p>` : ''}
                    <h1 style="margin: 0 0 24px; font-size: 24px; line-height: 32px; font-weight: 700; color: ${COLORS.brandDark}; text-align: center;">${escapeHtml(heading)}</h1>
                    <div style="font-size: 16px; line-height: 26px; color: ${COLORS.text}; text-align: center;">
                      ${bodyHtml}
                    </div>
                    ${cta ? button(cta.label, cta.url) : ''}
                    ${cta ? `<p style="margin: 18px 0 0; font-size: 13px; line-height: 20px; color: ${COLORS.muted}; text-align: center;">
                      Nút không bấm được? Sao chép đường dẫn sau vào trình duyệt:<br>
                      <a href="${escapeHtml(cta.url)}" target="_blank" style="color: ${COLORS.brand}; word-break: break-all;">${escapeHtml(cta.url)}</a>
                    </p>` : ''}
                    ${footnote ? `<p style="margin: 28px 0 0; padding-top: 20px; border-top: 1px solid ${COLORS.border}; font-size: 13px; line-height: 20px; color: ${COLORS.muted}; text-align: center;">${escapeHtml(footnote)}</p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Chân trang -->
          <tr>
            <td align="center" style="padding: 24px 16px 0; font-family: ${FONT}; font-size: 12px; line-height: 19px; color: ${COLORS.muted};">
              Gửi từ <a href="${SITE_URL}" target="_blank" style="color: ${COLORS.brand}; text-decoration: none; font-weight: 600;">${BRAND_NAME}</a> · Nền tảng thiệp mời online<br>
              © ${new Date().getFullYear()} ${BRAND_NAME}. Bảo lưu mọi quyền.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/**
 * Email thiệp mời gửi tới từng khách (và email nhắc lịch khi có daysLeft).
 * Mọi tham số là text thuần, hàm tự escape.
 */
const invitationEmail = ({ subject, salutation, guestName, message, invitationUrl, daysLeft = null }) => {
    const isReminder = Number.isInteger(daysLeft) && daysLeft >= 0;
    const greeting = [salutation, guestName].filter(Boolean).join(' ').trim();
    // Lời mời mặc định đã mở đầu bằng "{LờiXưngHô} {TênKháchMời}" -> không lặp lại lời chào ở tiêu đề
    const messageHasGreeting = greeting && String(message || '').toLowerCase().startsWith(greeting.toLowerCase());
    const heading = greeting && !messageHasGreeting ? `${greeting},` : 'Thiệp mời dành riêng cho bạn';
    const reminderLine = isReminder
        ? (daysLeft === 0 ? 'Sự kiện diễn ra ngay hôm nay.' : `Chỉ còn ${daysLeft} ngày nữa là đến sự kiện.`)
        : '';

    const bodyHtml = `
      ${reminderLine ? `<p style="margin: 0 0 18px; padding: 12px 16px; background-color: ${COLORS.soft}; border-radius: 8px; font-weight: 600; color: ${COLORS.brandDark};">${escapeHtml(reminderLine)}</p>` : ''}
      ${message ? `<p style="margin: 0;">${textToHtml(message)}</p>` : ''}`;

    const html = renderEmailLayout({
        title: subject,
        preheader: isReminder ? reminderLine : 'Bạn vừa nhận được một thiệp mời trực tuyến. Mở thiệp để xem chi tiết và xác nhận tham dự.',
        eyebrow: isReminder ? 'Nhắc lịch sự kiện' : 'Thiệp mời trực tuyến',
        heading,
        bodyHtml,
        cta: { label: 'Mở thiệp mời', url: invitationUrl },
        footnote: 'Bạn nhận được email này vì có tên trong danh sách khách mời của sự kiện. Hãy mở thiệp để xem thời gian, địa điểm và gửi xác nhận tham dự.',
    });

    const text = [
        greeting && !messageHasGreeting ? `${greeting},` : '',
        reminderLine,
        message || '',
        `Mở thiệp mời: ${invitationUrl}`,
        `— ${BRAND_NAME} · ${SITE_URL}`,
    ].filter(Boolean).join('\n\n');

    return { html, text };
};

const passwordResetEmail = ({ resetUrl, expiresInMinutes = 10 }) => {
    const bodyHtml = `
      <p style="margin: 0 0 12px;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản ${BRAND_NAME} của bạn.</p>
      <p style="margin: 0;">Bấm nút bên dưới để tạo mật khẩu mới. Liên kết có hiệu lực trong <strong>${expiresInMinutes} phút</strong>.</p>`;

    const html = renderEmailLayout({
        title: `Đặt lại mật khẩu ${BRAND_NAME}`,
        preheader: `Liên kết đặt lại mật khẩu có hiệu lực trong ${expiresInMinutes} phút.`,
        eyebrow: 'Bảo mật tài khoản',
        heading: 'Đặt lại mật khẩu',
        bodyHtml,
        cta: { label: 'Đặt lại mật khẩu', url: resetUrl },
        footnote: 'Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Mật khẩu hiện tại của bạn vẫn an toàn.',
    });

    const text = `Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản ${BRAND_NAME} của bạn.\n\n`
        + `Mở liên kết sau để tạo mật khẩu mới (hiệu lực trong ${expiresInMinutes} phút):\n${resetUrl}\n\n`
        + 'Nếu bạn không yêu cầu, hãy bỏ qua email này.\n\n'
        + `— ${BRAND_NAME} · ${SITE_URL}`;

    return { html, text };
};

module.exports = { renderEmailLayout, invitationEmail, passwordResetEmail };
