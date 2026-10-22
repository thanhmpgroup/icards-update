const User = require('../models/user.model');
const AppError = require('../utils/AppError');

// Không bao giờ trả mật khẩu và mã đặt lại mật khẩu ra ngoài
const PRIVATE_FIELDS = '-password -passwordResetToken -passwordResetExpires';
// Các trường admin được phép đặt khi tạo/sửa người dùng
const EDITABLE_FIELDS = ['username', 'email', 'role', 'firstName', 'lastName', 'phone', 'address', 'avatar'];

const pickEditable = (data = {}) => EDITABLE_FIELDS.reduce((acc, field) => {
  if (data[field] !== undefined) acc[field] = data[field];
  return acc;
}, {});

const getAllUsers = async () => {
  return await User.find().select(PRIVATE_FIELDS).sort({ createdAt: -1 });
};

const createUser = async (userData) => {

  const user = new User({
    ...pickEditable(userData),
    password: userData.password,
  });

  await user.save();
  return await User.findById(user._id).select(PRIVATE_FIELDS);
};


const getUserById = async (id) => {
  return await User.findById(id).select(PRIVATE_FIELDS);
};

const findUserByEmail = async (email) => {
    return await User.findOne({ email }).select('+password');
};

const changeUserPassword = async (userId, currentPassword, newPassword) => {
    // Lấy user và cả password hash
    const user = await User.findById(userId).select('+password');
    if (!user) {
        throw new Error('Không tìm thấy người dùng.');
    }

    // Kiểm tra mật khẩu hiện tại
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
        throw new Error('Mật khẩu hiện tại không chính xác.');
    }

    // Hash và cập nhật mật khẩu mới (middleware .pre('save') sẽ tự động hash)
    user.password = newPassword;
    await user.save();
};

const findUserByUsernameOrEmail = async (loginIdentifier) => {
    // Kiểm tra xem chuỗi nhập vào có phải là email không
    const identifier = String(loginIdentifier || '').trim();
    const isEmail = identifier.includes('@');

    // Email luôn lưu chữ thường; trước đây nhập "Admin@..." sẽ không đăng nhập được
    const query = isEmail ? { email: identifier.toLowerCase() } : { username: identifier };
    
    return await User.findOne(query).select('+password');
};

/**
 * ++ SỬA LỖI: Cập nhật người dùng bởi ID (cho Admin) ++
 * @param {string} userId - ID của người dùng cần cập nhật
 * @param {object} updateBody - Các trường cần cập nhật
 * @returns {Promise<User>}
 */
const updateUser = async (userId, updateBody) => {
    // Tìm và cập nhật người dùng. Tùy chọn { new: true } trả về document đã được cập nhật.
    const user = await User.findByIdAndUpdate(userId, updateBody, {
        new: true,
        runValidators: true
    }).select(PRIVATE_FIELDS);

    if (!user) {
        throw new AppError('Không tìm thấy người dùng để cập nhật.', 404);
    }
    return user;
};

/**
 * ++ SỬA LỖI: Xóa người dùng bởi ID (cho Admin) ++
 * @param {string} userId - ID của người dùng cần xóa
 * @returns {Promise<void>}
 */
const deleteUser = async (userId) => {
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
        throw new AppError('Không tìm thấy người dùng để xóa.', 404);
    }
    // Logic xóa avatar trên R2 nếu có thể thêm ở đây
};
module.exports = {
  getAllUsers,
  createUser,
  getUserById,
  findUserByEmail,
  changeUserPassword,
  findUserByUsernameOrEmail,
  updateUser, 
  deleteUser,
  pickEditable,
};
