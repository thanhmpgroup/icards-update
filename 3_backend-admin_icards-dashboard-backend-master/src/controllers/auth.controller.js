// AdminTrainData/AdminBE/controllers/auth.controller.js

const userService = require('../services/user.service');
const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const { STAFF_ROLES } = require('../middleware/auth.middleware');

const MIN_PASSWORD_LENGTH = 8;
// Cùng một câu trả lời dù email có tồn tại hay không, để không lộ danh sách tài khoản.
const FORGOT_PASSWORD_RESPONSE = 'Nếu email thuộc một tài khoản quản trị, link đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư.';

const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // admin.icards.com.vn và adminapi.icards.com.vn cùng "site" nên Lax vẫn gửi được cookie,
    // đồng thời chặn trang lạ gửi form giả mạo (CSRF) kèm cookie đăng nhập.
    sameSite: 'Lax',
    path: '/'
});

const forgotPassword = async (req, res, next) => {
    try {
        const email = String((req.body && req.body.email) || '').trim().toLowerCase();
        const user = email ? await User.findOne({ email }) : null;
        if (!user || !STAFF_ROLES.includes(user.role)) {
            return res.status(200).json({ status: 'success', message: FORGOT_PASSWORD_RESPONSE });
        }

        const resetToken = user.createPasswordResetToken();
        await user.save({ validateBeforeSave: false });

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetURL = `${frontendUrl}/reset-password/${resetToken}`;

        const message = `Bạn nhận được email này vì bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu cho tài khoản của bạn.\n\nVui lòng nhấn vào liên kết sau hoặc dán vào trình duyệt để hoàn tất quá trình (liên kết có hiệu lực trong 10 phút):\n\n${resetURL}\n\nNếu bạn không yêu cầu điều này, vui lòng bỏ qua email này.`;

        try {
            const mailOptions = {
                to: user.email,
                subject: 'Yêu cầu đặt lại mật khẩu',
                text: message,
            };
            
            await sendEmail(mailOptions);

            res.status(200).json({
                status: 'success',
                message: FORGOT_PASSWORD_RESPONSE,
            });
        } catch (err) {
            console.error('EMAIL SENDING ERROR:', err);
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validateBeforeSave: false });

            return res.status(500).json({ message: 'Gửi email thất bại. Vui lòng thử lại sau.' });
        }
    } catch (error) {
        next(error);
    }
};

const resetPassword = async (req, res, next) => {
    try {
        const password = req.body && req.body.password;
        if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
            return res.status(400).json({ message: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` });
        }

        const hashedToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
        }

        user.password = password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        res.status(200).json({
            status: 'success',
            message: 'Mật khẩu đã được đặt lại thành công! Vui lòng đăng nhập.',
        });

    } catch (error) {
        next(error);
    }
};


const socialLoginCallback = (req, res) => {
    // Sau khi xác thực thành công qua Passport, req.user sẽ chứa thông tin user
    if (!req.user || !STAFF_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: 'Tài khoản này không có quyền truy cập vào trang quản trị.' });
    }
    const token = jwt.sign({ id: req.user._id, role: req.user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.cookie('token', token, {
        ...cookieOptions(),
        maxAge: 24 * 60 * 60 * 1000, // 1 ngày
    });
    // Chuyển hướng về trang dashboard của admin
    res.redirect(process.env.ADMIN_FRONTEND_URL || 'http://localhost:3000/dashboard');
};

// Đăng ký công khai đã tắt: bảng users dùng chung với icards.com.vn, ai cũng tự tạo được tài khoản
// rồi đăng nhập vào API quản trị. Tài khoản nhân viên do admin tạo trong "Quản lý Người dùng".
const register = async (req, res) => {
    res.status(403).json({ message: 'Không thể tự đăng ký tài khoản quản trị. Vui lòng liên hệ quản trị viên.' });
};
// --- HÀM LOGIN ĐÃ ĐƯỢC TÁI CẤU TRÚC ---
const login = async (req, res, next) => {
  try {
    const login = String((req.body && req.body.login) || '').trim();
    const password = req.body && req.body.password;
    if (!login || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
    }

    const user = await userService.findUserByUsernameOrEmail(login);

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
    }

    // Tài khoản khách hàng của icards.com.vn (role 'user') không được vào trang quản trị.
    if (!STAFF_ROLES.includes(user.role)) {
      return res.status(403).json({ message: 'Tài khoản này không có quyền truy cập vào trang quản trị.' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

    user.password = undefined;

    // Thiết lập httpOnly cookie an toàn
    res.cookie('token', token, {
        ...cookieOptions(),
        maxAge: 24 * 60 * 60 * 1000, // 1 ngày, bằng hạn của token
    });
    
    // ** THAY ĐỔI QUAN TRỌNG: **
    // Chỉ trả về thông tin người dùng, không trả về token trong body
    res.status(200).json({
        message: "Đăng nhập thành công!",
        user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            role: user.role // Gửi kèm role để frontend có thể kiểm tra
        }
    });

  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  res.clearCookie('token', cookieOptions())
  .status(200) 
  .json({ message: 'Đăng xuất thành công' });
};


module.exports = { register, login, logout, forgotPassword, resetPassword, socialLoginCallback };