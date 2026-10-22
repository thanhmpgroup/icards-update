const userService = require('../services/user.service');
const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const { passwordResetEmail } = require('../utils/emailTemplates');
const crypto = require('crypto');

// Cookie đăng nhập: production chạy HTTPS khác tên miền (SameSite=None), máy dev dùng Lax
const authCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    path: '/'
});

const forgotPassword = async (req, res, next) => {
    // Luôn trả cùng một thông báo để không tiết lộ email nào đã đăng ký tài khoản
    const genericResponse = {
        status: 'success',
        message: 'Nếu email đã đăng ký tài khoản, link đặt lại mật khẩu sẽ được gửi trong ít phút.',
    };

    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const user = email ? await User.findOne({ email }) : null;
        if (!user) {
            return res.status(200).json(genericResponse);
        }

        const resetToken = user.createPasswordResetToken();
        await user.save({ validateBeforeSave: false });

        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
        const resetURL = `${frontendUrl}/reset-password/${resetToken}`;
        const { html, text } = passwordResetEmail({ resetUrl: resetURL, expiresInMinutes: 10 });

        try {
            await sendEmail({
                to: user.email,
                subject: 'Đặt lại mật khẩu tài khoản iCards',
                text,
                html,
            });

            res.status(200).json(genericResponse);
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

        user.password = req.body.password;
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


const register = async (req, res, next) => {
    const { username, password } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();

    try {
        const userExists = await User.findOne({ $or: [{ username }, { email }] });
        if (userExists) {
            if (userExists.username === username) {
                return res.status(409).json({ message: 'Tên đăng nhập đã tồn tại.' });
            }
            if (userExists.email === email) {
                return res.status(409).json({ message: 'Email đã được sử dụng.' });
            }
        }

        const user = await User.create({ username, email, password });

        // Không tự động đăng nhập sau khi đăng ký, yêu cầu người dùng đăng nhập lại
        res.status(201).json({
            message: 'Đăng ký thành công! Vui lòng đăng nhập.',
        });

    } catch (error) {
        next(error);
    }
};

const logout = async (req, res, next) => {
  res.clearCookie('token', authCookieOptions())
  .status(200) 
  .json({ message: 'Đăng xuất thành công' });

};

const login = async (req, res, next) => {
  try {
    const { login, password } = req.body; 

    const user = await userService.findUserByUsernameOrEmail(login);

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' }); // Tăng thời gian hết hạn token

    user.password = undefined;

    res.cookie('token', token, {
        ...authCookieOptions(),
        maxAge: 24 * 60 * 60 * 1000, // 1 ngày
    })
    .json({
        message: "Đăng nhập thành công!",
        user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar
        }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, logout, forgotPassword, resetPassword };