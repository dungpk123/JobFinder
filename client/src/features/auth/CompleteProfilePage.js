import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from './components/AuthLayout';
import { API_BASE as CLIENT_API_BASE } from '../../config/apiBase';

const CANDIDATE_ROLE = 'Ứng viên';
const EMPLOYER_ROLE = 'Nhà tuyển dụng';
const MAX_AVATAR_FILE_SIZE = 2 * 1024 * 1024;
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, idx) => idx + 1);
const YEAR_OPTIONS = Array.from({ length: 80 }, (_, idx) => new Date().getFullYear() - idx);

const pad2 = (value) => String(value).padStart(2, '0');

const getDaysInMonth = (year, month) => {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
};

const parseBirthdayParts = (value) => {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return { day: '', month: '', year: '' };
  }

  const [yearRaw, monthRaw, dayRaw] = text.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { day: '', month: '', year: '' };
  }

  if (month < 1 || month > 12) {
    return { day: '', month: '', year: '' };
  }

  const maxDay = getDaysInMonth(year, month);
  if (day < 1 || day > maxDay) {
    return { day: '', month: '', year: '' };
  }

  return {
    day: String(day),
    month: String(month),
    year: String(year)
  };
};

const toBirthdayIso = ({ day, month, year }) => {
  const dayNum = Number(day);
  const monthNum = Number(month);
  const yearNum = Number(year);

  if (!Number.isFinite(dayNum) || !Number.isFinite(monthNum) || !Number.isFinite(yearNum)) {
    return '';
  }

  if (monthNum < 1 || monthNum > 12) {
    return '';
  }

  const maxDay = getDaysInMonth(yearNum, monthNum);
  if (dayNum < 1 || dayNum > maxDay) {
    return '';
  }

  return `${yearNum}-${pad2(monthNum)}-${pad2(dayNum)}`;
};

const resolveUserId = (user) => {
  const candidate = user?.id || user?.MaNguoiDung || user?.userId || user?.maNguoiDung;
  const normalized = Number.parseInt(candidate, 10);
  return Number.isFinite(normalized) ? normalized : null;
};

const readJsonStorage = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const CompleteProfilePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const apiBase = CLIENT_API_BASE;

  const token = String(localStorage.getItem('token') || '').trim();
  const currentUser = readJsonStorage('user', {});
  const prefill = useMemo(
    () => location.state?.prefill || readJsonStorage('pending_onboarding_prefill', {}),
    [location.state]
  );

  const roleFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const role = String(params.get('role') || '').trim().toLowerCase();
    if (role === 'employer') return EMPLOYER_ROLE;
    if (role === 'candidate') return CANDIDATE_ROLE;
    if (currentUser?.role === EMPLOYER_ROLE) return EMPLOYER_ROLE;
    if (currentUser?.role === CANDIDATE_ROLE) return CANDIDATE_ROLE;
    return '';
  }, [currentUser?.role, location.search]);

  const [role] = useState(roleFromQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarInputKey, setAvatarInputKey] = useState(0);
  const previewObjectUrlRef = useRef('');

  const initialBirthday = useMemo(
    () => parseBirthdayParts(prefill.birthday),
    [prefill.birthday]
  );

  const [birthdayParts, setBirthdayParts] = useState(initialBirthday);

  const [candidateForm, setCandidateForm] = useState({
    fullName: prefill.fullName || currentUser?.name || '',
    phone: prefill.phone || '',
    address: prefill.address || '',
    birthday: toBirthdayIso(initialBirthday),
    gender: prefill.gender || 'Nam',
    city: '',
    district: '',
    introHtml: '',
    experienceYears: 0,
    education: '',
    avatar: String(prefill.avatar || currentUser?.avatarAbsoluteUrl || currentUser?.avatar || currentUser?.avatarUrl || currentUser?.AnhDaiDien || '').trim(),
    title: '',
    personalLink: ''
  });

  const [avatarPreview, setAvatarPreview] = useState(candidateForm.avatar);

  const [employerForm, setEmployerForm] = useState({
    fullName: prefill.fullName || currentUser?.name || '',
    phone: prefill.phone || '',
    address: prefill.address || '',
    companyName: prefill.companyName || '',
    taxCode: '',
    website: '',
    city: '',
    description: '',
    logo: '',
    industry: ''
  });

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    if (!role || ![CANDIDATE_ROLE, EMPLOYER_ROLE].includes(role)) {
      navigate('/onboarding/role', { replace: true, state: { prefill } });
    }
  }, [navigate, prefill, role, token]);

  useEffect(() => {
    setBirthdayParts(initialBirthday);
  }, [initialBirthday]);

  useEffect(() => {
    setCandidateForm((prev) => ({
      ...prev,
      birthday: toBirthdayIso(birthdayParts)
    }));
  }, [birthdayParts]);

  useEffect(() => () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }
  }, []);

  const birthdayDays = useMemo(() => {
    const yearNum = Number(birthdayParts.year);
    const monthNum = Number(birthdayParts.month);
    const maxDay = getDaysInMonth(yearNum, monthNum);
    return Array.from({ length: maxDay }, (_, idx) => idx + 1);
  }, [birthdayParts.month, birthdayParts.year]);

  if (!token || !role || ![CANDIDATE_ROLE, EMPLOYER_ROLE].includes(role)) {
    return null;
  }

  const handleCandidateChange = (event) => {
    const { name, value } = event.target;
    setCandidateForm((prev) => ({
      ...prev,
      [name]: name === 'experienceYears' ? Number(value) : value
    }));
  };

  const handleEmployerChange = (event) => {
    const { name, value } = event.target;
    setEmployerForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBirthdayPartChange = (event) => {
    const { name, value } = event.target;

    setBirthdayParts((prev) => {
      const next = { ...prev, [name]: value };

      const monthNum = Number(next.month);
      const yearNum = Number(next.year);
      const dayNum = Number(next.day);

      if (Number.isFinite(monthNum) && Number.isFinite(yearNum) && Number.isFinite(dayNum)) {
        const maxDay = getDaysInMonth(yearNum, monthNum);
        if (dayNum > maxDay) {
          next.day = String(maxDay);
        }
      }

      return next;
    });
  };

  const handleAvatarFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');

    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file ảnh hợp lệ.');
      setAvatarFile(null);
      setAvatarInputKey((prev) => prev + 1);
      return;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setError('Ảnh đại diện không được vượt quá 2MB.');
      setAvatarFile(null);
      setAvatarInputKey((prev) => prev + 1);
      return;
    }

    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = '';
    }

    const objectUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = objectUrl;
    setAvatarFile(file);
    setAvatarPreview(objectUrl);
  };

  const clearAvatarSelection = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = '';
    }

    setAvatarFile(null);
    setAvatarPreview('');
    setAvatarInputKey((prev) => prev + 1);
    setCandidateForm((prev) => ({ ...prev, avatar: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    setLoading(true);
    try {
      let payload = {};

      if (role === CANDIDATE_ROLE) {
        if (!candidateForm.fullName || !candidateForm.phone || !candidateForm.birthday) {
          throw new Error('Vui lòng nhập đầy đủ họ tên, số điện thoại và ngày sinh.');
        }

        let resolvedAvatar = String(candidateForm.avatar || '').trim();

        if (avatarFile) {
          const userId = resolveUserId(currentUser);
          if (!userId) {
            throw new Error('Không xác định được tài khoản để tải ảnh đại diện. Vui lòng đăng nhập lại.');
          }

          const avatarBody = new FormData();
          avatarBody.append('avatar', avatarFile);
          avatarBody.append('userId', String(userId));

          const avatarResponse = await fetch('/users/upload-avatar', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: avatarBody
          });

          const avatarData = await avatarResponse.json().catch(() => ({}));
          if (!avatarResponse.ok || !avatarData.success) {
            throw new Error(avatarData.error || 'Không thể tải ảnh đại diện lên hệ thống.');
          }

          resolvedAvatar = String(avatarData.absoluteUrl || avatarData.avatarUrl || '').trim();
          setCandidateForm((prev) => ({ ...prev, avatar: resolvedAvatar }));
          setAvatarPreview(resolvedAvatar);
        }

        payload = {
          role,
          fullName: candidateForm.fullName,
          phone: candidateForm.phone,
          address: candidateForm.address,
          birthday: candidateForm.birthday,
          gender: candidateForm.gender,
          city: candidateForm.city,
          district: candidateForm.district,
          introHtml: candidateForm.introHtml,
          experienceYears: candidateForm.experienceYears,
          education: candidateForm.education,
          avatar: resolvedAvatar,
          title: candidateForm.title,
          personalLink: candidateForm.personalLink
        };
      } else {
        if (!employerForm.fullName || !employerForm.phone || !employerForm.companyName) {
          throw new Error('Vui lòng nhập đầy đủ họ tên, số điện thoại và tên công ty.');
        }

        payload = {
          role,
          fullName: employerForm.fullName,
          phone: employerForm.phone,
          address: employerForm.address,
          companyName: employerForm.companyName,
          taxCode: employerForm.taxCode,
          website: employerForm.website,
          city: employerForm.city,
          description: employerForm.description,
          logo: employerForm.logo,
          industry: employerForm.industry
        };
      }

      const response = await fetch(`${apiBase}/auth/complete-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Không thể lưu hồ sơ.');
      }

      if (data.token && data.user) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      localStorage.removeItem('pending_onboarding_prefill');

      const defaultRedirect = role === EMPLOYER_ROLE ? '/employer' : '/profile';
      navigate(data.redirectTo || defaultRedirect, { replace: true });
    } catch (err) {
      setError(err.message || 'Không thể lưu hồ sơ.');
    } finally {
      setLoading(false);
    }
  };

  const isCandidate = role === CANDIDATE_ROLE;

  return (
    <AuthLayout
      mode="register"
      title={isCandidate ? 'Hoàn thiện hồ sơ ứng viên' : 'Hoàn thiện hồ sơ nhà tuyển dụng'}
      subtitle="Điền thông tin một lần để hệ thống đưa bạn vào đúng khu vực làm việc."
      switchText="Muốn đổi vai trò?"
      switchLabel="Chọn lại vai trò"
      switchTo="/onboarding/role"
      heroImage="/images/auth-career-hero.svg"
      heroTitle="Hoàn thiện hồ sơ để bắt đầu sử dụng hệ thống."
      heroSubtitle="Bạn có thể cập nhật thêm trong trang hồ sơ sau khi hoàn tất bước này."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {isCandidate ? (
          <>
            <div className="auth-grid-two">
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="candidateFullName">Họ tên</label>
                <input id="candidateFullName" name="fullName" className="auth-input" value={candidateForm.fullName} onChange={handleCandidateChange} required />
              </div>
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="candidatePhone">Số điện thoại</label>
                <input id="candidatePhone" name="phone" className="auth-input" value={candidateForm.phone} onChange={handleCandidateChange} required />
              </div>
            </div>

            <div className="auth-grid-two">
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="candidateBirthday">Ngày sinh</label>
                <div className="auth-grid-three auth-birthday-grid">
                  <select
                    id="candidateBirthday"
                    name="day"
                    className="auth-select"
                    value={birthdayParts.day}
                    onChange={handleBirthdayPartChange}
                    required
                  >
                    <option value="">Ngày</option>
                    {birthdayDays.map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>

                  <select
                    name="month"
                    className="auth-select"
                    value={birthdayParts.month}
                    onChange={handleBirthdayPartChange}
                    required
                  >
                    <option value="">Tháng</option>
                    {MONTH_OPTIONS.map((month) => (
                      <option key={month} value={month}>{`Tháng ${month}`}</option>
                    ))}
                  </select>

                  <select
                    name="year"
                    className="auth-select"
                    value={birthdayParts.year}
                    onChange={handleBirthdayPartChange}
                    required
                  >
                    <option value="">Năm</option>
                    {YEAR_OPTIONS.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="candidateGender">Giới tính</label>
                <select id="candidateGender" name="gender" className="auth-select" value={candidateForm.gender} onChange={handleCandidateChange}>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
            </div>

            <div className="auth-grid-two">
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="candidateCity">Thành phố</label>
                <input id="candidateCity" name="city" className="auth-input" value={candidateForm.city} onChange={handleCandidateChange} />
              </div>
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="candidateDistrict">Quận/Huyện</label>
                <input id="candidateDistrict" name="district" className="auth-input" value={candidateForm.district} onChange={handleCandidateChange} />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-field-label" htmlFor="candidateAddress">Địa chỉ</label>
              <input id="candidateAddress" name="address" className="auth-input" value={candidateForm.address} onChange={handleCandidateChange} />
            </div>

            <div className="auth-grid-two">
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="candidateTitle">Chức danh</label>
                <input id="candidateTitle" name="title" className="auth-input" value={candidateForm.title} onChange={handleCandidateChange} />
              </div>
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="candidateExperience">Số năm kinh nghiệm</label>
                <input id="candidateExperience" type="number" min="0" name="experienceYears" className="auth-input" value={candidateForm.experienceYears} onChange={handleCandidateChange} />
              </div>
            </div>

            <div className="auth-grid-two">
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="candidateEducation">Trình độ học vấn</label>
                <input id="candidateEducation" name="education" className="auth-input" value={candidateForm.education} onChange={handleCandidateChange} />
              </div>
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="candidateLink">Link cá nhân</label>
                <input id="candidateLink" name="personalLink" className="auth-input" value={candidateForm.personalLink} onChange={handleCandidateChange} />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-field-label" htmlFor="candidateAvatar">Ảnh đại diện</label>
              <div className="auth-avatar-upload">
                <div className="auth-avatar-preview-wrap" aria-hidden="true">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="avatar preview" className="auth-avatar-preview" />
                  ) : (
                    <div className="auth-avatar-preview-empty">
                      <i className="bi bi-person-circle"></i>
                    </div>
                  )}
                </div>

                <div className="auth-avatar-upload-actions">
                  <input
                    key={avatarInputKey}
                    id="candidateAvatar"
                    type="file"
                    accept="image/*"
                    className="auth-hidden-file-input"
                    onChange={handleAvatarFileChange}
                  />
                  <label htmlFor="candidateAvatar" className="auth-avatar-upload-btn">Tải ảnh lên</label>
                  <button type="button" className="auth-avatar-clear-btn" onClick={clearAvatarSelection}>
                    Xóa ảnh
                  </button>
                  <small className="text-muted d-block">Ảnh vuông, tối đa 2MB.</small>
                </div>
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-field-label" htmlFor="candidateIntro">Giới thiệu bản thân</label>
              <textarea id="candidateIntro" name="introHtml" className="auth-input" style={{ height: 100, paddingTop: 10 }} value={candidateForm.introHtml} onChange={handleCandidateChange} />
            </div>
          </>
        ) : (
          <>
            <div className="auth-grid-two">
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="employerFullName">Họ tên người đại diện</label>
                <input id="employerFullName" name="fullName" className="auth-input" value={employerForm.fullName} onChange={handleEmployerChange} required />
              </div>
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="employerPhone">Số điện thoại</label>
                <input id="employerPhone" name="phone" className="auth-input" value={employerForm.phone} onChange={handleEmployerChange} required />
              </div>
            </div>

            <div className="auth-grid-two">
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="employerCompanyName">Tên công ty</label>
                <input id="employerCompanyName" name="companyName" className="auth-input" value={employerForm.companyName} onChange={handleEmployerChange} required />
              </div>
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="employerTaxCode">Mã số thuế</label>
                <input id="employerTaxCode" name="taxCode" className="auth-input" value={employerForm.taxCode} onChange={handleEmployerChange} />
              </div>
            </div>

            <div className="auth-grid-two">
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="employerCity">Thành phố</label>
                <input id="employerCity" name="city" className="auth-input" value={employerForm.city} onChange={handleEmployerChange} />
              </div>
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="employerIndustry">Lĩnh vực</label>
                <input id="employerIndustry" name="industry" className="auth-input" value={employerForm.industry} onChange={handleEmployerChange} />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-field-label" htmlFor="employerAddress">Địa chỉ</label>
              <input id="employerAddress" name="address" className="auth-input" value={employerForm.address} onChange={handleEmployerChange} />
            </div>

            <div className="auth-grid-two">
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="employerWebsite">Website</label>
                <input id="employerWebsite" name="website" className="auth-input" value={employerForm.website} onChange={handleEmployerChange} />
              </div>
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="employerLogo">Logo (URL)</label>
                <input id="employerLogo" name="logo" className="auth-input" value={employerForm.logo} onChange={handleEmployerChange} />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-field-label" htmlFor="employerDescription">Mô tả công ty</label>
              <textarea id="employerDescription" name="description" className="auth-input" style={{ height: 120, paddingTop: 10 }} value={employerForm.description} onChange={handleEmployerChange} />
            </div>
          </>
        )}

        {error ? <div className="auth-error-banner">{error}</div> : null}

        <button type="submit" className="auth-submit-btn" disabled={loading}>
          {loading ? 'Đang lưu...' : 'Hoàn tất'}
          <i className="bi bi-arrow-right"></i>
        </button>
      </form>
    </AuthLayout>
  );
};

export default CompleteProfilePage;
