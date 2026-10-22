const nodemailer = require('nodemailer');
const { BRAND_NAME } = require('../config/site');

// Dùng chung một transporter (có pool) thay vì tạo kết nối SMTP mới cho mỗi email.
let transporter = null;
const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            pool: true,
            maxConnections: 3,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }
    return transporter;
};

const sendEmail = async (options) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('LỖI CẤU HÌNH: Vui lòng khai báo EMAIL_USER và EMAIL_PASS trong tệp .env');
        throw new Error('Cấu hình email bị thiếu.');
    }

    if (!options.to) {
        throw new Error('Lỗi logic: Không có người nhận (options.to) nào được định nghĩa trước khi gửi email.');
    }

    const mailOptions = {
        from: process.env.EMAIL_FROM || `"${BRAND_NAME}" <${process.env.EMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
    };

    await getTransporter().sendMail(mailOptions);
};

module.exports = sendEmail;
