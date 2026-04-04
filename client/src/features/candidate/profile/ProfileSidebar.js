import React from 'react';
import { PROFILE_NAV_ITEMS } from './profileNavigation';

const ProfileSidebar = ({ activeTab, onChangeTab, userName }) => {
  return (
    <div className="col-md-3">
      <div className="bg-white rounded shadow-sm p-3 mb-3">
        <div className="text-center mb-3">
          <i className="bi bi-emoji-smile text-danger fs-3"></i>
          <span className="ms-2 text-danger fw-semibold">Xin chào</span>
        </div>
        <h5 className="fw-bold text-center mb-4">{userName || 'Người dùng'}</h5>

        <ul className="list-unstyled">
          {PROFILE_NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <li className="mb-2" key={item.key}>
                <button
                  type="button"
                  className={`btn w-100 text-start d-flex align-items-center gap-2 ${isActive ? 'bg-danger bg-opacity-10 text-danger' : 'btn-light'}`}
                  onClick={() => onChangeTab(item.key)}
                >
                  <i className={`bi ${item.icon}`}></i>
                  <span className="fw-semibold">{item.label}</span>
                  {item.badge ? <span className="badge bg-primary ms-auto">{item.badge}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default ProfileSidebar;
