import React, { useEffect, useMemo, useRef, useState } from 'react';

const AVATAR_FALLBACK = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

const fetchProfile = async (userId) => {
  const res = await fetch(`/users/profile/${userId}`);
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Không lấy được hồ sơ');
  return data.profile;
};

const updateProfile = async (payload) => {
  const res = await fetch('/users/update-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Cập nhật thất bại');
  return data;
};

const changePassword = async (token, currentPassword, newPassword) => {
  const res = await fetch('/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify({ currentPassword, newPassword })
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Đổi mật khẩu thất bại');
  return data;
};

const normalizeProvinceEntry = (entry) => {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim();
  return String(
    entry.TenTinh
      || entry.name
      || entry.ten
      || entry.province
      || entry.label
      || ''
  ).trim();
};

const EmployerAccount = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token') || '';
  const userId = user?.id || user?.MaNguoiDung || user?.userId || user?.userID || null;

  const [loading, setLoading] = useState(true);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    position: '',
    personalLink: '',
    avatarUrl: ''
  });

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [provinces, setProvinces] = useState([]);
  const [isCityOpen, setIsCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');

  const cityDropdownRef = useRef(null);
  const citySearchInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const avatarObjectUrlRef = useRef('');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || user?.AnhDaiDien || AVATAR_FALLBACK);
  const [avatarFile, setAvatarFile] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Local draft cache key per user
  const draftKey = userId ? `employer_profile_draft_${userId}` : null;

  useEffect(() => {
    // Prime UI with cached draft instantly (if available)
    if (draftKey) {
      try {
        const cached = JSON.parse(localStorage.getItem(draftKey) || 'null');
        if (cached && typeof cached === 'object') {
          setForm((prev) => ({ ...prev, ...cached }));
        }
      } catch (_) {}
    }

    if (!userId) {
      setError('Không tìm thấy người dùng. Vui lòng đăng nhập lại.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchProfile(userId);
        if (cancelled) return;
        const serverData = {
          fullName: profile.fullName || '',
          phone: profile.phone || '',
          address: profile.address || '',
          city: profile.city || '',
          position: profile.position || '',
          personalLink: profile.personalLink || '',
          avatarUrl: profile.avatarAbsoluteUrl || profile.avatarUrl || ''
        };

        let cached = null;
        if (draftKey) {
          try {
            cached = JSON.parse(localStorage.getItem(draftKey) || 'null');
          } catch (_) {}
        }

        const combined = cached && typeof cached === 'object'
          ? {
              fullName: cached.fullName || serverData.fullName,
              phone: cached.phone || serverData.phone,
              address: cached.address || serverData.address,
              city: cached.city || serverData.city,
              position: cached.position || serverData.position,
              personalLink: cached.personalLink || serverData.personalLink,
              avatarUrl: cached.avatarUrl || serverData.avatarUrl
            }
          : serverData;

        setForm(combined);
        setAvatarPreview(combined.avatarUrl || AVATAR_FALLBACK);

        if (draftKey) {
          try {
            localStorage.setItem(draftKey, JSON.stringify(combined));
          } catch (_) {}
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không tải được hồ sơ');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, draftKey]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingProvinces(true);
      try {
        const res = await fetch('/api/provinces');
        const payload = await res.json().catch(() => []);
        if (!res.ok) return;

        const source = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        const normalized = Array.from(
          new Set(source.map(normalizeProvinceEntry).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b, 'vi'));

        if (!cancelled) {
          setProvinces(normalized);
        }
      } catch (err) {
        // silent fail
      } finally {
        if (!cancelled) setLoadingProvinces(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isCityOpen) return undefined;

    const closeIfOutside = (event) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target)) {
        setIsCityOpen(false);
      }
    };

    document.addEventListener('mousedown', closeIfOutside);
    return () => document.removeEventListener('mousedown', closeIfOutside);
  }, [isCityOpen]);

  useEffect(() => {
    if (!isCityOpen) return;
    const id = window.setTimeout(() => {
      citySearchInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [isCityOpen]);

  useEffect(() => () => {
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = '';
    }
  }, []);

  const syncLocalUser = (overrides = {}) => {
    try {
      const current = JSON.parse(localStorage.getItem('user') || '{}');
      const next = {
        ...current,
        ...overrides
      };
      localStorage.setItem('user', JSON.stringify(next));
    } catch (_) {}
  };

  const clearPendingAvatar = () => {
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = '';
    }
    setAvatarFile(null);
    setAvatarPreview(form.avatarUrl || AVATAR_FALLBACK);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Ảnh đại diện chỉ nhận JPG, PNG hoặc WEBP.');
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Ảnh đại diện không được vượt quá 5MB.');
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      return;
    }

    setError('');
    setMessage('');
    setAvatarFile(file);

    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    avatarObjectUrlRef.current = objectUrl;
    setAvatarPreview(objectUrl);
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile || !userId || uploadingAvatar) return;

    setUploadingAvatar(true);
    setError('');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      formData.append('userId', String(userId));

      const response = await fetch('/users/upload-avatar', {
        method: 'POST',
        body: formData
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Không thể tải ảnh đại diện lên.');
      }

      const uploadedAvatar = data.absoluteUrl || data.avatarUrl || '';
      const nextForm = { ...form, avatarUrl: uploadedAvatar };
      setForm(nextForm);
      setAvatarPreview(uploadedAvatar || AVATAR_FALLBACK);
      setAvatarFile(null);

      if (draftKey) {
        try {
          localStorage.setItem(draftKey, JSON.stringify(nextForm));
        } catch (_) {}
      }

      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
      if (avatarObjectUrlRef.current) {
        URL.revokeObjectURL(avatarObjectUrlRef.current);
        avatarObjectUrlRef.current = '';
      }

      syncLocalUser({
        avatar: uploadedAvatar,
        AnhDaiDien: uploadedAvatar
      });

      setMessage('Đã cập nhật ảnh đại diện.');
    } catch (err) {
      setError(err.message || 'Không thể tải ảnh đại diện lên.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setMessage('');
    if (!userId) {
      setError('Không tìm thấy người dùng.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ userId, ...form, avatar: form.avatarUrl || '' });
      setMessage('Đã lưu thông tin cá nhân.');
      syncLocalUser({
        name: form.fullName || user?.name || user?.HoTen || '',
        HoTen: form.fullName || user?.HoTen || user?.name || '',
        avatar: form.avatarUrl || user?.avatar || user?.AnhDaiDien || '',
        AnhDaiDien: form.avatarUrl || user?.AnhDaiDien || user?.avatar || ''
      });
      if (draftKey) {
        try {
          localStorage.setItem(draftKey, JSON.stringify(form));
        } catch (_) {}
      }
    } catch (err) {
      setError(err.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setError('');
    setMessage('');
    if (!passwords.current || !passwords.next || !passwords.confirm) {
      setError('Vui lòng nhập đầy đủ mật khẩu.');
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setError('Mật khẩu mới và xác nhận không khớp.');
      return;
    }
    setChangingPass(true);
    try {
      await changePassword(token, passwords.current, passwords.next);
      setMessage('Đổi mật khẩu thành công.');
      setPasswords({ current: '', next: '', confirm: '' });
    } catch (err) {
      setError(err.message || 'Đổi mật khẩu thất bại');
    } finally {
      setChangingPass(false);
    }
  };

  const updateForm = (key, value) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (draftKey) {
      try {
        localStorage.setItem(draftKey, JSON.stringify(next));
      } catch (_) {}
    }
  };

  const onInput = (key) => (e) => {
    updateForm(key, e.target.value);
  };

  const visibleProvinces = useMemo(() => {
    const keyword = String(cityQuery || '').trim().toLowerCase();
    if (!keyword) return provinces;
    return provinces.filter((item) => item.toLowerCase().includes(keyword));
  }, [provinces, cityQuery]);

  const selectedCityLabel = form.city || (loadingProvinces ? 'Đang tải tỉnh/thành...' : 'Chọn tỉnh/thành');

  return (
    <div className="employer-profile-page">
      <div className="card border-0 shadow-sm employer-profile-card">
        <div className="card-body p-4 p-lg-4">
          <div className="employer-profile-header mb-3">
            <div>
              <h4 className="mb-1">Thông tin tài khoản</h4>
              <p className="employer-profile-subtitle mb-0">
                Cập nhật hồ sơ cá nhân theo cùng phong cách bộ lọc của trang tìm kiếm việc làm.
              </p>
            </div>
          </div>

          <section className="employer-avatar-panel mb-3">
            <img
              src={avatarPreview || AVATAR_FALLBACK}
              alt="Ảnh đại diện"
              className="employer-avatar-image"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = AVATAR_FALLBACK;
              }}
            />
            <div className="employer-avatar-content">
              <h6>Ảnh đại diện</h6>
              <p>Ảnh JPG/PNG/WEBP, dung lượng tối đa 5MB.</p>
              <div className="employer-avatar-actions">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="d-none"
                  onChange={handleAvatarSelect}
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  Chọn ảnh
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAvatarUpload}
                  disabled={!avatarFile || uploadingAvatar}
                >
                  {uploadingAvatar ? 'Đang tải lên...' : 'Cập nhật avatar'}
                </button>
                {avatarFile ? (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={clearPendingAvatar}
                    disabled={uploadingAvatar}
                  >
                    Bỏ chọn
                  </button>
                ) : null}
              </div>
              {avatarFile ? <div className="employer-avatar-file">Đã chọn: {avatarFile.name}</div> : null}
            </div>
          </section>

          {error && <div className="alert alert-danger">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}

          {loading ? (
            <p className="text-muted mb-0">Đang tải...</p>
          ) : (
            <>
              <div className="row g-3 mb-2 employer-profile-grid">
                <div className="col-md-6">
                  <label className="form-label">Họ tên</label>
                  <input className="form-control" value={form.fullName} onChange={onInput('fullName')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Số điện thoại</label>
                  <input className="form-control" value={form.phone} onChange={onInput('phone')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Địa chỉ</label>
                  <input className="form-control" value={form.address} onChange={onInput('address')} />
                </div>
                <div className="col-md-6 employer-profile-city">
                  <label className="form-label">Tỉnh / Thành phố</label>
                  <div className={`jf-jobs-select ${isCityOpen ? 'is-open' : ''}`} ref={cityDropdownRef}>
                    <button
                      type="button"
                      className="jf-jobs-select-trigger"
                      onClick={() => {
                        setIsCityOpen((prev) => !prev);
                        setCityQuery('');
                      }}
                      aria-haspopup="listbox"
                      aria-expanded={isCityOpen}
                    >
                      <span className="jf-jobs-select-text">{selectedCityLabel}</span>
                      <i className="bi bi-chevron-down"></i>
                    </button>

                    {isCityOpen ? (
                      <div className="jf-jobs-select-menu jf-jobs-select-menu--location" role="listbox" aria-label="Chọn tỉnh/thành">
                        <div className="jf-jobs-select-search-wrap">
                          <i className="bi bi-search"></i>
                          <input
                            ref={citySearchInputRef}
                            type="text"
                            value={cityQuery}
                            onChange={(event) => setCityQuery(event.target.value)}
                            placeholder="Nhập để tìm tỉnh/thành"
                          />
                        </div>

                        <div className="jf-jobs-select-scroll">
                          {visibleProvinces.length === 0 ? (
                            <div className="jf-jobs-select-empty">Không tìm thấy tỉnh/thành phù hợp</div>
                          ) : (
                            visibleProvinces.map((entry) => (
                              <button
                                key={entry}
                                type="button"
                                className={`jf-jobs-select-option ${form.city === entry ? 'is-active' : ''}`}
                                onClick={() => {
                                  updateForm('city', entry);
                                  setIsCityOpen(false);
                                }}
                              >
                                {entry}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Chức danh</label>
                  <input className="form-control" value={form.position} onChange={onInput('position')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Link cá nhân / Website</label>
                  <input className="form-control" value={form.personalLink} onChange={onInput('personalLink')} />
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2 employer-profile-actions">
                <button className="btn btn-outline-secondary" onClick={() => window.location.reload()} disabled={saving}>Hủy</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thông tin'}</button>
              </div>

              <div className="employer-profile-divider my-4"></div>

              <div className="mb-3">
                <h5 className="mb-1 employer-profile-section-title">Đổi mật khẩu</h5>
                <p className="text-muted mb-0">Nhập mật khẩu hiện tại và mật khẩu mới để bảo mật tài khoản.</p>
              </div>

              <div className="row g-3 mb-2 employer-profile-grid">
                <div className="col-md-4">
                  <label className="form-label">Mật khẩu hiện tại</label>
                  <input type="password" className="form-control" value={passwords.current} onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Mật khẩu mới</label>
                  <input type="password" className="form-control" value={passwords.next} onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Nhập lại mật khẩu mới</label>
                  <input type="password" className="form-control" value={passwords.confirm} onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))} />
                </div>
              </div>

              <div className="d-flex justify-content-end employer-profile-actions">
                <button className="btn btn-primary" onClick={handleChangePassword} disabled={changingPass}>
                  {changingPass ? 'Đang đổi...' : 'Đổi mật khẩu'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployerAccount;
