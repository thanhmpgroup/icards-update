const Invitation = require('../models/invitation.model');
const InvitationTemplate = require('../models/invitationTemplate.model'); // Import model template
const mongoose = require('mongoose');
const masterGuestService = require('./masterGuest.service');
const path = require('path');
const fs = require('fs');
const os = require('os');
const sendEmail = require('../utils/sendEmail');
const { invitationEmail } = require('../utils/emailTemplates');
const { SITE_URL } = require('../config/site');
const { uniqueSlug } = require('../utils/slugify');

const cleanName = (name) => (typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 150) : '');


// Xóa ảnh OG đã cache của thiệp, gồm cả các bản cá nhân hóa theo khách mời ({id}_{guestId}.png)
const clearOgCache = (invitationId) => {
  const cacheDir = path.join(os.tmpdir(), 'og-cache');
  if (!fs.existsSync(cacheDir)) return;
  const prefix = String(invitationId);
  fs.readdirSync(cacheDir)
    .filter(file => file === `${prefix}.png` || file.startsWith(`${prefix}_`))
    .forEach(file => fs.unlinkSync(path.join(cacheDir, file)));
};

// ---- Tên & lời mời theo từng khách (mẫu Excel khách mời mới) ----
const getGuestDisplayName = (guest = {}) => {
    // "name" là tên đầy đủ (chủ thiệp sửa được trong form); Họ/Tên đệm/Tên chỉ dùng khi thiếu name
    const fullName = String(guest.name || '').trim() || [guest.lastName, guest.middleName, guest.firstName].filter(Boolean).join(' ').trim();
    if (guest.displayNamePreference === 'Biệt danh' && guest.nickname) return guest.nickname;
    if (guest.displayNamePreference === 'Tên') return guest.firstName || fullName.split(' ').pop();
    return fullName;
};

// "Bố Minh", "Ông Nguyễn Văn Tùng"... (xưng hô + tên hiển thị)
const getGuestGreetingName = (guest = {}) => [guest.addressTerm, getGuestDisplayName(guest)].filter(Boolean).join(' ').trim();

// Khách mở link thiệp riêng chỉ nhận các trường cần để hiển thị lời mời,
// KHÔNG nhận SĐT, email, tiền mừng, ghi chú, mức ưu tiên ("Dự phòng"...) mà chủ thiệp ghi.
const toPublicGuest = (guest, invitation) => {
    if (!guest) return null;
    const g = typeof guest.toObject === 'function' ? guest.toObject() : guest;
    return {
        _id: g._id,
        name: g.name,
        displayName: getGuestDisplayName(g),
        addressTerm: g.addressTerm || '',
        greetingName: getGuestGreetingName(g) || g.name,
        salutation: getSalutation(g, invitation),
        personalMessage: g.personalMessage || '',
        status: g.status,
        attendingCount: g.attendingCount,
    };
};

// Thiệp làm từ mẫu miễn phí (giá 0đ / không còn mẫu) hiện dấu "iCards.com.vn" trên trang thiệp và ảnh tải về.
// Máy chủ quyết định (khách không tự tắt được bằng cách sửa dữ liệu thiệp).
const needsWatermark = (invitation) => {
    const template = invitation?.template;
    const price = template && typeof template === 'object' ? Number(template.price) : 0;
    return !(price > 0);
};

// Chỉ trả về những trường an toàn để hiển thị công khai:
// không lộ số điện thoại, email, tiền mừng của khách, ngân sách hay kế hoạch của chủ thiệp.
const toPublicInvitation = (invitation, guestDetails = null) => {
  const data = invitation.toObject();
  const { password, ...publicSettings } = data.settings || {};
  return {
    _id: data._id,
    slug: data.slug,
    requiresPassword: Boolean(password),
    settings: publicSettings,
    content: data.content,
    design: data.design,
    template: data.template,
    wishes: data.settings?.showWishList ? data.wishes : [],
    guests: data.settings?.showGuestList
      ? (data.guests || []).map(({ _id, name, status, attendingCount }) => ({ _id, name, status, attendingCount }))
      : [],
    guestDetails,
    watermark: needsWatermark(invitation),
  };
};

/**
 * Lấy một thiệp mời công khai bằng slug của nó.
 * Hàm này không yêu cầu xác thực người dùng.
 * @param {string} slug - Slug của thiệp mời.
 * @returns {Promise<object|null>} Dữ liệu công khai của thiệp nếu tìm thấy.
 */
const getInvitationBySlug = async (slug, guestId = null) => {
    const invitation = await Invitation.findOne({ slug: slug }).populate('template', 'title price');

    if (!invitation) {
        return null;
    }

    let guestDetails = null;
    if (guestId && mongoose.Types.ObjectId.isValid(guestId)) {
        guestDetails = toPublicGuest(invitation.guests.id(guestId), invitation);
    }

    return toPublicInvitation(invitation, guestDetails);
};

const updateInvitationTasks = async (invitationId, userId, tasks) => {
    // Sử dụng findOneAndUpdate để tìm thiệp và cập nhật
    const updatedInvitation = await Invitation.findOneAndUpdate(
        { _id: invitationId, user: userId }, // Điều kiện: đúng ID thiệp và thuộc sở hữu của user
        { $set: { tasks: tasks } },          // Hành động: Cập nhật trường tasks
        { new: true, runValidators: true }   // Tùy chọn: Trả về dữ liệu mới sau khi update và chạy kiểm tra schema
    );

    return updatedInvitation;
};

/**
 * Tạo một thiệp mời mới từ template.
 * @param {string} userId - ID người dùng.
 * @param {string} templateId - ID của mẫu thiệp được chọn.
 * @param {string} slug - Slug duy nhất cho URL.
 * @param {object} content - Dữ liệu nội dung thiệp từ người dùng.
 * @param {object} design - Tùy chỉnh thiết kế từ người dùng.
 * @param {object} settings - Các cài đặt cho thiệp.
 * @returns {Promise<Document>} Thiệp mời vừa được tạo.
 */
const cleanFolder = (folder) => (typeof folder === 'string' ? folder.replace(/\s+/g, ' ').trim().slice(0, 60) : '');

const createInvitationFromTemplate = async (userId, templateId, slug, content, design, settings, name, folder) => {
    const template = await InvitationTemplate.findById(templateId);
    if (!template) {
        throw new Error('Không tìm thấy mẫu thiệp.');
    }
    // Tên giữ nguyên như khách gõ; đường dẫn tạo từ tên, tự thêm -2, -3 nếu trùng (trước đây báo lỗi 409
    // hoặc giao diện tự thêm 4 ký tự ngẫu nhiên vào tên)
    const finalName = cleanName(name) || cleanName(template.title) || 'Thiệp mời';
    const finalSlug = await uniqueSlug(Invitation, slug || finalName);

    const finalDesign = {
        ...(template.templateData?.design || {}),
        ...(design || {}),
    };

    const newInvitation = new Invitation({
        user: userId,
        template: templateId,
        slug: finalSlug,
        name: finalName,
        folder: cleanFolder(folder),
        content: content, // content (là pages array) được truyền trực tiếp
        design: finalDesign,
        settings: settings || { showWishList: true, showGuestList: false },
    });

    return await newInvitation.save();
};

/**
 * Cập nhật một thiệp mời.
 * @param {string} invitationId - ID của thiệp mời.
 * @param {string} userId - ID của người dùng.
 * @param {object} updateData - Dữ liệu cần cập nhật.
 * @returns {Promise<Document|null>} Thiệp mời đã được cập nhật.
 */
const updateInvitation = async (invitationId, userId, updateData) => {
    const updatePayload = {}; // Đổi tên từ allowedUpdates
    clearOgCache(invitationId);
    // Các trường này có thể ghi đè an toàn
    // Đổi tên không đổi đường dẫn (link đã gửi cho khách vẫn dùng được)
    if (cleanName(updateData.name)) updatePayload.name = cleanName(updateData.name);
    if (typeof updateData.folder === 'string') updatePayload.folder = cleanFolder(updateData.folder);
    if (updateData.slug) updatePayload.slug = await uniqueSlug(Invitation, updateData.slug, invitationId);
    if (updateData.content) updatePayload.content = updateData.content;
    if (updateData.design) updatePayload.design = updateData.design;

    // --- BẮT ĐẦU SỬA LỖI ---
    // if (updateData.settings) allowedUpdates.settings = updateData.settings; // <-- XÓA DÒNG NÀY

    // [MỚI] Sử dụng ký pháp dấu chấm để HỢP NHẤT (merge) đối tượng 'settings'
    // thay vì ghi đè toàn bộ.
    if (updateData.settings) {
        for (const key in updateData.settings) {
            if (Object.prototype.hasOwnProperty.call(updateData.settings, key)) {
                // Thao tác này sẽ tạo ra các key như:
                // 'settings.title', 'settings.groomName', 'settings.groomNameStyle', v.v.
                updatePayload[`settings.${key}`] = updateData.settings[key];
            }
        }
    }
    // --- KẾT THÚC SỬA LỖI ---

    return await Invitation.findOneAndUpdate(
        { _id: invitationId, user: userId },
        { $set: updatePayload }, // <-- Sử dụng updatePayload đã được xử lý
        { new: true, runValidators: true }
    );
};

const getInvitationsByUserId = async (userId, { summary = false } = {}) => {
    // summary: chỉ lấy thông tin hiển thị danh sách (tab "Dự án" trong trình thiết kế), nhẹ hơn nhiều
    const query = Invitation.find({ user: userId }).populate('template', 'title imgSrc');
    if (summary) query.select('name slug folder template updatedAt createdAt').sort({ updatedAt: -1 });
    return await query;
};

const getInvitationByIdAndUser = async (invitationId, userId) => {
    return await Invitation.findOne({ _id: invitationId, user: userId }).populate('template');
};

/** Chuyển thiệp vào thư mục (chuỗi rỗng = bỏ khỏi thư mục) */
const setInvitationFolder = async (invitationId, userId, folder) => {
    return Invitation.findOneAndUpdate(
        { _id: invitationId, user: userId },
        { $set: { folder: cleanFolder(folder) } },
        { new: true, projection: { name: 1, slug: 1, folder: 1 } },
    );
};

const deleteInvitation = async (invitationId, userId) => {
    const result = await Invitation.deleteOne({ _id: invitationId, user: userId });
    return result.deletedCount > 0;
};

// --- Quản lý Khách mời ---

const addGuestToInvitation = async (invitationId, userId, guestData) => {
    const invitation = await Invitation.findOne({ _id: invitationId, user: userId });
    if (!invitation) {
        return null;
    }
    invitation.guests.push(guestData);

    try {
        await masterGuestService.addOrUpdateGuest(userId, guestData);
    } catch (syncError) {
        console.error(`Lỗi đồng bộ danh bạ cho email ${guestData.email}:`, syncError);
    }

    return await invitation.save();
};


/**
 * [MỚI]
 * Thêm hàng loạt khách mời vào thiệp mời.
 * @param {string} invitationId - ID của thiệp.
 * @param {string} userId - ID của chủ thiệp.
 * @param {Array<object>} newGuests - Mảng các khách mời mới.
 * @returns {Promise<{invitation: Document, addedCount: number}>} Thiệp mời đã được cập nhật và số lượng khách đã thêm.
 */
const addGuestsInBulkToInvitation = async (invitationId, userId, newGuests) => {
    const invitation = await Invitation.findOne({ _id: invitationId, user: userId });
    if (!invitation) {
        throw new Error('Không tìm thấy thiệp hoặc bạn không có quyền.');
    }

    const existingEmails = new Set(invitation.guests.map(g => g.email).filter(Boolean));
    let addedCount = 0;
    const guestsToSync = []; // <-- Tạo mảng để lưu khách mời cần đồng bộ

    // Nhóm khách theo tên (cột "Nhóm quan hệ"): dùng nhóm có sẵn, chưa có thì tạo mới
    const groupIdByName = new Map(invitation.guestGroups.map(g => [String(g.name).trim().toLowerCase(), String(g._id)]));
    const resolveGroupId = (groupName) => {
        const key = String(groupName || '').trim().toLowerCase();
        if (!key) return null;
        if (!groupIdByName.has(key)) {
            invitation.guestGroups.push({ name: String(groupName).trim() });
            const created = invitation.guestGroups[invitation.guestGroups.length - 1];
            groupIdByName.set(key, String(created._id));
        }
        return groupIdByName.get(key);
    };

    newGuests = newGuests.map(raw => {
        const { groupName, ...guestData } = raw || {};
        if (!guestData.group && groupName) guestData.group = resolveGroupId(groupName);
        if (guestData.displayNamePreference && !['Tên đầy đủ', 'Tên', 'Biệt danh'].includes(guestData.displayNamePreference)) {
            delete guestData.displayNamePreference;
        }
        if (guestData.attendingCount !== undefined) {
            guestData.attendingCount = Math.max(1, Math.min(50, parseInt(guestData.attendingCount, 10) || 1));
        }
        if (guestData.status && !['pending', 'attending', 'declined'].includes(guestData.status)) delete guestData.status;
        if (typeof guestData.email === 'string') guestData.email = guestData.email.trim().toLowerCase() || undefined;
        return guestData;
    });

    newGuests.forEach(guestData => {
        if (!guestData.name || String(guestData.name).trim() === "") {
            return;
        }
        if (guestData.email && existingEmails.has(guestData.email)) {
            return;
        }
        invitation.guests.push(guestData);
        if (guestData.email) {
            existingEmails.add(guestData.email);
            guestsToSync.push(guestData); // <-- Thêm vào mảng đồng bộ
        }
        addedCount++;
    });

    const updatedInvitation = await invitation.save();

    // Sau khi lưu thiệp mời, đồng bộ tất cả khách mời mới vào danh bạ
    if (guestsToSync.length > 0) {
        console.log(`Đang đồng bộ ${guestsToSync.length} khách mời vào danh bạ...`);
        // Chạy đồng bộ mà không cần đợi (fire-and-forget) để không làm chậm phản hồi
        Promise.all(guestsToSync.map(guest => masterGuestService.addOrUpdateGuest(userId, guest)))
            .catch(syncError => console.error('Lỗi khi đồng bộ hàng loạt vào danh bạ:', syncError));
    }

    return { invitation: updatedInvitation, addedCount };
};


/**
 * [MỚI]
 * Cập nhật thông tin một khách mời trong thiệp.
 * @param {string} invitationId - ID của thiệp.
 * @param {string} guestId - ID của khách mời cần cập nhật.
 * @param {string} userId - ID của chủ thiệp.
 * @param {object} guestUpdateData - Dữ liệu mới của khách mời.
 * @returns {Promise<Document|null>} Thiệp mời đã được cập nhật.
 */
const updateGuestInInvitation = async (invitationId, guestId, userId, guestUpdateData) => {
    const invitation = await Invitation.findOne({ _id: invitationId, user: userId });
    if (!invitation) {
        return null;
    }
    const guest = invitation.guests.id(guestId);
    if (!guest) {
        return null;
    }
    guest.set(guestUpdateData);
    return await invitation.save();
};

/**
 * [MỚI]
 * Xóa một khách mời khỏi thiệp.
 * @param {string} invitationId - ID của thiệp.
 * @param {string} guestId - ID của khách mời cần xóa.
 * @param {string} userId - ID của chủ thiệp.
 * @returns {Promise<Document|null>} Thiệp mời đã được cập nhật.
 */
const removeGuestFromInvitation = async (invitationId, guestId, userId) => {
    const invitation = await Invitation.findOne({ _id: invitationId, user: userId });
    if (!invitation) {
        throw new Error('Không tìm thấy thiệp hoặc bạn không có quyền.');
    }

    // Find the index of the guest to remove
    const guestIndex = invitation.guests.findIndex(g => g._id.toString() === guestId);
    if (guestIndex === -1) {
        throw new Error('Không tìm thấy khách mời.'); // Guest not found
    }

    // Remove the guest using splice
    invitation.guests.splice(guestIndex, 1);
    
    return await invitation.save();
};

// --- Quản lý Lời chúc ---

/**
 * [MỚI]
 * Thêm một lời chúc vào thiệp (công khai).
 * @param {string} invitationId - ID của thiệp.
 * @param {object} wishData - Dữ liệu lời chúc (author, message).
 * @returns {Promise<Document|null>} Thiệp mời đã được cập nhật.
 */
const addWishToInvitation = async (invitationId, wishData) => {
    const invitation = await Invitation.findById(invitationId);
    if (!invitation) {
        throw new Error('Không tìm thấy thiệp.');
    }
    if (!invitation.settings.showWishList) {
        throw new Error('Chủ nhân thiệp không cho phép gửi lời chúc.');
    }
    invitation.wishes.push(wishData);
    return await invitation.save();
};

// MỚI: Function để cập nhật cài đặt thiệp

const updateInvitationSettings = async (invitationId, userId, settingsData) => {
    
    // Tạo một object update trống
    const updatePayload = {};

    // Dùng vòng lặp để biến đổi settingsData thành "dot notation"
    // Ví dụ: { title: 'Mới' } sẽ trở thành { 'settings.title': 'Mới' }
    for (const key in settingsData) {
        // Đảm bảo chỉ lặp qua các thuộc tính của chính object
        if (Object.prototype.hasOwnProperty.call(settingsData, key)) {
            // Gán giá trị vào payload mới với key có tiền tố 'settings.'
            updatePayload[`settings.${key}`] = settingsData[key];
        }
    }

    // Bây giờ updatePayload có dạng: { 'settings.title': '...', 'settings.groomName': '...' }
    // Lệnh $set với payload này sẽ chỉ cập nhật các trường con này,
    // và giữ nguyên các trường khác trong 'settings'.

    return await Invitation.findOneAndUpdate(
        { _id: invitationId, user: userId },
        { $set: updatePayload }, // <-- Sử dụng updatePayload đã được xử lý
        { new: true, runValidators: true }
    );
};



// --- MỚI: Quản lý Nhóm khách mời ---

/**
 * Thêm một nhóm khách mời mới vào thiệp.
 * @param {string} invitationId - ID của thiệp.
 * @param {string} userId - ID của chủ thiệp.
 * @param {object} groupData - Dữ liệu nhóm (name, salutation).
 * @returns {Promise<Document|null>} Thiệp mời đã được cập nhật.
 */
const addGuestGroupToInvitation = async (invitationId, userId, groupData) => {
    const invitation = await Invitation.findOne({ _id: invitationId, user: userId });
    if (!invitation) {
        throw new Error('Không tìm thấy thiệp hoặc bạn không có quyền.');
    }

    // Kiểm tra trùng tên nhóm trong thiệp này
    const existingGroup = invitation.guestGroups.find(g => g.name === groupData.name);
    if (existingGroup) {
        throw new Error('Tên nhóm đã tồn tại.');
    }

    invitation.guestGroups.push(groupData);
    return await invitation.save();
};

/**
 * Lấy tất cả nhóm khách mời của một thiệp.
 * @param {string} invitationId - ID của thiệp.
 * @param {string} userId - ID của chủ thiệp.
 * @returns {Promise<Array>} Mảng các nhóm khách mời.
 */
const getGuestGroupsByInvitationId = async (invitationId, userId) => {
    const invitation = await Invitation.findOne({ _id: invitationId, user: userId }).select('guestGroups');
    if (!invitation) {
        throw new Error('Không tìm thấy thiệp hoặc bạn không có quyền.');
    }
    return invitation.guestGroups;
};

/**
 * Cập nhật thông tin một nhóm khách mời trong thiệp.
 * @param {string} invitationId - ID của thiệp.
 * @param {string} groupId - ID của nhóm cần cập nhật.
 * @param {string} userId - ID của chủ thiệp.
 * @param {object} updateData - Dữ liệu mới của nhóm (name, salutation).
 * @returns {Promise<Document|null>} Thiệp mời đã được cập nhật.
 */
const updateGuestGroupInInvitation = async (invitationId, groupId, userId, updateData) => {
    const invitation = await Invitation.findOne({ _id: invitationId, user: userId });
    if (!invitation) {
        throw new Error('Không tìm thấy thiệp hoặc bạn không có quyền.');
    }

    const group = invitation.guestGroups.id(groupId);
    if (!group) {
        throw new Error('Không tìm thấy nhóm khách mời.');
    }

    // Kiểm tra trùng tên nếu tên đang được cập nhật
    if (updateData.name && updateData.name !== group.name) {
        const existingGroup = invitation.guestGroups.find(g => g.name === updateData.name && g._id.toString() !== groupId);
        if (existingGroup) {
            throw new Error('Tên nhóm đã tồn tại.');
        }
    }

    group.set(updateData);
    return await invitation.save();
};

/**
 * Xóa một nhóm khách mời khỏi thiệp.
 * @param {string} invitationId - ID của thiệp.
 * @param {string} groupId - ID của nhóm cần xóa.
 * @param {string} userId - ID của chủ thiệp.
 * @returns {Promise<Document|null>} Thiệp mời đã được cập nhật.
 */
const removeGuestGroupFromInvitation = async (invitationId, groupId, userId) => {
    const invitation = await Invitation.findOne({ _id: invitationId, user: userId });
    if (!invitation) {
        throw new Error('Không tìm thấy thiệp hoặc bạn không có quyền.');
    }

    // Find the index of the group to remove
    const groupIndex = invitation.guestGroups.findIndex(g => g._id.toString() === groupId);
    if (groupIndex === -1) {
        throw new Error('Không tìm thấy nhóm khách mời.'); // Group not found
    }

    // Remove the group using splice
    invitation.guestGroups.splice(groupIndex, 1);
    
    return await invitation.save();
};
const getSalutation = (guest, invitation) => {
    const settings = invitation.settings || {};
    
    // 1. Dùng chung cho tất cả (ghi đè mọi thứ)
    if (settings.useGlobalSalutation) {
        return settings.salutationStyle || 'Thân gửi';
    }

    // 2. Lời xưng hô riêng của cá nhân (ưu tiên cao nhất nếu không bật global)
    if (guest.salutation && guest.salutation !== 'Lời xưng hô mặc định') {
        return guest.salutation;
    }

    // 3. Lời xưng hô theo Nhóm khách mời
    if (guest.group && invitation.guestGroups && invitation.guestGroups.length > 0) {
        const group = invitation.guestGroups.find(g => g._id.toString() === guest.group.toString());
        if (group && group.salutation && group.salutation !== 'Lời xưng hô mặc định') {
            return group.salutation;
        }
    }

    // 4. Mặc định của thiệp
    return settings.salutationStyle || 'Thân gửi';
};

const processPlaceholders = (text, guestName, salutation) => {
    if (!text) return '';
    // Dùng Regex /g để thay thế TẤT CẢ các chỗ chứa từ khóa, rồi dọn khoảng trắng thừa (vd: "Nam !" -> "Nam!")
    return text
        .replace(/{TênKháchMời}/g, guestName || '')
        .replace(/{LờiXưngHô}/g, salutation || '')
        .replace(/[ \t]+([!?.,:;])/g, '$1')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
};
/**
 * Gửi email thiệp mời đến một khách mời cụ thể.
 * @param {string} invitationId - ID của thiệp mời.
 * @param {string} guestId - ID của khách mời.
 * @param {string} userId - ID của chủ thiệp.
 * @param {object} [options]
 * @param {number} [options.daysLeft] - Truyền khi gửi email nhắc lịch (số ngày còn lại tới sự kiện).
 * @returns {Promise<Object>} Trả về thông tin khách mời đã được cập nhật trạng thái email.
 */
const sendInvitationEmailToGuest = async (invitationId, guestId, userId, options = {}) => {
    const invitation = await Invitation.findOne({ _id: invitationId, user: userId });
    if (!invitation) {
        throw new Error('Không tìm thấy thiệp hoặc bạn không có quyền.');
    }

    const guest = invitation.guests.id(guestId);
    if (!guest) {
        throw new Error('Không tìm thấy khách mời.');
    }

    if (!guest.email) {
        throw new Error('Khách mời không có địa chỉ email.');
    }

    const { title, description } = invitation.settings;
    const { _id: finalGuestId } = guest;
    // "Bố Minh" thay vì "Nguyễn Văn Minh" khi khách có xưng hô / tên ưu tiên (mẫu Excel mới)
    const name = getGuestGreetingName(guest) || guest.name;

    // 1. Lấy Lời xưng hô chuẩn xác dựa trên Helper
    const finalSalutation = getSalutation(guest, invitation);

    const frontendBaseUrl = (process.env.FRONTEND_URL || SITE_URL).replace(/\/+$/, '');
    const destinationUrl = `${frontendBaseUrl}/events/${invitation._id}?guestId=${finalGuestId}`;

    // 2. Subject & nội dung (thay thế TẤT CẢ placeholder)
    const isReminder = Number.isInteger(options.daysLeft);
    const baseSubject = processPlaceholders(title || 'Bạn có một thiệp mời mới!', name, finalSalutation);
    const finalSubject = isReminder ? `Nhắc lịch: ${baseSubject}` : baseSubject;
    const finalBody = processPlaceholders(description || 'Bạn vừa nhận được một lời mời sự kiện.', name, finalSalutation);

    const { html, text } = invitationEmail({
        subject: finalSubject,
        salutation: finalSalutation,
        guestName: name,
        message: finalBody,
        invitationUrl: destinationUrl,
        daysLeft: isReminder ? options.daysLeft : null,
    });

    try {
        await sendEmail({ to: guest.email, subject: finalSubject, html, text });
        guest.emailStatus = 'Đã gửi';
        await invitation.save();
        return guest;
    } catch (error) {
        console.error('Lỗi khi gửi email:', error);
        guest.emailStatus = 'Thất bại';
        await invitation.save();
        throw new Error(`Gửi email thất bại. Lỗi từ máy chủ: ${error.response || error.message || 'Không xác định'}`);
    }
};
/**
 * [MỚI]
 * Lấy một thiệp mời công khai bằng ID của nó, kèm thông tin khách mời nếu có.
 * @param {string} invitationId - ID của thiệp mời.
 * @param {string} guestId - ID của khách mời (tùy chọn).
 * @returns {Promise<Document|null>} Thiệp mời và thông tin khách mời.
 */
const getPublicInvitationById = async (invitationId, guestId = null) => {
    if (!mongoose.Types.ObjectId.isValid(invitationId)) {
        throw new Error('ID thiệp mời không hợp lệ.');
    }

    const invitation = await Invitation.findById(invitationId).populate('template');

    if (!invitation) {
        return null;
    }

    let guestDetails = null;
    if (guestId && mongoose.Types.ObjectId.isValid(guestId)) {
        guestDetails = toPublicGuest(invitation.guests.id(guestId), invitation);
    }
    
    // TRẢ VỀ DỮ LIỆU ĐẦY ĐỦ BAO GỒM CẢ TEMPLATE
    const publicInvitationData = {
        _id: invitation._id,
        slug: invitation.slug,
        settings: invitation.settings,
        content: invitation.content,
        design: invitation.design,
        guestDetails: guestDetails,
        template: invitation.template,
        reactions: { hearts: invitation.reactions?.hearts || 0 },
        watermark: needsWatermark(invitation),
    };

    return publicInvitationData;
};


/**
 * Cập nhật trạng thái tham dự (RSVP) cho một khách mời cụ thể.
 * Hàm này không yêu cầu xác thực người dùng (userId).
 * @param {string} invitationId ID của thiệp mời.
 * @param {string} guestId ID của khách mời.
 * @param {object} rsvpData Dữ liệu phản hồi ({ status, attendingCount }).
 * @returns {Promise<Document|null>}
 */
const updateGuestRsvp = async (invitationId, guestId, rsvpData) => {
    // Tìm thiệp mời chỉ bằng ID, không cần userId
    const invitation = await Invitation.findById(invitationId);
    if (!invitation) {
        throw new Error('Không tìm thấy thiệp mời.');
    }

    // Tìm khách mời trong thiệp đó
    const guest = invitation.guests.id(guestId);
    if (!guest) {
        throw new Error('Không tìm thấy thông tin khách mời.');
    }

    // Cập nhật các trường liên quan đến RSVP
    guest.status = rsvpData.status;
    guest.attendingCount = rsvpData.attendingCount;
    
    // Lưu lại sự thay đổi
    await invitation.save();
    return guest;
};


// ==========================================================
// === BẮT ĐẦU: SERVICES MỚI CHO BULK ACTIONS ===
// ==========================================================
/**
 * [MỚI]
 * Xóa hàng loạt khách mời khỏi thiệp.
 * @param {string} invitationId - ID của thiệp.
 * @param {string} userId - ID của chủ thiệp.
 * @param {Array<string>} guestIds - Mảng các ID của khách mời cần xóa.
 * @returns {Promise<{invitation: Document, deletedCount: number}>} Thiệp mời đã được cập nhật và số lượng khách đã xóa.
 */
const bulkDeleteGuestsFromInvitation = async (invitationId, userId, guestIds) => {
    const invitation = await Invitation.findOne({ _id: invitationId, user: userId });
    if (!invitation) {
        throw new Error('Không tìm thấy thiệp hoặc bạn không có quyền.');
    }

    const originalGuestCount = invitation.guests.length;

    // Lọc ra danh sách khách mời mới, loại bỏ những khách có ID trong guestIds
    invitation.guests = invitation.guests.filter(guest => !guestIds.includes(guest._id.toString()));

    const updatedInvitation = await invitation.save();
    const deletedCount = originalGuestCount - updatedInvitation.guests.length;

    return { invitation: updatedInvitation, deletedCount };
};

/**
 * [MỚI]
 * Cập nhật hàng loạt khách mời trong thiệp (ví dụ: đổi nhóm).
 * @param {string} invitationId - ID của thiệp.
 * @param {string} userId - ID của chủ thiệp.
 * @param {Array<string>} guestIds - Mảng các ID của khách mời cần cập nhật.
 * @param {object} updateData - Dữ liệu cần cập nhật (vd: { group: 'newGroupId' }).
 * @returns {Promise<Document>} Thiệp mời đã được cập nhật.
 */
const bulkUpdateGuestsInInvitation = async (invitationId, userId, guestIds, updateData) => {
    const invitation = await Invitation.findOne({ _id: invitationId, user: userId });
    if (!invitation) {
        throw new Error('Không tìm thấy thiệp hoặc bạn không có quyền.');
    }

    // Lặp qua danh sách khách mời và cập nhật những khách có trong guestIds
    invitation.guests.forEach(guest => {
        if (guestIds.includes(guest._id.toString())) {
            // Cập nhật các trường được cung cấp trong updateData
            // Ví dụ: guest.group = updateData.group;
            Object.assign(guest, updateData);
        }
    });

    return await invitation.save();
};
const getInvitationTasks = async (invitationId, userId) => {
    // Chỉ select trường 'tasks' để tối ưu
    const invitation = await Invitation.findOne(
        { _id: invitationId, user: userId },
        'tasks' 
    );
    return invitation;
};
/**
 * [MỚI]
 * Gửi email hàng loạt cho nhiều khách mời.
 * @param {string} invitationId - ID của thiệp.
 * @param {string} userId - ID của chủ thiệp.
 * @param {Array<string>} guestIds - Mảng các ID của khách mời cần gửi email.
 * @returns {Promise<{invitation: Document, successCount: number, failedCount: number}>}
 */

const bulkSendEmailToGuests = async (invitationId, userId, guestIds) => {
    const invitation = await Invitation.findOne({ _id: invitationId, user: userId });
    if (!invitation) {
        throw new Error('Không tìm thấy thiệp hoặc bạn không có quyền.');
    }

    let successCount = 0;
    let failedCount = 0;

    // Lọc ra các khách mời cần gửi email
    const guestsToSend = invitation.guests.filter(guest => guestIds.includes(guest._id.toString()));

    // Gửi theo từng đợt nhỏ để Gmail không chặn vì gửi quá nhiều kết nối cùng lúc
    const BATCH_SIZE = 5;
    for (let i = 0; i < guestsToSend.length; i += BATCH_SIZE) {
        const batch = guestsToSend.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (guest) => {
            try {
                if (!guest.email) {
                    throw new Error('Khách mời không có email.');
                }
                await sendInvitationEmailToGuest(invitationId, guest._id.toString(), userId);
                guest.emailStatus = 'Đã gửi';
                successCount++;
            } catch (error) {
                guest.emailStatus = 'Thất bại';
                failedCount++;
            }
        }));
    }

    // Lưu lại tất cả các thay đổi trạng thái email
    const updatedInvitation = await invitation.save();

    return { invitation: updatedInvitation, successCount, failedCount };
};
const updateInvitationBudget = async (invitationId, userId, budgetData) => {
    // Cập nhật trực tiếp mảng budget của thiệp mời
    const updatedInvitation = await Invitation.findOneAndUpdate(
        { _id: invitationId, user: userId },
        { $set: { budget: budgetData } },
        { new: true, runValidators: true }
    );
    return updatedInvitation;
};
module.exports = {
    needsWatermark,
    setInvitationFolder,
    createInvitationFromTemplate,
    getInvitationBySlug,
    getInvitationsByUserId,
    getInvitationByIdAndUser,
    updateInvitation,
    deleteInvitation,
    addGuestToInvitation,
    addGuestsInBulkToInvitation, // THÊM EXPORT MỚI
    updateGuestInInvitation,
    removeGuestFromInvitation,
    updateInvitationTasks,
    addWishToInvitation,
    updateInvitationSettings, // NEW
    addGuestGroupToInvitation, // NEW
    getGuestGroupsByInvitationId, // NEW
    updateGuestGroupInInvitation, // NEW
    removeGuestGroupFromInvitation, // NEW
    sendInvitationEmailToGuest, // MỚI: Gửi email
    getPublicInvitationById,
    updateGuestRsvp,
    bulkDeleteGuestsFromInvitation,
    bulkUpdateGuestsInInvitation,
    getInvitationTasks,
    bulkSendEmailToGuests,
    updateInvitationBudget,
};
