import React from 'react';
import { PROFILE_NAV_ITEMS } from './profileNavigation';
import { PROFILE_TAB_INVITATIONS } from './profileNavigation';

const ProfileSidebar = ({ activeTab, onChangeTab, userName, invitationCount = 0 }) => {
  return (
    <div className="col-lg-3 col-md-4">
      <aside className="profile-sidebar-card">
        <div className="profile-sidebar-head">
          <span className="profile-sidebar-greeting-icon">
            <i className="bi bi-stars"></i>
          </span>
          <p>Xin chào</p>
          <h5>{userName || 'Người dùng'}</h5>
        </div>

        <ul className="profile-nav-list">
          {PROFILE_NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.key;
            const badgeValue =
              item.key === PROFILE_TAB_INVITATIONS && Number(invitationCount) > 0
                ? String(invitationCount)
                : item.badge;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  className={`profile-nav-btn ${isActive ? 'active' : ''}`}
                  onClick={() => onChangeTab(item.key)}
                >
                  <span className="profile-nav-icon"><i className={`bi ${item.icon}`}></i></span>
                  <span className="profile-nav-label">{item.label}</span>
                  {badgeValue ? <span className="profile-nav-badge">{badgeValue}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
};

export default ProfileSidebar;
