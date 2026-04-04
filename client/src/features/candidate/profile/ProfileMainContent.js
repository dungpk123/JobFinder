import React from 'react';
import { Link } from 'react-router-dom';
import InstallAppPanel from '../../../components/pwa/InstallAppPanel';
import {
  PROFILE_TAB_INVITATIONS,
  PROFILE_TAB_JOBS,
  PROFILE_TAB_NOTIFICATIONS,
  PROFILE_TAB_OVERVIEW,
  PROFILE_TAB_SETTINGS
} from './profileNavigation';

const avatarFallback = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

const ProfileMainContent = ({
  activeTab,
  user,
  profileSummary,
  onGoSettings,
  showPasswordForm,
  setShowPasswordForm,
  passwordForm,
  setPasswordForm,
  passwordShort,
  passwordMismatch,
  isPasswordValid,
  isChangingPassword,
  onPasswordChange,
  passwordStatus,
  setPasswordStatus
}) => {
  return (
    <div className="col-md-9">
      {activeTab === PROFILE_TAB_OVERVIEW && (
        <>
          <div className="bg-white rounded shadow-sm p-4 mb-3">
            <div className="d-flex align-items-start gap-4">
              <img
                src={user?.avatar || user?.AnhDaiDien || avatarFallback}
                alt="avatar"
                className="rounded-circle"
                style={{ width: 80, height: 80, objectFit: 'cover' }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = avatarFallback;
                }}
              />
              <div className="flex-grow-1">
                <h3 className="fw-bold mb-2">{user?.name || 'Người dùng'}</h3>
                <div className="d-flex align-items-center gap-3 text-muted mb-2">
                  <div>
                    <i className="bi bi-briefcase me-2"></i>
                    <span>{profileSummary.position || 'Chưa cập nhật chức danh'}</span>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 text-muted">
                  <i className="bi bi-envelope me-1"></i>
                  <span>{user?.email || ''}</span>
                </div>
                <button
                  type="button"
                  onClick={onGoSettings}
                  className="btn btn-link text-primary text-decoration-none mt-2 p-0"
                >
                  Cập nhật hồ sơ <i className="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded shadow-sm p-4 mb-3">
            <h5 className="fw-bold mb-3">Hoàn thiện hồ sơ cá nhân</h5>
            <p className="text-muted mb-3">
              Cập nhật thông tin cơ bản, số điện thoại và mật khẩu để nhà tuyển dụng dễ liên hệ hơn.
            </p>
            <button type="button" className="btn btn-primary" onClick={onGoSettings}>
              Đi tới Cài đặt
            </button>
          </div>
        </>
      )}

      {activeTab === PROFILE_TAB_JOBS && (
        <div className="bg-white rounded shadow-sm p-4">
          <h5 className="fw-bold mb-3">Việc làm của tôi</h5>
          <div className="text-center py-5">
            <i className="bi bi-briefcase text-secondary" style={{ fontSize: '4rem' }}></i>
            <p className="text-muted mt-3">Bạn chưa ứng tuyển công việc nào</p>
            <Link to="/jobs" className="btn btn-primary mt-2">
              Tìm việc làm
            </Link>
          </div>
        </div>
      )}

      {activeTab === PROFILE_TAB_INVITATIONS && (
        <div className="bg-white rounded shadow-sm p-4">
          <h5 className="fw-bold mb-3">Lời mời công việc</h5>
          <div className="text-center py-5">
            <i className="bi bi-envelope text-secondary" style={{ fontSize: '4rem' }}></i>
            <p className="text-muted mt-3">Bạn chưa có lời mời công việc nào</p>
          </div>
        </div>
      )}

      {activeTab === PROFILE_TAB_NOTIFICATIONS && (
        <div className="bg-white rounded shadow-sm p-4">
          <h5 className="fw-bold mb-3">Thông báo</h5>
          <p className="text-muted">Bạn chưa có thông báo nào</p>
        </div>
      )}

      {activeTab === PROFILE_TAB_SETTINGS && (
        <div className="bg-white rounded shadow-sm p-4">
          <h5 className="fw-bold mb-3">Cài đặt</h5>
          <div className="mb-4">
            <h6 className="fw-semibold mb-3">Thông tin cá nhân</h6>
            <div className="mb-3">
              <label className="form-label">Họ và tên</label>
              <input type="text" className="form-control" defaultValue={user?.name || ''} />
            </div>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" defaultValue={user?.email || ''} disabled />
            </div>
            <div className="mb-3">
              <label className="form-label">Số điện thoại</label>
              <input type="tel" className="form-control" defaultValue={user?.phone || ''} placeholder="Nhập số điện thoại" />
            </div>
          </div>

          <div className="mb-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="fw-semibold mb-0">Đổi mật khẩu</h6>
              {!showPasswordForm && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => setShowPasswordForm(true)}
                >
                  <i className="bi bi-key me-1"></i>Đổi mật khẩu
                </button>
              )}
            </div>
            {showPasswordForm && (
              <>
                <div className="mb-3">
                  <label className="form-label">Mật khẩu hiện tại</label>
                  <input
                    type="password"
                    className="form-control"
                    value={passwordForm.current}
                    onChange={(e) => {
                      setPasswordForm({ ...passwordForm, current: e.target.value });
                      setPasswordStatus({ type: '', message: '' });
                    }}
                    placeholder="Nhập mật khẩu hiện tại"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Mật khẩu mới</label>
                  <input
                    type="password"
                    className={`form-control ${passwordShort ? 'is-invalid' : ''}`}
                    value={passwordForm.next}
                    onChange={(e) => {
                      setPasswordForm({ ...passwordForm, next: e.target.value });
                      setPasswordStatus({ type: '', message: '' });
                    }}
                    placeholder="Tối thiểu 8 ký tự"
                  />
                  {passwordShort && <div className="invalid-feedback">Mật khẩu mới phải có ít nhất 8 ký tự.</div>}
                </div>
                <div className="mb-3">
                  <label className="form-label">Xác nhận mật khẩu mới</label>
                  <input
                    type="password"
                    className={`form-control ${passwordMismatch ? 'is-invalid' : ''}`}
                    value={passwordForm.confirm}
                    onChange={(e) => {
                      setPasswordForm({ ...passwordForm, confirm: e.target.value });
                      setPasswordStatus({ type: '', message: '' });
                    }}
                    placeholder="Nhập lại mật khẩu mới"
                  />
                  {passwordMismatch && <div className="invalid-feedback">Mật khẩu xác nhận không khớp.</div>}
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!isPasswordValid || isChangingPassword}
                    onClick={onPasswordChange}
                  >
                    {isChangingPassword ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordForm({ current: '', next: '', confirm: '' });
                      setPasswordStatus({ type: '', message: '' });
                    }}
                  >
                    Hủy
                  </button>
                </div>
                {passwordStatus.message && (
                  <div className={`alert alert-${passwordStatus.type === 'success' ? 'success' : 'danger'} mt-3 mb-0`} role="alert">
                    {passwordStatus.message}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mb-4">
            <InstallAppPanel />
          </div>
          <button type="button" className="btn btn-outline-secondary">Lưu thay đổi</button>
        </div>
      )}
    </div>
  );
};

export default ProfileMainContent;
