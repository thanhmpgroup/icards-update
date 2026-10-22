// Menu trái của trang quản trị: dùng chung cho thanh menu, đường dẫn breadcrumb và "Công cụ nhanh" ở Bảng điều khiển.
import { LayoutDashboard, ListTree, LayoutTemplate, ShoppingBag, Palette, Type, Image as ImageIcon, FileText, MessageSquareText, Settings, Users } from 'lucide-react';

export const ROLE_LABELS = { admin: 'Quản trị viên', designer: 'Thiết kế', marketing: 'Marketing' };

export const NAV_SECTIONS = [
    {
        title: 'Tổng quan',
        items: [
            { to: '/dashboard', icon: LayoutDashboard, text: 'Bảng điều khiển', roles: ['admin', 'designer', 'marketing'], end: true },
        ],
    },
    {
        title: 'Thiệp & sản phẩm',
        items: [
            { to: '/dashboard/categories', icon: ListTree, text: 'Danh mục', roles: ['admin', 'marketing'] },
            { to: '/dashboard/templates', icon: LayoutTemplate, text: 'Mẫu thiệp', roles: ['admin', 'designer'] },
            { to: '/dashboard/products', icon: ShoppingBag, text: 'Sản phẩm', roles: ['admin', 'designer'] },
        ],
    },
    {
        title: 'Thư viện thiết kế',
        items: [
            { to: '/dashboard/design-assets', icon: Palette, text: 'Tài sản thiết kế', roles: ['admin', 'designer'] },
            { to: '/dashboard/fonts', icon: Type, text: 'Font chữ', roles: ['admin', 'designer'] },
            { to: '/dashboard/media', icon: ImageIcon, text: 'Thư viện ảnh', roles: ['admin'] },
        ],
    },
    {
        title: 'Nội dung website',
        items: [
            { to: '/dashboard/pages', icon: FileText, text: 'Bài viết', roles: ['admin', 'marketing'] },
            { to: '/dashboard/reviews', icon: MessageSquareText, text: 'Đánh giá của khách', roles: ['admin', 'marketing'] },
            { to: '/dashboard/settings', icon: Settings, text: 'Tuỳ chỉnh giao diện', roles: ['admin', 'marketing'] },
        ],
    },
    {
        title: 'Hệ thống',
        items: [
            { to: '/dashboard/users', icon: Users, text: 'Người dùng', roles: ['admin'] },
        ],
    },
];

export const navForRole = (role) => NAV_SECTIONS
    .map(section => ({ ...section, items: section.items.filter(item => item.roles.includes(role)) }))
    .filter(section => section.items.length > 0);

export const canAccess = (role, to) => NAV_SECTIONS.some(s => s.items.some(i => i.to === to && i.roles.includes(role)));

// Mục menu khớp dài nhất với đường dẫn hiện tại (vd /dashboard/templates/design/123 thuộc "Mẫu thiệp").
export const findNavItem = (pathname) => {
    let best = null;
    NAV_SECTIONS.forEach(section => section.items.forEach(item => {
        const hit = item.end ? pathname === item.to || pathname === `${item.to}/` : pathname === item.to || pathname.startsWith(`${item.to}/`);
        if (hit && (!best || item.to.length > best.item.to.length)) best = { section, item };
    }));
    return best;
};
