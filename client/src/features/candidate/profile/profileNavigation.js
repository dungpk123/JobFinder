export const PROFILE_TAB_OVERVIEW = 'overview';
export const PROFILE_TAB_JOBS = 'jobs';
export const PROFILE_TAB_INVITATIONS = 'invitations';
export const PROFILE_TAB_NOTIFICATIONS = 'notifications';
export const PROFILE_TAB_SETTINGS = 'settings';

export const PROFILE_ALLOWED_TABS = [
  PROFILE_TAB_OVERVIEW,
  PROFILE_TAB_JOBS,
  PROFILE_TAB_INVITATIONS,
  PROFILE_TAB_NOTIFICATIONS,
  PROFILE_TAB_SETTINGS
];

export const PROFILE_NAV_ITEMS = [
  { key: PROFILE_TAB_OVERVIEW, icon: 'bi-grid', label: 'Thông tin cá nhân' },
  { key: PROFILE_TAB_JOBS, icon: 'bi-briefcase', label: 'Việc làm của tôi' },
  { key: PROFILE_TAB_INVITATIONS, icon: 'bi-envelope', label: 'Lời mời phỏng vấn', badge: null },
  { key: PROFILE_TAB_NOTIFICATIONS, icon: 'bi-bell', label: 'Thông báo' },
  { key: PROFILE_TAB_SETTINGS, icon: 'bi-gear', label: 'Cài đặt' }
];

export const normalizeProfileTab = (tab, fallback = PROFILE_TAB_OVERVIEW) =>
  PROFILE_ALLOWED_TABS.includes(tab) ? tab : fallback;
