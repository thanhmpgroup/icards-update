// AdminTrainData/AdminBE/routes/admin.routes.js
const express = require('express');
const router = express.Router();
const { protect, authorize, requireStaff } = require('../middleware/auth.middleware');
const { handleBatchUpload } = require('../controllers/asset.controller');

// Import controllers
const adminController = require('../controllers/admin.controller');
const reviewController = require('../controllers/review.controller');
const productController = require('../controllers/product.controller');
const templateController = require('../controllers/invitationTemplate.controller');
const userController = require('../controllers/user.controller');
// Import page routes
const pageRoutes = require('./page.routes'); 
const fontRoutes = require('./font.routes');
const designAssetRoutes = require('./designAsset.routes');

const pageCategoryRoutes = require('./pageCategory.routes');
const topicRoutes = require('./topic.routes');
const templateBlockRoutes = require('./templateBlock.routes');

const { upload, resizeImage, uploadImageToCloudflare } = require('../middleware/upload.middleware');
const { validateProduct } = require('../utils/validators');


router.use(protect);
// ===== BẢO VỆ TẤT CẢ CÁC ROUTE BÊN DƯỚI =====
// Bảng users dùng chung với icards.com.vn: tài khoản khách hàng (role 'user') đăng nhập được
// nhưng không được dùng bất kỳ API quản trị nào. Từng nhóm route bên dưới còn giới hạn vai trò riêng.
router.use(requireStaff);

router.get('/users/me', userController.getMe);
// === Dashboard ===
router.get('/dashboard', adminController.getDashboardData);
// === Quản lý người dùng: chỉ admin (trước đây mọi tài khoản đăng nhập đều xem/sửa/xóa được, kể cả tự nâng quyền) ===
router.route('/users')
    .get(authorize('admin'), userController.getUsers)
    .post(authorize('admin'), userController.createUser);
router.route('/users/:id')
    .get(authorize('admin'), userController.getUser)
    .put(authorize('admin'), userController.updateUser)
    .delete(authorize('admin'), userController.deleteUser);


const productUpload = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'images', maxCount: 10 }
]);


// === Product Management ===
router.route('/products')
    .get(authorize('admin', 'designer'), productController.getProducts)
    .post(
        authorize('admin', 'designer'),
        productUpload,
        resizeImage,
        uploadImageToCloudflare,
        validateProduct,
        productController.createProduct
    );

router.route('/products/:id')
    .put(
        authorize('admin', 'designer'),
        productUpload,
        resizeImage,
        uploadImageToCloudflare,
        validateProduct,
        productController.updateProduct
    )
    .delete(authorize('admin', 'designer'), productController.deleteProduct);


// === Template Management ===
router.get('/templates', authorize('admin', 'marketing', 'designer'), templateController.getInvitationTemplates);
router.get('/templates/categories', authorize('admin', 'marketing', 'designer'), templateController.getTemplateCategories);
router.get('/templates/types', authorize('admin', 'marketing', 'designer'), templateController.getTemplateTypesForCategory);
router.get('/templates/groups', authorize('admin', 'marketing', 'designer'), templateController.getTemplateGroups); // Route này phải nằm ở đây
router.post('/templates/bulk-import', 
    authorize('admin', 'marketing', 'designer'), 
    upload.single('file'), // Thêm middleware xử lý file tại đây
    templateController.bulkCreateTemplates
);
router.post('/templates', authorize('admin', 'marketing', 'designer'), upload.any(), templateController.createTemplate);
router.post('/templates/reorder', authorize('admin', 'marketing', 'designer'), templateController.reorderTemplates);
router.delete('/templates/bulk-delete-by-filter', authorize('admin', 'designer'), templateController.bulkDeleteTemplatesByFilter);
router.post('/assets/upload-batch', authorize('admin', 'designer'), upload.any(), handleBatchUpload);

// ROUTE ĐỘNG (KHÁI QUÁT) ĐƯỢC ĐẶT Ở SAU CÙNG
router.get('/templates/:id', authorize('admin', 'designer'), templateController.getTemplateById); // Route này phải nằm sau các route tĩnh ở trên
router.put('/templates/:id', authorize('admin', 'designer'), upload.any(), resizeImage, uploadImageToCloudflare, templateController.updateTemplate);
router.delete('/templates/:id', authorize('admin', 'designer'), templateController.deleteTemplate);

// --- Gắn các route quản lý trang vào đây ---
router.use('/pages', authorize('admin', 'marketing'), pageRoutes);
router.use('/topics', authorize('admin', 'marketing'), topicRoutes);
router.use('/fonts', authorize('admin', 'designer'), fontRoutes);

// === BẮT ĐẦU SỬA LỖI: GẮN ROUTE CHO PAGE CATEGORY ===
// Route này sẽ xử lý các request tới /api/v1/admin/page-categories
router.use('/page-categories', authorize('admin', 'marketing'), pageCategoryRoutes);
// === KẾT THÚC SỬA LỖI ===

// === Khối mẫu thiệp trang chủ (/collection/...) ===
router.use('/template-blocks', templateBlockRoutes);

// === Settings & SEO ===
// === Đánh giá của khách (trang chủ) ===
router.get('/reviews', authorize('admin', 'marketing'), reviewController.getReviews);
router.put('/reviews/:id', authorize('admin', 'marketing'), reviewController.updateReviewStatus);
router.delete('/reviews/:id', authorize('admin', 'marketing'), reviewController.deleteReview);

router.get('/settings', authorize('admin', 'marketing'), adminController.getSettings);
router.put('/settings', authorize('admin', 'marketing'), upload.any(), adminController.updateSettings);


module.exports = router;