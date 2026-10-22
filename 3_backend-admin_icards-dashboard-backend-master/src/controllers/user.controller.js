const userService = require('../services/user.service');
const { deleteFileFromCloudflare, getImageIdFromUrl } = require('../services/cloudflare.service.js');
const AppError = require('../utils/AppError');

const getUsers = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

const MIN_PASSWORD_LENGTH = 8;

const createUser = async (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return next(new AppError(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`, 400));
    }
    const newUser = await userService.createUser(req.body);
    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      return next(new AppError('Không tìm thấy người dùng với ID này.', 404));
    }
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
    try {
        const user = await userService.getUserById(req.user.id);
        if (!user) {
          return next(new AppError('Không tìm thấy người dùng với ID này. Vui lòng thử lại sau', 404));
        }
        res.status(200).json(user);
    } catch (error) {
        next(error);
    }
};

const updateMe = async (req, res, next) => {
    try {
    const userId = req.user.id;

    const { firstName, lastName, phone, address, bio, dob } = req.body;
    const updateData = { firstName, lastName, phone, address, bio, dob };
    
    const updatedUser = await userService.updateUser(userId, updateData);

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
const updateAvatar = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    if (!req.file || !req.file.cfUrl) {
      return next(new AppError('Làm ơn hãy đăng lên một bức ảnh.', 400));
    }

    const oldAvatarUrl = req.user.avatar; 
    if (oldAvatarUrl) {
        const oldImageId = getImageIdFromUrl(oldAvatarUrl);
        if(oldImageId) {
          await deleteFileFromCloudflare(oldImageId);
        }
    }

    const newAvatarUrl = req.file.cfUrl;

    const updatedUser = await userService.updateUser(userId, { avatar: newAvatarUrl });

    res.status(200).json({
      success: true,
      message: 'Avatar updated successfully.',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};


const changePassword = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        await userService.changeUserPassword(userId, currentPassword, newPassword);

        res.status(200).json({
            success: true,
            message: 'Đổi mật khẩu thành công.',
        });
    } catch (error) {
        if (error.message.includes('không chính xác')) {
            return res.status(401).json({ message: error.message });
        }
        next(error);
    }
};

const updateUser = async (req, res, next) => {
    try {
        const updateData = userService.pickEditable(req.body);
        // Không cho admin tự hạ quyền của chính mình (tránh khóa mất tài khoản quản trị cuối cùng)
        if (String(req.params.id) === String(req.user._id) && updateData.role && updateData.role !== req.user.role) {
            return next(new AppError('Bạn không thể tự đổi vai trò của chính mình.', 400));
        }
        const user = await userService.updateUser(req.params.id, updateData);
        if (!user) {
            return next(new AppError('Không tìm thấy người dùng để cập nhật.', 404));
        }
        res.status(200).send({
            status: 'success',
            message: 'Cập nhật người dùng thành công',
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

const deleteUser = async (req, res, next) => {
    try {
        if (String(req.params.id) === String(req.user._id)) {
            return next(new AppError('Bạn không thể tự xóa tài khoản của chính mình.', 400));
        }
        await userService.deleteUser(req.params.id);
        res.status(200).send({
            status: 'success',
            message: 'Xóa người dùng thành công',
        });
    } catch (error) {
        next(error);
    }
};



module.exports = {
  getUsers,
  createUser,
  getUser,
  getMe,
  updateMe,
  updateAvatar,
  changePassword,
  updateUser,
  deleteUser,
};