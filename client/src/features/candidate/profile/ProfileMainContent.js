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

const formatViDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN').format(date);
};

const ProfileMainContent = ({
  activeTab,
  user,
  profileSummary,
  interviewInvitations = [],
  invitationsLoading = false,
  invitationsError = '',
  jobsAppliedCount = 0,
  invitationCount = 0,
  onOpenProfileModal,
  onOpenPasswordModal,
  passwordStatus
}) => {
  const currentEmail = user?.email || user?.Email || '';

  return (
    <div className="col-lg-9 col-md-8">
      {activeTab === PROFILE_TAB_OVERVIEW && (
        <>
          <section className="profile-tab-card profile-overview-card mb-3">
            <div className="profile-overview-head">
              <img
                src={user?.avatar || user?.AnhDaiDien || avatarFallback}
                alt="avatar"
                className="profile-overview-avatar"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = avatarFallback;
                }}
              />
              <div className="profile-overview-info">
                <p className="profile-overview-eyebrow">Hồ sơ ứng viên</p>
                <h3>{user?.name || 'Người dùng'}</h3>
                <div className="profile-overview-meta">
                  <span><i className="bi bi-briefcase"></i>{profileSummary.position || 'Chưa cập nhật chức danh'}</span>
                  <span><i className="bi bi-geo-alt"></i>{profileSummary.city || 'Chưa cập nhật thành phố'}</span>
                  <span><i className="bi bi-envelope"></i>{currentEmail || 'Chưa có email'}</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenProfileModal}
                  className="btn profile-primary-btn mt-3"
                >
                  <i className="bi bi-pencil-square me-2"></i>
                  Cập nhật hồ sơ
                </button>
              </div>
            </div>
            <div className="profile-overview-kpis">
              <div className="profile-kpi-item">
                <span>Việc đã ứng tuyển</span>
                <strong>{Number(jobsAppliedCount || 0).toLocaleString('vi-VN')}</strong>
              </div>
              <div className="profile-kpi-item">
                <span>Lời mời mới</span>
                <strong>{Number(invitationCount || 0).toLocaleString('vi-VN')}</strong>
              </div>
              <div className="profile-kpi-item">
                <span>Thông báo</span>
                <strong>0</strong>
              </div>
            </div>
          </section>

          <section className="profile-tab-card profile-overview-actions">
            <h5>Tiếp tục hành trình tìm việc</h5>
            <p>Cập nhật hồ sơ và khám phá cơ hội phù hợp ngay hôm nay.</p>
            <div className="profile-action-grid">
              <Link to="/jobs" className="profile-action-link">
                <i className="bi bi-search"></i>
                <span>Tìm việc làm</span>
              </Link>
              <Link to="/jobs/saved" className="profile-action-link">
                <i className="bi bi-bookmark"></i>
                <span>Việc làm đã lưu</span>
              </Link>
              <Link to="/jobs/applied" className="profile-action-link">
                <i className="bi bi-file-earmark-check"></i>
                <span>Theo dõi ứng tuyển</span>
              </Link>
              <button type="button" className="profile-action-link" onClick={onOpenProfileModal}>
                <i className="bi bi-person-vcard"></i>
                <span>Hoàn thiện hồ sơ</span>
              </button>
            </div>
          </section>
        </>
      )}

      {activeTab === PROFILE_TAB_JOBS && (
        <section className="profile-tab-card profile-section-card">
          <div className="profile-section-head">
            <h5>Việc làm của tôi</h5>
            <p>Quản lý các việc đã lưu và tiến trình ứng tuyển của bạn.</p>
          </div>
          <div className="profile-empty-state">
            <div className="profile-empty-icon"><i className="bi bi-briefcase"></i></div>
            <h6>Bạn chưa ứng tuyển công việc nào</h6>
            <p>Khám phá danh sách việc làm mới nhất và bắt đầu ứng tuyển.</p>
            <Link to="/jobs" className="btn profile-primary-btn">
              Tìm việc làm
            </Link>
          </div>
        </section>
      )}

      {activeTab === PROFILE_TAB_INVITATIONS && (
        <section className="profile-tab-card profile-section-card">
          <div className="profile-section-head">
            <h5>Lời mời phỏng vấn</h5>
            <p>Danh sách công ty đã chuyển hồ sơ ứng tuyển của bạn sang trạng thái phỏng vấn.</p>
          </div>

          {invitationsLoading ? <div className="profile-inline-state">Đang tải lời mời phỏng vấn...</div> : null}

          {!invitationsLoading && invitationsError ? <div className="alert alert-danger mt-3 mb-0">{invitationsError}</div> : null}

          {!invitationsLoading && !invitationsError && interviewInvitations.length === 0 ? (
            <div className="profile-empty-state">
              <div className="profile-empty-icon"><i className="bi bi-envelope-paper"></i></div>
              <h6>Hiện chưa có lời mời phỏng vấn</h6>
              <p>Hãy tiếp tục ứng tuyển và hoàn thiện hồ sơ để tăng tỷ lệ được mời phỏng vấn.</p>
              <button type="button" className="btn profile-outline-btn" onClick={onOpenProfileModal}>
                Cập nhật hồ sơ ngay
              </button>
            </div>
          ) : null}

          {!invitationsLoading && !invitationsError && interviewInvitations.length > 0 ? (
            <div className="profile-invitation-list">
              {interviewInvitations.map((item) => {
                const submittedAt = formatViDate(item?.NgayNop || item?.submittedAt);
                return (
                  <article key={item?.MaUngTuyen || `${item?.MaTin || 'job'}-${item?.TenCongTy || 'company'}`} className="profile-invitation-item">
                    <div className="profile-invitation-logo">
                      <img
                        src={item?.Logo || '/images/logo.png'}
                        alt={item?.TenCongTy || 'Logo công ty'}
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = '/images/logo.png';
                        }}
                      />
                    </div>
                    <div className="profile-invitation-body">
                      <h6>{item?.TieuDe || 'Vị trí đã ứng tuyển'}</h6>
                      <p>
                        {item?.TenCongTy || 'Nhà tuyển dụng'}
                        {item?.ThanhPho ? ` • ${item.ThanhPho}` : ''}
                      </p>
                      <div className="profile-invitation-meta">
                        <span><i className="bi bi-person-badge"></i>{item?.TrangThai || 'Phỏng vấn'}</span>
                        {submittedAt ? <span><i className="bi bi-calendar-check"></i>Nộp hồ sơ: {submittedAt}</span> : null}
                      </div>
                    </div>
                    <Link to={`/jobs/${item?.MaTin}`} className="btn profile-outline-btn profile-invitation-action">
                      Xem tin
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      )}

      {activeTab === PROFILE_TAB_NOTIFICATIONS && (
        <section className="profile-tab-card profile-section-card">
          <div className="profile-section-head">
            <h5>Thông báo</h5>
            <p>Thông tin việc làm mới, nhắc lịch và cập nhật trạng thái hồ sơ.</p>
          </div>
          <div className="profile-empty-state">
            <div className="profile-empty-icon"><i className="bi bi-bell"></i></div>
            <h6>Chưa có thông báo mới</h6>
            <p>Khi có cập nhật quan trọng từ hệ thống, bạn sẽ thấy tại đây.</p>
          </div>
        </section>
      )}

      {activeTab === PROFILE_TAB_SETTINGS && (
        <section className="profile-tab-card profile-section-card profile-settings-card">
          <div className="profile-settings-hero mb-4">
            <span className="profile-settings-hero-icon" aria-hidden="true">
              <i className="bi bi-sliders2"></i>
            </span>
            <div>
              <h5>Cài đặt tài khoản</h5>
              <p>Quản lý bảo mật, hồ sơ cá nhân và cài đặt ứng dụng JobFinder trên thiết bị của bạn.</p>
            </div>
          </div>

          <div className="profile-settings-grid">
            <article className="profile-settings-panel profile-settings-panel--security">
              <div className="profile-settings-panel-head">
                <div>
                  <p className="profile-settings-panel-kicker">Bảo mật</p>
                  <h6>Đổi mật khẩu tài khoản</h6>
                </div>
                <button
                  type="button"
                  className="btn btn-sm profile-outline-btn"
                  onClick={onOpenPasswordModal}
                >
                  <i className="bi bi-key me-1"></i>
                  Đổi mật khẩu
                </button>
              </div>
              <p className="text-muted small mb-0">
                Mật khẩu mới nên có tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường và số để tăng độ an toàn.
              </p>
              {passwordStatus.message && (
                <div className={`alert alert-${passwordStatus.type === 'success' ? 'success' : 'danger'} mt-3 mb-0`} role="alert">
                  {passwordStatus.message}
                </div>
              )}
            </article>

            <article className="profile-settings-panel profile-settings-panel--profile">
              <div className="profile-settings-panel-head">
                <div>
                  <p className="profile-settings-panel-kicker">Hồ sơ</p>
                  <h6>Cập nhật thông tin ứng viên</h6>
                </div>
                <button type="button" className="btn profile-outline-btn" onClick={onOpenProfileModal}>
                  <i className="bi bi-person-vcard me-1"></i>
                  Mở hồ sơ chi tiết
                </button>
              </div>
              <p className="text-muted small mb-0">
                Tối ưu hồ sơ để tăng khả năng được nhà tuyển dụng tìm thấy và gửi lời mời phỏng vấn.
              </p>
            </article>
          </div>

          <article className="profile-settings-panel profile-settings-panel--install mt-4">
            <div className="profile-settings-panel-head mb-3">
              <div>
                <p className="profile-settings-panel-kicker">Ứng dụng</p>
                <h6>Cài đặt JobFinder</h6>
              </div>
            </div>
            <InstallAppPanel />
          </article>
        </section>
      )}
    </div>
  );
};

export default ProfileMainContent;
