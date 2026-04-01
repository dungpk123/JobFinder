import React, { useEffect, useState } from 'react';

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
    personalLink: ''
  });

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [provinces, setProvinces] = useState([]);

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
          personalLink: profile.personalLink || ''
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
              personalLink: cached.personalLink || serverData.personalLink
            }
          : serverData;

        setForm(combined);

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
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingProvinces(true);
      try {
        const res = await fetch('/api/provinces');
        const data = await res.json().catch(() => []);
        if (!res.ok) return;
        if (!cancelled && Array.isArray(data)) setProvinces(data);
      } catch (err) {
        // silent fail
      } finally {
        if (!cancelled) setLoadingProvinces(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    setError('');
    setMessage('');
    if (!userId) {
      setError('Không tìm thấy người dùng.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ userId, ...form });
      setMessage('Đã lưu thông tin cá nhân.');
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

  const onInput = (key) => (e) => {
    const next = { ...form, [key]: e.target.value };
    setForm(next);
    if (draftKey) {
      try {
        localStorage.setItem(draftKey, JSON.stringify(next));
      } catch (_) {}
    }
  };

  const filteredProvinces = provinces.filter((p) =>
    !form.city ? true : String(p).toLowerCase().includes(String(form.city).toLowerCase())
  ).slice(0, 20);

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h4 className="mb-0">Thông tin tài khoản</h4>
            <small className="text-muted">Cập nhật họ tên, SĐT, địa chỉ và liên kết cá nhân.</small>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <p className="text-muted mb-0">Đang tải...</p>
        ) : (
          <>
            <div className="row g-3 mb-2">
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
              <div className="col-md-6">
                <label className="form-label">Thành phố</label>
                <input
                  className="form-control"
                  list="province-list"
                  value={form.city}
                  onChange={onInput('city')}
                  placeholder={loadingProvinces ? 'Đang tải danh sách tỉnh/thành...' : 'Gõ để tìm tỉnh/thành'}
                />
                <datalist id="province-list">
                  {filteredProvinces.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
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
            <div className="d-flex justify-content-end gap-2">
              <button className="btn btn-outline-secondary" onClick={() => window.location.reload()} disabled={saving}>Hủy</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thông tin'}</button>
            </div>

            <hr className="my-4" />

            <div className="mb-3">
              <h5 className="mb-1">Đổi mật khẩu</h5>
              <small className="text-muted">Nhập mật khẩu hiện tại và mật khẩu mới.</small>
            </div>
            <div className="row g-3 mb-2">
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
            <div className="d-flex justify-content-end">
              <button className="btn btn-primary" onClick={handleChangePassword} disabled={changingPass}>
                {changingPass ? 'Đang đổi...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmployerAccount;
