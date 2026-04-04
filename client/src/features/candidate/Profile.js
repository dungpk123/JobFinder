import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useNotification } from '../../components/NotificationProvider';
import ProfileSidebar from './profile/ProfileSidebar';
import ProfileMainContent from './profile/ProfileMainContent';
import { PROFILE_TAB_SETTINGS, normalizeProfileTab } from './profile/profileNavigation';

const Profile = ({ initialTab = 'overview' }) => {
    const location = useLocation();
    const { notify } = useNotification();
    const user = useMemo(() => {
        try {
            const u = JSON.parse(localStorage.getItem('user'));
            // Ưu tiên avatar, fallback AnhDaiDien
            if (u && !u.avatar && u.AnhDaiDien) u.avatar = u.AnhDaiDien;
            return u;
        } catch {
            return null;
        }
    }, []);
    const userId = user?.id || user?.MaNguoiDung || user?.maNguoiDung || user?.userId || user?.userID;

    const [activeTab, setActiveTab] = useState(() => normalizeProfileTab(initialTab));
    const [showEditModal, setShowEditModal] = useState(false);
    const [showIntroModal, setShowIntroModal] = useState(false);
    const [introHtml, setIntroHtml] = useState('');
    const [universities, setUniversities] = useState([]);
    const [provinces, setProvinces] = useState([]);
    const [provinceQuery, setProvinceQuery] = useState('');
    const [provinceSuggestions, setProvinceSuggestions] = useState([]);
    const [showProvinceSuggestions, setShowProvinceSuggestions] = useState(false);
    const provinceDropdownRef = useRef(null);
    const [showEducationModal, setShowEducationModal] = useState(false);
    const [educationList, setEducationList] = useState([]);
    const [educationForm, setEducationForm] = useState({ 
        university: '',
        level: '',
        major: '',
        startMonth: '',
        startYear: '',
        endMonth: '',
        endYear: '',
        isCurrentlyStudying: false,
        description: ''
    });
    const [universityQuery, setUniversityQuery] = useState('');
    const [universitySuggestions, setUniversitySuggestions] = useState([]);
    const [showUniversitySuggestions, setShowUniversitySuggestions] = useState(false);
    const [isUniversityLoading, setIsUniversityLoading] = useState(false);
    const [universityError, setUniversityError] = useState('');
    const [showWorkModal, setShowWorkModal] = useState(false);
    const [workList, setWorkList] = useState([]);
    const [workForm, setWorkForm] = useState({
        position: '',
        company: '',
        startMonth: '',
        startYear: '',
        endMonth: '',
        endYear: '',
        isCurrentlyWorking: false,
        descriptionHtml: ''
    });
    const [showLanguageModal, setShowLanguageModal] = useState(false);
    const [languageList, setLanguageList] = useState([]);
    const [languageForm, setLanguageForm] = useState({
        language: '',
        level: ''
    });
    const [showCertificateModal, setShowCertificateModal] = useState(false);
    const [certificateList, setCertificateList] = useState([]);
    const [certificateForm, setCertificateForm] = useState({
        name: '',
        organization: '',
        month: '',
        year: '',
        link: '',
        descriptionHtml: ''
    });
    const certificateEditorRef = useRef(null);
    const [showAwardModal, setShowAwardModal] = useState(false);
    const [awardList, setAwardList] = useState([]);
    const [awardForm, setAwardForm] = useState({
        name: '',
        organization: '',
        month: '',
        year: '',
        descriptionHtml: ''
    });
    const awardEditorRef = useRef(null);
    const [cvList, setCvList] = useState([]);
    const [isCvUploading, setIsCvUploading] = useState(false);
    const fileInputRef = useRef(null);
    const avatarInputRef = useRef(null);
    const [avatarPreview, setAvatarPreview] = useState(user?.avatar || user?.AnhDaiDien || "https://cdn-icons-png.flaticon.com/512/149/149071.png");
    const [avatarFile, setAvatarFile] = useState(null);
    const [showCvPreview, setShowCvPreview] = useState(false);
    const [selectedCv, setSelectedCv] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [cvPendingDelete, setCvPendingDelete] = useState(null);
    const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
    const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' });
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [formData, setFormData] = useState({
        fullName: user?.name || 'Người dùng',
        position: '',
        email: user?.email || '',
        phone: '',
        birthday: '',
        gender: 'Nam',
        city: '',
        address: '',
        personalLink: ''
    });
    const [profileSummary, setProfileSummary] = useState({
        position: '',
        phone: '',
        birthday: '',
        gender: 'Nam',
        city: '',
        personalLink: ''
    });

    useEffect(() => {
        const tabFromQuery = new URLSearchParams(location.search).get('tab');
        setActiveTab(normalizeProfileTab(tabFromQuery || initialTab || 'overview'));
    }, [initialTab, location.search]);
    const editorRef = useRef(null);
    const workEditorRef = useRef(null);
    const universityDropdownRef = useRef(null);

    const sanitizePlainText = (html = '') =>
        html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/&nbsp;/g, ' ')
            .replace(/<[^>]+>/g, '')
            .replace(/\u00a0/g, ' ')
            .replace(/\s+$/g, '')
            .trim();

    const escapeRegExp = (str = '') => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const highlightMatch = (text, query) => {
        if (!query) return text;
        const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    };

    const placeCaretAtEnd = (element) => {
        if (!element) return;
        element.focus();
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    };

    const applyFormatting = (command) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        document.execCommand(command, false, undefined);
    };

    const applyWorkFormatting = (command) => {
        if (!workEditorRef.current) return;
        workEditorRef.current.focus();
        document.execCommand(command, false, undefined);
    };

    const applyCertificateFormatting = (command) => {
        if (!certificateEditorRef.current) return;
        certificateEditorRef.current.focus();
        document.execCommand(command, false, undefined);
    };

    const applyAwardFormatting = (command) => {
        if (!awardEditorRef.current) return;
        awardEditorRef.current.focus();
        document.execCommand(command, false, undefined);
    };

    const fetchCvs = useCallback(async () => {
        if (!userId) return;
        try {
            const res = await fetch(`/api/cvs?userId=${userId}`);
            const data = await res.json();
            if (!res.ok || !data.success) {
                console.warn('Load CVs failed', data.error);
                return;
            }
            const normalized = data.cvs.map(cv => ({
                ...cv,
                uploadDate: cv.uploadDate ? new Date(cv.uploadDate).toLocaleDateString('vi-VN') : ''
            }));
            setCvList(normalized);
        } catch (err) {
            console.warn('Load CVs error', err);
        }
    }, [userId]);

    const handleCvUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
            notify({ type: 'error', message: 'Chỉ chấp nhận file PDF, DOC, hoặc DOCX' });
            e.target.value = '';
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            notify({ type: 'error', message: 'Kích thước file không được vượt quá 5MB' });
            e.target.value = '';
            return;
        }

        if (!userId) {
            notify({ type: 'error', message: 'Vui lòng đăng nhập lại để tải CV.' });
            e.target.value = '';
            return;
        }

        const form = new FormData();
        form.append('cvFile', file);
        form.append('userId', userId);
        form.append('cvTitle', file.name);

        setIsCvUploading(true);
        try {
            const res = await fetch('/api/cvs', {
                method: 'POST',
                body: form
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Không thể tải CV lên.');
            }
            await fetchCvs();
            notify({ type: 'success', message: 'Tải CV lên thành công.' });
        } catch (err) {
            notify({ type: 'error', message: err.message || 'Không thể tải CV lên.' });
        } finally {
            setIsCvUploading(false);
            e.target.value = '';
        }
    };

    const handleDeleteCv = async (cv) => {
        if (!cv) return;
        if (!userId) {
            notify({ type: 'error', message: 'Vui lòng đăng nhập lại để xóa CV.' });
            return;
        }

        try {
            const res = await fetch(`/api/cvs/${cv.id}?userId=${userId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Không thể xóa CV.');
            }
            setCvList(prev => prev.filter(item => item.id !== cv.id));
            setCvPendingDelete(null);
        } catch (err) {
            notify({ type: 'error', message: err.message || 'Không thể xóa CV. Vui lòng thử lại.' });
        }
    };

    const confirmDeleteCv = (cv) => {
        setCvPendingDelete(cv);
    };

    const handlePreviewCv = (cv) => {
        setSelectedCv(cv);
        setShowCvPreview(true);
    };

    const handlePasswordChange = async () => {
        if (!isPasswordValid || isChangingPassword) return;
        setIsChangingPassword(true);
        setPasswordStatus({ type: '', message: '' });

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Vui lòng đăng nhập lại để đổi mật khẩu.');
            }

            const response = await fetch('/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: passwordForm.current,
                    newPassword: passwordForm.next
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Đổi mật khẩu thất bại.');
            }

            setPasswordStatus({ type: 'success', message: data.message || 'Đổi mật khẩu thành công.' });
            setPasswordForm({ current: '', next: '', confirm: '' });
        } catch (error) {
            setPasswordStatus({ type: 'error', message: error.message || 'Có lỗi xảy ra. Vui lòng thử lại.' });
        } finally {
            setIsChangingPassword(false);
        }
    };

    useEffect(() => {
        if (showIntroModal && editorRef.current) {
            editorRef.current.innerHTML = introHtml || '';
            placeCaretAtEnd(editorRef.current);
        }
    }, [showIntroModal]);

    useEffect(() => {
        if (showWorkModal && workEditorRef.current) {
            workEditorRef.current.innerHTML = workForm.descriptionHtml || '';
            placeCaretAtEnd(workEditorRef.current);
        }
    }, [showWorkModal]);

    useEffect(() => {
        if (showCertificateModal && certificateEditorRef.current) {
            certificateEditorRef.current.innerHTML = certificateForm.descriptionHtml || '';
            placeCaretAtEnd(certificateEditorRef.current);
        }
    }, [showCertificateModal]);

    useEffect(() => {
        if (showAwardModal && awardEditorRef.current) {
            awardEditorRef.current.innerHTML = awardForm.descriptionHtml || '';
            placeCaretAtEnd(awardEditorRef.current);
        }
    }, [showAwardModal]);

    useEffect(() => {
        setPreviewUrl(selectedCv?.fileAbsoluteUrl || null);
    }, [selectedCv]);

    useEffect(() => {
        fetchCvs();
    }, [fetchCvs]);

    useEffect(() => {   
        let aborted = false;
        (async () => {
            try {
                setUniversityError('');
                // Call local proxy API (proxied by React dev server to backend)
                const res = await fetch('/api/universities');
                if (!res.ok) throw new Error('API error');
                const data = await res.json();
                if (!aborted && Array.isArray(data) && data.length) {
                    setUniversities(data);
                    setUniversitySuggestions(data.slice(0, 15));
                }
            } catch (err) {
                console.warn('Failed to load universities', err);
                const fallback = ['Đại học Bách Khoa Hà Nội', 'Đại học Quốc gia Hà Nội', 'Đại học Quốc gia TP.HCM', 'Đại học Kinh tế Quốc dân'];
                if (!aborted) {
                    setUniversities(fallback);
                    setUniversitySuggestions(fallback);
                }
            }
        })();
        return () => { aborted = true; };
    }, []);

    // Load provinces - use local data instead of API
    useEffect(() => {
        const fallback = [
            'Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ',
            'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Kạn',
            'Bạc Liêu', 'Bắc Ninh', 'Bến Tre', 'Bình Dương', 'Bình Phước',
            'Bình Thuận', 'Cà Mau', 'Cao Bằng', 'Đắk Lắk', 'Đắk Nông',
            'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Giang',
            'Hà Nam', 'Hà Tĩnh', 'Hải Dương', 'Hậu Giang', 'Hòa Bình',
            'Hưng Yên', 'Khánh Hòa', 'Kiên Giang', 'Kon Tum', 'Lai Châu',
            'Lâm Đồng', 'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định',
            'Nghệ An', 'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Phú Yên',
            'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị',
            'Sóc Trăng', 'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên',
            'Thanh Hóa', 'Thừa Thiên Huế', 'Tiền Giang', 'Trà Vinh',
            'Tuyên Quang', 'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái'
        ];
        setProvinces(fallback);
        setProvinceSuggestions(fallback.slice(0, 10));
    }, []);

    useEffect(() => {
        if (!showEducationModal) return;
        if (!universityQuery.trim()) {
            setUniversitySuggestions(universities.slice(0, 15));
            return;
        }

        const timeout = setTimeout(() => {
            // Simple client-side filtering from already loaded universities list
            const query = universityQuery.trim().toLowerCase();
            const filtered = universities.filter(name =>
                name.toLowerCase().includes(query)
            ).slice(0, 20);

            setUniversitySuggestions(filtered.length ? filtered : universities.slice(0, 10));
        }, 300);

        return () => {
            clearTimeout(timeout);
        };
    }, [universityQuery, showEducationModal, universities]);

    // Filter provinces when user types
    useEffect(() => {
        if (!provinceQuery.trim()) {
            setProvinceSuggestions(provinces.slice(0, 10));
            return;
        }

        const timeout = setTimeout(() => {
            const query = provinceQuery.trim().toLowerCase();
            const filtered = provinces.filter(name =>
                name.toLowerCase().includes(query)
            ).slice(0, 20);

            setProvinceSuggestions(filtered.length ? filtered : provinces.slice(0, 10));
        }, 300);

        return () => clearTimeout(timeout);
    }, [provinceQuery, provinces]);

    useEffect(() => {
        if (!showEditModal) {
            setShowProvinceSuggestions(false);
            setProvinceQuery('');
            return;
        }
        setProvinceQuery(formData.city || '');
    }, [formData.city, showEditModal]);

    useEffect(() => {
        setProfileSummary({
            position: formData.position,
            phone: formData.phone,
            birthday: formData.birthday,
            gender: formData.gender,
            city: formData.city,
            personalLink: formData.personalLink
        });
    }, [
        formData.position,
        formData.phone,
        formData.birthday,
        formData.gender,
        formData.city,
        formData.personalLink
    ]);

    useEffect(() => {
        if (!showEducationModal) {
            setShowUniversitySuggestions(false);
            setUniversityQuery('');
            return;
        }
        setUniversityQuery(educationForm.university || '');
    }, [showEducationModal]);

    // Load profile data from server on mount
    useEffect(() => {
        if (!userId) return;

        let aborted = false;
        (async () => {
            try {
                const res = await fetch(`/users/profile/${userId}`);
                const data = await res.json();
                if (!res.ok || !data.success || aborted) {
                    if (!aborted) console.warn('Load profile failed', data.error);
                    return;
                }
                const p = data.profile || {};
                setFormData(prev => ({
                    ...prev,
                    fullName: p.fullName || prev.fullName,
                    position: p.position || prev.position,
                    email: p.email || prev.email,
                    phone: p.phone || '',
                    birthday: p.birthday || '',
                    gender: p.gender || 'Nam',
                    city: p.city || '',
                    address: p.address || '',
                    personalLink: p.personalLink || prev.personalLink
                }));
                const avatarFromServer = p.avatarAbsoluteUrl || p.avatarUrl || '';
                if (avatarFromServer) {
                    setAvatarPreview(avatarFromServer);
                    // Đồng bộ vào localStorage để tránh mất avatar sau đăng nhập lại
                    try {
                        const current = JSON.parse(localStorage.getItem('user')) || {};
                        const updated = { ...current, avatar: avatarFromServer, AnhDaiDien: avatarFromServer };
                        localStorage.setItem('user', JSON.stringify(updated));
                    } catch {}
                }

            } catch (err) {
                if (!aborted) console.warn('Load profile error', err);
            }
        })();

        return () => {
            aborted = true;
        };
    }, [userId]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (universityDropdownRef.current && !universityDropdownRef.current.contains(event.target)) {
                setShowUniversitySuggestions(false);
            }
            if (provinceDropdownRef.current && !provinceDropdownRef.current.contains(event.target)) {
                setShowProvinceSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const introPlainText = sanitizePlainText(introHtml);
    const workPlainText = sanitizePlainText(workForm.descriptionHtml);
    const certificatePlainText = sanitizePlainText(certificateForm.descriptionHtml);
    const awardPlainText = sanitizePlainText(awardForm.descriptionHtml);
    const isEducationValid = (
        educationForm.university &&
        educationForm.level &&
        educationForm.major &&
        educationForm.startMonth &&
        educationForm.startYear &&
        (educationForm.isCurrentlyStudying || (educationForm.endMonth && educationForm.endYear))
    );
    const isWorkValid = (
        workForm.position &&
        workForm.company &&
        workForm.startMonth &&
        workForm.startYear &&
        (workForm.isCurrentlyWorking || (workForm.endMonth && workForm.endYear))
    );
    const isCertificateValid = (
        certificateForm.name &&
        certificateForm.organization &&
        certificateForm.month &&
        certificateForm.year
    );
    const isAwardValid = (
        awardForm.name &&
        awardForm.organization &&
        awardForm.month &&
        awardForm.year
    );
    const selectedFileName = selectedCv?.name?.toLowerCase() || '';
    const isPdfPreview = selectedFileName.endsWith('.pdf');
    const fileTypeLabel = isPdfPreview ? 'PDF' : 'DOC/DOCX';
    const passwordMismatch = passwordForm.confirm && passwordForm.next !== passwordForm.confirm;
    const passwordShort = passwordForm.next && passwordForm.next.length < 8;
    const isPasswordValid = (
        passwordForm.current &&
        passwordForm.next.length >= 8 &&
        passwordForm.next === passwordForm.confirm &&
        passwordForm.current !== passwordForm.next
    );

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSaveProfile = async () => {
        // Ưu tiên id dạng số, fallback MaNguoiDung
        let userId = user?.id || user?.MaNguoiDung || user?.maNguoiDung || user?.userId;
        if (!userId && user) {
            notify({ type: 'error', message: 'Không xác định được userId. Vui lòng đăng xuất và đăng nhập lại.' });
            console.error('User object không có userId:', user);
            return;
        }
        
        // Ensure userId is a number
        userId = parseInt(userId, 10);
        if (isNaN(userId)) {
            notify({ type: 'error', message: 'userId không hợp lệ. Vui lòng đăng xuất và đăng nhập lại.' });
            return;
        }

        // Upload avatar nếu có
        let newAvatarUrl = null;
        if (avatarFile) {
            const form = new FormData();
            form.append('avatar', avatarFile);
            form.append('userId', userId);
            try {
                const res = await fetch('/users/upload-avatar', {
                    method: 'POST',
                    body: form
                });
                const data = await res.json();
                if (data.success && (data.absoluteUrl || data.avatarUrl)) {
                    newAvatarUrl = data.absoluteUrl || data.avatarUrl;
                    console.log('Avatar uploaded successfully:', newAvatarUrl);
                } else {
                    notify({ type: 'error', message: 'Lỗi upload ảnh: ' + (data.error || 'Không rõ') });
                    return;
                }
            } catch (err) {
                notify({ type: 'error', message: 'Lỗi upload ảnh: ' + err.message });
                return;
            }
        }

        // Lưu thông tin cá nhân vào database
        try {
            const res = await fetch('/users/update-profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId,
                    fullName: formData.fullName,
                    position: formData.position,
                    phone: formData.phone,
                    birthday: formData.birthday,
                    gender: formData.gender,
                    city: formData.city,
                    address: formData.address,
                    personalLink: formData.personalLink
                })
            });

            const data = await res.json();
            if (!data.success) {
                notify({ type: 'error', message: 'Lỗi cập nhật thông tin: ' + (data.error || 'Không rõ') });
                return;
            }

            // Cập nhật localStorage với dữ liệu mới (bao gồm avatar mới nếu có)
            const updatedUser = {
                ...user,
                name: formData.fullName,
                avatar: newAvatarUrl || user.avatar || user.AnhDaiDien,
                AnhDaiDien: newAvatarUrl || user.AnhDaiDien
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            console.log('Updated localStorage with avatar:', updatedUser.avatar);

            notify({ type: 'success', message: 'Cập nhật thông tin thành công!' });
            setShowEditModal(false);
            setAvatarFile(null); // Reset avatar file after successful upload
            // Reload để cập nhật avatar và data từ database
            window.location.reload();
        } catch (err) {
            notify({ type: 'error', message: 'Lỗi cập nhật thông tin: ' + err.message });
        }
    };

    if (!user) {
        return (
            <div className="container my-5">
                <div className="alert alert-warning">
                    Vui lòng đăng nhập để xem hồ sơ
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid" style={{ backgroundColor: '#f5f5f5', minHeight: '100vh', paddingTop: '110px' }}>
            <div className="container">
                <div className="row">
                    <ProfileSidebar
                        activeTab={activeTab}
                        onChangeTab={setActiveTab}
                        userName={user?.name || 'Người dùng'}
                    />

                    <ProfileMainContent
                        activeTab={activeTab}
                        user={user}
                        profileSummary={profileSummary}
                        onGoSettings={() => setActiveTab(PROFILE_TAB_SETTINGS)}
                        showPasswordForm={showPasswordForm}
                        setShowPasswordForm={setShowPasswordForm}
                        passwordForm={passwordForm}
                        setPasswordForm={setPasswordForm}
                        passwordShort={passwordShort}
                        passwordMismatch={passwordMismatch}
                        isPasswordValid={isPasswordValid}
                        isChangingPassword={isChangingPassword}
                        onPasswordChange={handlePasswordChange}
                        passwordStatus={passwordStatus}
                        setPasswordStatus={setPasswordStatus}
                    />
                </div>
            </div>

            {/* Edit Profile Modal */}
            {showEditModal && (
                <>
                    <div
                        className="modal-backdrop show"
                        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                        onClick={() => setShowEditModal(false)}
                    ></div>
                    <div className="modal show d-block" tabIndex="-1">
                        <div className="modal-dialog modal-dialog-centered modal-xl">
                            <div className="modal-content">
                                <div className="modal-header border-0">
                                    <h5 className="modal-title fw-bold fs-4">Thông tin cá nhân</h5>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={() => setShowEditModal(false)}
                                    ></button>
                                </div>
                                <div className="modal-body pb-2">
                                    <div className="row g-4">
                                        {/* Left: Avatar & quick actions */}
                                        <div className="col-xl-4">
                                            <div className="text-center p-3 border rounded-3 bg-light">
                                                <img
                                                    src={avatarPreview}
                                                    alt="avatar"
                                                    className="rounded-circle mb-3 shadow-sm"
                                                    style={{ width: 140, height: 140, objectFit: 'cover' }}
                                                />
                                                <div className="d-flex justify-content-center gap-2 mt-1">
                                                    <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => avatarInputRef.current?.click()}>
                                                        <i className="bi bi-camera me-1"></i> Đổi ảnh
                                                    </button>
                                                    <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => { setAvatarPreview("https://cdn-icons-png.flaticon.com/512/149/149071.png"); setAvatarFile(null); }}>
                                                        <i className="bi bi-trash me-1"></i> Xóa
                                                    </button>
                                                    <input
                                                        ref={avatarInputRef}
                                                        type="file"
                                                        accept="image/*"
                                                        style={{ display: 'none' }}
                                                        onChange={e => {
                                                            const file = e.target.files[0];
                                                            if (!file) return;
                                                            if (!file.type.startsWith('image/')) {
                                                                notify({ type: 'error', message: 'Chỉ chấp nhận file ảnh.' });
                                                                return;
                                                            }
                                                            if (file.size > 2 * 1024 * 1024) {
                                                                notify({ type: 'error', message: 'Ảnh không được vượt quá 2MB.' });
                                                                return;
                                                            }
                                                            const reader = new FileReader();
                                                            reader.onload = ev => {
                                                                setAvatarPreview(ev.target.result);
                                                                setAvatarFile(file);
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }}
                                                    />
                                                </div>
                                                <div className="mt-3 small text-muted">
                                                    Ảnh vuông, kích thước đề xuất 400×400px
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Form fields */}
                                        <div className="col-xl-8">
                                            <div className="row g-3">
                                                <div className="col-12">
                                                    <label className="form-label fw-semibold">Họ và Tên <span className="text-danger">*</span></label>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-lg"
                                                        name="fullName"
                                                        value={formData.fullName}
                                                        onChange={handleInputChange}
                                                        placeholder="Họ và tên của bạn"
                                                    />
                                                </div>
                                                <div className="col-12">
                                                    <label className="form-label fw-semibold">Chức danh <span className="text-danger">*</span></label>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-lg"
                                                        name="position"
                                                        value={formData.position}
                                                        onChange={handleInputChange}
                                                        placeholder="Ví dụ: Frontend Developer"
                                                    />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label fw-semibold">Địa chỉ email</label>
                                                    <input
                                                        type="email"
                                                        className="form-control form-control-lg"
                                                        name="email"
                                                        value={formData.email}
                                                        disabled
                                                        style={{ backgroundColor: '#f5f5f5' }}
                                                    />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label fw-semibold">Số điện thoại <span className="text-danger">*</span></label>
                                                    <input
                                                        type="tel"
                                                        className="form-control form-control-lg"
                                                        name="phone"
                                                        value={formData.phone}
                                                        onChange={handleInputChange}
                                                        placeholder="Nhập số điện thoại"
                                                    />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label fw-semibold">Ngày sinh <span className="text-danger">*</span></label>
                                                    <input
                                                        type="date"
                                                        className="form-control form-control-lg"
                                                        name="birthday"
                                                        value={formData.birthday}
                                                        onChange={handleInputChange}
                                                    />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label fw-semibold">Giới tính</label>
                                                    <select
                                                        className="form-select form-select-lg"
                                                        name="gender"
                                                        value={formData.gender}
                                                        onChange={handleInputChange}
                                                    >
                                                        <option value="Nam">Nam</option>
                                                        <option value="Nữ">Nữ</option>
                                                        <option value="Khác">Khác</option>
                                                    </select>
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label fw-semibold">Tỉnh/Thành phố hiện tại <span className="text-danger">*</span></label>
                                                    <div className="position-relative" ref={provinceDropdownRef}>
                                                        <input
                                                            type="text"
                                                            className="form-control form-control-lg"
                                                            placeholder="Tìm tỉnh/thành phố..."
                                                            value={provinceQuery}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setProvinceQuery(value);
                                                                setFormData({ ...formData, city: value });
                                                                setShowProvinceSuggestions(true);
                                                            }}
                                                            onFocus={() => {
                                                                setShowProvinceSuggestions(true);
                                                                setProvinceQuery(formData.city || '');
                                                            }}
                                                            autoComplete="off"
                                                        />
                                                        {showProvinceSuggestions && (
                                                            <div className="list-group position-absolute w-100 shadow-sm" style={{ maxHeight: 200, overflowY: 'auto', zIndex: 1100 }}>
                                                                {provinceSuggestions.length === 0 && (
                                                                    <div className="list-group-item small text-muted">Không tìm thấy tỉnh/thành phố phù hợp</div>
                                                                )}
                                                                {provinceSuggestions.map((province) => (
                                                                    <button
                                                                        key={province}
                                                                        type="button"
                                                                        className="list-group-item list-group-item-action text-start"
                                                                        onMouseDown={() => {
                                                                            setFormData({ ...formData, city: province });
                                                                            setProvinceQuery(province);
                                                                            setShowProvinceSuggestions(false);
                                                                        }}
                                                                        dangerouslySetInnerHTML={{ __html: highlightMatch(province, provinceQuery) }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label fw-semibold">Địa chỉ (Tên đường, quận/huyện,...)</label>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-lg"
                                                        name="address"
                                                        value={formData.address}
                                                        onChange={handleInputChange}
                                                        placeholder="Nhập địa chỉ chi tiết"
                                                    />
                                                </div>
                                                <div className="col-12">
                                                    <label className="form-label fw-semibold">Link cá nhân (LinkedIn, portfolio,...)</label>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-lg"
                                                        name="personalLink"
                                                        value={formData.personalLink}
                                                        onChange={handleInputChange}
                                                        placeholder="https://"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer border-0">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary px-4"
                                        onClick={() => setShowEditModal(false)}
                                    >
                                        Huỷ
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-danger px-4"
                                        onClick={handleSaveProfile}
                                    >
                                        Lưu
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Introduction Modal */}
            {showIntroModal && (
                <>
                    <div
                        className="modal-backdrop show"
                        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                        onClick={() => setShowIntroModal(false)}
                    ></div>
                    <div className="modal show d-block" tabIndex="-1">
                        <div className="modal-dialog modal-dialog-centered modal-lg">
                            <div className="modal-content">
                                <div className="modal-header border-0">
                                    <h5 className="modal-title fw-bold">Giới thiệu bản thân</h5>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={() => setShowIntroModal(false)}
                                    ></button>
                                </div>
                                <div className="modal-body">
                                    {/* Tip Box */}
                                    <div className="alert alert-warning d-flex align-items-start gap-2 mb-4" style={{ backgroundColor: '#fff8e1', border: 'none' }}>
                                        <i className="bi bi-lightbulb-fill text-warning fs-5"></i>
                                        <div>
                                            <strong>Tip:</strong> Tóm tắt kinh nghiệm chuyên môn, chú ý làm nổi bật các kỹ năng và điểm mạnh.
                                        </div>
                                    </div>

                                    {/* Rich Text Editor Toolbar */}
                                    <div className="border rounded mb-2">
                                        <div className="d-flex gap-2 p-2 border-bottom bg-light">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary border-0"
                                                title="Bold"
                                                onClick={() => applyFormatting('bold')}
                                            >
                                                <i className="bi bi-type-bold"></i>
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary border-0"
                                                title="Italic"
                                                onClick={() => applyFormatting('italic')}
                                            >
                                                <i className="bi bi-type-italic"></i>
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary border-0"
                                                title="Underline"
                                                onClick={() => applyFormatting('underline')}
                                            >
                                                <i className="bi bi-type-underline"></i>
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary border-0"
                                                title="List"
                                                onClick={() => applyFormatting('insertUnorderedList')}
                                            >
                                                <i className="bi bi-list-ul"></i>
                                            </button>
                                        </div>
                                        <div
                                            ref={editorRef}
                                            className="p-3 bg-white"
                                            style={{ minHeight: '300px', outline: 'none', textAlign: 'left', lineHeight: 1.6, fontSize: '1rem' }}
                                            contentEditable
                                            suppressContentEditableWarning
                                            onInput={(e) => {
                                                const html = e.currentTarget.innerHTML;
                                                const plain = sanitizePlainText(html);
                                                if (plain.length <= 2500) {
                                                    setIntroHtml(html);
                                                } else {
                                                    e.currentTarget.innerHTML = introHtml;
                                                    placeCaretAtEnd(e.currentTarget);
                                                }
                                            }}
                                            onFocus={(e) => {
                                                if (!sanitizePlainText(e.currentTarget.innerHTML)) {
                                                    placeCaretAtEnd(e.currentTarget);
                                                }
                                            }}
                                            onClick={(e) => {
                                                if (!sanitizePlainText(e.currentTarget.innerHTML)) {
                                                    placeCaretAtEnd(e.currentTarget);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="text-muted small">
                                        {introPlainText.length}/2500 ký tự
                                    </div>
                                </div>
                                <div className="modal-footer border-0">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary px-4"
                                        onClick={() => setShowIntroModal(false)}
                                    >
                                        Huỷ
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-danger px-4"
                                        onClick={() => {
                                            // introHtml đã được lưu trong state, chỉ cần đóng modal
                                            setShowIntroModal(false);
                                        }}
                                    >
                                        Lưu
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Education Modal */}
            {showEducationModal && (
                <>
                    <div className="modal-backdrop show" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowEducationModal(false)}></div>
                    <div className="modal show d-block" tabIndex="-1">
                        <div className="modal-dialog modal-dialog-centered modal-xl">
                            <div className="modal-content">
                                <div className="modal-header border-0">
                                    <h5 className="modal-title fw-bold fs-4">Học vấn</h5>
                                    <button type="button" className="btn-close" onClick={() => setShowEducationModal(false)}></button>
                                </div>
                                <div className="modal-body">
                                    <div className="mb-3 position-relative" ref={universityDropdownRef}>
                                        <label className="form-label fw-semibold">Trường <span className="text-danger">*</span></label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg"
                                            placeholder="Nhập tên trường, ví dụ: Đại học Bách Khoa..."
                                            value={educationForm.university}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setEducationForm({ ...educationForm, university: value });
                                                setUniversityQuery(value);
                                                setShowUniversitySuggestions(false);
                                            }}
                                            onFocus={() => {
                                                setShowUniversitySuggestions(false);
                                            }}
                                            autoComplete="off"
                                        />
                                        {universityError && (
                                            <div className="small text-danger mt-1">{universityError}</div>
                                        )}
                                        {/* Gợi ý trường đã tắt để cho phép nhập tự do */}
                                    </div>
                                    <div className="row g-3 mb-3">
                                        <div className="col-lg-6">
                                            <label className="form-label fw-semibold">Trình độ <span className="text-danger">*</span></label>
                                            <select
                                                className="form-select form-select-lg"
                                                value={educationForm.level}
                                                onChange={(e) => setEducationForm({ ...educationForm, level: e.target.value })}
                                            >
                                                
                                                <option value="Trung cấp">Trung cấp</option>
                                                <option value="Cao đẳng">Cao đẳng</option>
                                                <option value="Đại học">Đại học</option>
                                                <option value="Thạc sĩ">Thạc sĩ</option>
                                                <option value="Tiến sĩ">Tiến sĩ</option>
                                            </select>
                                        </div>
                                        <div className="col-lg-6">
                                            <label className="form-label fw-semibold">Ngành học <span className="text-danger">*</span></label>
                                            <input
                                                className="form-control form-control-lg"
                                                value={educationForm.major}
                                                onChange={(e) => setEducationForm({ ...educationForm, major: e.target.value })}
                                                placeholder="Ví dụ: Công nghệ thông tin"
                                            />
                                        </div>
                                    </div>

                                    {/* Checkbox hiện tại */}
                                    <div className="form-check d-flex align-items-center gap-2 mb-3 text-start">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="currentlyStudyingTop"
                                            checked={educationForm.isCurrentlyStudying}
                                            onChange={(e) => {
                                                const isChecked = e.target.checked;
                                                setEducationForm({
                                                    ...educationForm,
                                                    isCurrentlyStudying: isChecked,
                                                    endMonth: isChecked ? '' : educationForm.endMonth,
                                                    endYear: isChecked ? '' : educationForm.endYear
                                                });
                                            }}
                                        />
                                        <label className="form-check-label fs-5 fw-semibold mb-0" htmlFor="currentlyStudyingTop">
                                            Tôi đang theo học tại đây
                                        </label>
                                    </div>
                                    {/* Từ */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Từ <span className="text-danger">*</span></label>
                                        <div className="row g-2">
                                            <div className="col-6">
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={educationForm.startMonth}
                                                    onChange={(e) => setEducationForm({ ...educationForm, startMonth: e.target.value })}
                                                >
                                                    <option value="">Tháng</option>
                                                    <option value="01">Tháng 1</option>
                                                    <option value="02">Tháng 2</option>
                                                    <option value="03">Tháng 3</option>
                                                    <option value="04">Tháng 4</option>
                                                    <option value="05">Tháng 5</option>
                                                    <option value="06">Tháng 6</option>
                                                    <option value="07">Tháng 7</option>
                                                    <option value="08">Tháng 8</option>
                                                    <option value="09">Tháng 9</option>
                                                    <option value="10">Tháng 10</option>
                                                    <option value="11">Tháng 11</option>
                                                    <option value="12">Tháng 12</option>
                                                </select>
                                            </div>
                                            <div className="col-6">
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={educationForm.startYear}
                                                    onChange={(e) => setEducationForm({ ...educationForm, startYear: e.target.value })}
                                                >
                                                    <option value="">Năm</option>
                                                    {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                                        <option key={year} value={year}>{year}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Đến */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Đến <span className="text-danger">*</span></label>
                                        <div className="row g-2">
                                            <div className="col-6">
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={educationForm.endMonth}
                                                    onChange={(e) => setEducationForm({ ...educationForm, endMonth: e.target.value })}
                                                    disabled={educationForm.isCurrentlyStudying}
                                                >
                                                    <option value="">Tháng</option>
                                                    <option value="01">Tháng 1</option>
                                                    <option value="02">Tháng 2</option>
                                                    <option value="03">Tháng 3</option>
                                                    <option value="04">Tháng 4</option>
                                                    <option value="05">Tháng 5</option>
                                                    <option value="06">Tháng 6</option>
                                                    <option value="07">Tháng 7</option>
                                                    <option value="08">Tháng 8</option>
                                                    <option value="09">Tháng 9</option>
                                                    <option value="10">Tháng 10</option>
                                                    <option value="11">Tháng 11</option>
                                                    <option value="12">Tháng 12</option>
                                                </select>
                                            </div>
                                            <div className="col-6">
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={educationForm.endYear}
                                                    onChange={(e) => setEducationForm({ ...educationForm, endYear: e.target.value })}
                                                    disabled={educationForm.isCurrentlyStudying}
                                                >
                                                    <option value="">Năm</option>
                                                    {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                                        <option key={year} value={year}>{year}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Thông tin chi tiết khác</label>
                                        <textarea
                                            className="form-control form-control-lg"
                                            rows={3}
                                            value={educationForm.description}
                                            onChange={(e) => setEducationForm({ ...educationForm, description: e.target.value })}
                                            placeholder="Thành tích, hoạt động, đồ án nổi bật..."
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer border-0">
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setShowEducationModal(false)}>Huỷ</button>
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        disabled={!isEducationValid}
                                        onClick={() => {
                                            const hasRequired = educationForm.university && educationForm.level && educationForm.major && educationForm.startMonth && educationForm.startYear && (educationForm.isCurrentlyStudying || (educationForm.endMonth && educationForm.endYear));
                                            if (!hasRequired) return;

                                            // Format dates for display
                                            const startDate = `${educationForm.startMonth}/${educationForm.startYear}`;
                                            const endDate = educationForm.isCurrentlyStudying
                                                ? 'HIỆN TẠI'
                                                : `${educationForm.endMonth}/${educationForm.endYear}`;

                                            setEducationList(prev => [...prev, {
                                                university: educationForm.university,
                                                level: educationForm.level,
                                                major: educationForm.major,
                                                start: startDate,
                                                end: endDate,
                                                description: educationForm.description
                                            }]);
                                            setEducationForm({ university: '', level: '', major: '', startMonth: '', startYear: '', endMonth: '', endYear: '', isCurrentlyStudying: false, description: '' });
                                            setShowEducationModal(false);
                                        }}
                                    >
                                        Lưu
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Work Experience Modal */}
            {showWorkModal && (
                <>
                    <div className="modal-backdrop show" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowWorkModal(false)}></div>
                    <div className="modal show d-block" tabIndex="-1">
                        <div className="modal-dialog modal-dialog-centered modal-xl">
                            <div className="modal-content" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                                <div className="modal-header border-0 bg-white">
                                    <h5 className="modal-title fw-bold fs-4">Kinh nghiệm làm việc</h5>
                                    <button type="button" className="btn-close" onClick={() => setShowWorkModal(false)}></button>
                                </div>
                                <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Chức danh <span className="text-danger">*</span></label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg"
                                            value={workForm.position}
                                            onChange={(e) => setWorkForm({ ...workForm, position: e.target.value })}
                                            placeholder="Ví dụ: Frontend Developer"
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Tên công ty <span className="text-danger">*</span></label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg"
                                            value={workForm.company}
                                            onChange={(e) => setWorkForm({ ...workForm, company: e.target.value })}
                                            placeholder="Nhập tên công ty"
                                        />
                                    </div>

                                    {/* Checkbox hiện tại */}
                                    <div className="form-check d-flex align-items-center gap-2 mb-3 text-start">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="currentlyWorking"
                                            checked={workForm.isCurrentlyWorking}
                                            onChange={(e) => {
                                                const isChecked = e.target.checked;
                                                setWorkForm({
                                                    ...workForm,
                                                    isCurrentlyWorking: isChecked,
                                                    endMonth: isChecked ? '' : workForm.endMonth,
                                                    endYear: isChecked ? '' : workForm.endYear
                                                });
                                            }}
                                        />
                                        <label className="form-check-label fs-5 fw-semibold mb-0" htmlFor="currentlyWorking">
                                            Tôi đang làm việc tại đây
                                        </label>
                                    </div>

                                    {/* Từ */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Từ <span className="text-danger">*</span></label>
                                        <div className="row g-2">
                                            <div className="col-6">
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={workForm.startMonth}
                                                    onChange={(e) => setWorkForm({ ...workForm, startMonth: e.target.value })}
                                                >
                                                    <option value="">Tháng</option>
                                                    <option value="01">Tháng 1</option>
                                                    <option value="02">Tháng 2</option>
                                                    <option value="03">Tháng 3</option>
                                                    <option value="04">Tháng 4</option>
                                                    <option value="05">Tháng 5</option>
                                                    <option value="06">Tháng 6</option>
                                                    <option value="07">Tháng 7</option>
                                                    <option value="08">Tháng 8</option>
                                                    <option value="09">Tháng 9</option>
                                                    <option value="10">Tháng 10</option>
                                                    <option value="11">Tháng 11</option>
                                                    <option value="12">Tháng 12</option>
                                                </select>
                                            </div>
                                            <div className="col-6">
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={workForm.startYear}
                                                    onChange={(e) => setWorkForm({ ...workForm, startYear: e.target.value })}
                                                >
                                                    <option value="">Năm</option>
                                                    {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                                        <option key={year} value={year}>{year}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Đến */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Đến <span className="text-danger">*</span></label>
                                        <div className="row g-2">
                                            <div className="col-6">
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={workForm.endMonth}
                                                    onChange={(e) => setWorkForm({ ...workForm, endMonth: e.target.value })}
                                                    disabled={workForm.isCurrentlyWorking}
                                                >
                                                    <option value="">Tháng</option>
                                                    <option value="01">Tháng 1</option>
                                                    <option value="02">Tháng 2</option>
                                                    <option value="03">Tháng 3</option>
                                                    <option value="04">Tháng 4</option>
                                                    <option value="05">Tháng 5</option>
                                                    <option value="06">Tháng 6</option>
                                                    <option value="07">Tháng 7</option>
                                                    <option value="08">Tháng 8</option>
                                                    <option value="09">Tháng 9</option>
                                                    <option value="10">Tháng 10</option>
                                                    <option value="11">Tháng 11</option>
                                                    <option value="12">Tháng 12</option>
                                                </select>
                                            </div>
                                            <div className="col-6">
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={workForm.endYear}
                                                    onChange={(e) => setWorkForm({ ...workForm, endYear: e.target.value })}
                                                    disabled={workForm.isCurrentlyWorking}
                                                >
                                                    <option value="">Năm</option>
                                                    {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                                        <option key={year} value={year}>{year}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mô tả chi tiết */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Mô tả chi tiết</label>
                                        
                                        {/* Tips Box */}
                                        <div className="alert alert-warning d-flex align-items-start gap-2 mb-3" style={{ backgroundColor: '#fff8e1', border: 'none' }}>
                                            <i className="bi bi-lightbulb-fill text-warning fs-5"></i>
                                            <div>
                                                <strong>Tips:</strong> Tóm lược lĩnh vực công ty bạn đã làm, nêu các trách nhiệm và kết quả đạt được trong công việc. Sử dụng phần "Dự án" bên dưới để mô tả dự án đã tham gia.
                                            </div>
                                        </div>

                                        {/* Rich Text Editor */}
                                        <div className="border rounded mb-2">
                                            <div className="d-flex gap-2 p-2 border-bottom bg-light">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary border-0"
                                                    title="Bold"
                                                    onClick={() => applyWorkFormatting('bold')}
                                                >
                                                    <i className="bi bi-type-bold"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary border-0"
                                                    title="Italic"
                                                    onClick={() => applyWorkFormatting('italic')}
                                                >
                                                    <i className="bi bi-type-italic"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary border-0"
                                                    title="Underline"
                                                    onClick={() => applyWorkFormatting('underline')}
                                                >
                                                    <i className="bi bi-type-underline"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary border-0"
                                                    title="List"
                                                    onClick={() => applyWorkFormatting('insertUnorderedList')}
                                                >
                                                    <i className="bi bi-list-ul"></i>
                                                </button>
                                            </div>
                                            <div
                                                ref={workEditorRef}
                                                className="p-3 bg-white"
                                                style={{ minHeight: '200px', outline: 'none', textAlign: 'left', lineHeight: 1.6, fontSize: '1rem' }}
                                                contentEditable
                                                suppressContentEditableWarning
                                                onInput={(e) => {
                                                    const html = e.currentTarget.innerHTML;
                                                    const plain = sanitizePlainText(html);
                                                    if (plain.length <= 2500) {
                                                        setWorkForm({ ...workForm, descriptionHtml: html });
                                                    } else {
                                                        e.currentTarget.innerHTML = workForm.descriptionHtml;
                                                        placeCaretAtEnd(e.currentTarget);
                                                    }
                                                }}
                                                onFocus={(e) => {
                                                    if (!sanitizePlainText(e.currentTarget.innerHTML)) {
                                                        placeCaretAtEnd(e.currentTarget);
                                                    }
                                                }}
                                                onClick={(e) => {
                                                    if (!sanitizePlainText(e.currentTarget.innerHTML)) {
                                                        placeCaretAtEnd(e.currentTarget);
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="text-muted small">
                                            {workPlainText.length}/2500 ký tự
                                        </div>
                                    </div>

                                    {/* Dự án */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Dự án</label>
                                        
                                        {/* Tips Box */}
                                        <div className="alert alert-warning d-flex align-items-start gap-2 mb-3" style={{ backgroundColor: '#fff8e1', border: 'none' }}>
                                            <i className="bi bi-lightbulb-fill text-warning fs-5"></i>
                                            <div>
                                                <strong>Tips:</strong> Mô tả dự án, vai trò của bạn, công nghệ sử dụng và số thành viên.
                                            </div>
                                        </div>

                                        {/* Rich Text Editor for Projects */}
                                        <div className="border rounded mb-2">
                                            <div className="d-flex gap-2 p-2 border-bottom bg-light">
                                                <button type="button" className="btn btn-sm btn-outline-secondary border-0" title="Bold">
                                                    <i className="bi bi-type-bold"></i>
                                                </button>
                                                <button type="button" className="btn btn-sm btn-outline-secondary border-0" title="Italic">
                                                    <i className="bi bi-type-italic"></i>
                                                </button>
                                                <button type="button" className="btn btn-sm btn-outline-secondary border-0" title="Underline">
                                                    <i className="bi bi-type-underline"></i>
                                                </button>
                                                <button type="button" className="btn btn-sm btn-outline-secondary border-0" title="List">
                                                    <i className="bi bi-list-ul"></i>
                                                </button>
                                                <div className="ms-auto">
                                                    <button type="button" className="btn btn-sm btn-link text-decoration-none">
                                                        Chèn mẫu sẵn
                                                    </button>
                                                </div>
                                            </div>
                                            <div
                                                className="p-3 bg-white"
                                                style={{ minHeight: '200px', outline: 'none', textAlign: 'left', lineHeight: 1.6, fontSize: '1rem' }}
                                                contentEditable
                                                suppressContentEditableWarning
                                            />
                                        </div>
                                        <div className="text-muted small">
                                            0/2500 ký tự
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer border-0">
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setShowWorkModal(false)}>Huỷ</button>
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        disabled={!isWorkValid}
                                        onClick={() => {
                                            const startDate = `${workForm.startMonth}/${workForm.startYear}`;
                                            const endDate = workForm.isCurrentlyWorking
                                                ? 'HIỆN TẠI'
                                                : `${workForm.endMonth}/${workForm.endYear}`;

                                            setWorkList(prev => [...prev, {
                                                position: workForm.position,
                                                company: workForm.company,
                                                start: startDate,
                                                end: endDate,
                                                descriptionHtml: workForm.descriptionHtml
                                            }]);
                                            setWorkForm({ position: '', company: '', startMonth: '', startYear: '', endMonth: '', endYear: '', isCurrentlyWorking: false, descriptionHtml: '' });
                                            setShowWorkModal(false);
                                        }}
                                    >
                                        Lưu
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Language Modal */}
            {showLanguageModal && (
                <>
                    <div className="modal-backdrop show" onClick={() => setShowLanguageModal(false)}></div>
                    <div className="modal show d-block" tabIndex="-1">
                        <div className="modal-dialog modal-dialog-centered modal-lg">
                            <div className="modal-content">
                                <div className="modal-header border-0 bg-white">
                                    <h5 className="modal-title fw-bold fs-4">Ngoại ngữ</h5>
                                    <button type="button" className="btn-close" onClick={() => setShowLanguageModal(false)}></button>
                                </div>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Danh sách ngôn ngữ ({languageList.length}/5)</label>
                                        
                                        <div className="row g-2 mb-3">
                                            <div className="col-7">
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={languageForm.language}
                                                    onChange={(e) => setLanguageForm({ ...languageForm, language: e.target.value })}
                                                >
                                                    <option value="">Tìm ngôn ngữ</option>
                                                    <option value="Tiếng Anh">Tiếng Anh</option>
                                                    <option value="Tiếng Trung">Tiếng Trung</option>
                                                    <option value="Tiếng Nhật">Tiếng Nhật</option>
                                                    <option value="Tiếng Hàn">Tiếng Hàn</option>
                                                    <option value="Tiếng Pháp">Tiếng Pháp</option>
                                                    <option value="Tiếng Đức">Tiếng Đức</option>
                                                    <option value="Tiếng Tây Ban Nha">Tiếng Tây Ban Nha</option>
                                                    <option value="Tiếng Nga">Tiếng Nga</option>
                                                    <option value="Tiếng Thái">Tiếng Thái</option>
                                                    <option value="Tiếng Việt">Tiếng Việt</option>
                                                </select>
                                            </div>
                                            <div className="col-4">
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={languageForm.level}
                                                    onChange={(e) => setLanguageForm({ ...languageForm, level: e.target.value })}
                                                >
                                                    <option value="">Chọn trình độ</option>
                                                    <option value="Sơ cấp">Sơ cấp</option>
                                                    <option value="Trung cấp">Trung cấp</option>
                                                    <option value="Nâng cao">Nâng cao</option>
                                                    <option value="Bản ngữ">Bản ngữ</option>
                                                </select>
                                            </div>
                                            <div className="col-1">
                                                <button 
                                                    type="button" 
                                                    className="btn btn-danger w-100 h-100 d-flex align-items-center justify-content-center"
                                                    disabled={!languageForm.language || !languageForm.level || languageList.length >= 5}
                                                    onClick={() => {
                                                        if (languageForm.language && languageForm.level) {
                                                            setLanguageList(prev => [...prev, { ...languageForm }]);
                                                            setLanguageForm({ language: '', level: '' });
                                                        }
                                                    }}
                                                >
                                                    <i className="bi bi-plus-lg"></i>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Language List */}
                                        {languageList.length > 0 && (
                                            <div className="border rounded p-3">
                                                {languageList.map((lang, idx) => (
                                                    <div key={idx} className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                                        <div>
                                                            <div className="fw-semibold">{lang.language}</div>
                                                            <div className="text-muted small">({lang.level})</div>
                                                        </div>
                                                        <button 
                                                            type="button" 
                                                            className="btn btn-link text-danger p-0"
                                                            onClick={() => setLanguageList(prev => prev.filter((_, i) => i !== idx))}
                                                        >
                                                            <i className="bi bi-x-lg"></i>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="modal-footer border-0">
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setShowLanguageModal(false)}>Huỷ</button>
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        onClick={() => setShowLanguageModal(false)}
                                    >
                                        Lưu
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Certificate Modal */}
            {showCertificateModal && (
                <>
                    <div className="modal-backdrop show" onClick={() => setShowCertificateModal(false)}></div>
                    <div className="modal show d-block" tabIndex="-1">
                        <div className="modal-dialog modal-dialog-centered modal-xl">
                            <div className="modal-content" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                                <div className="modal-header border-0 bg-white">
                                    <h5 className="modal-title fw-bold fs-4">Chứng chỉ</h5>
                                    <button type="button" className="btn-close" onClick={() => setShowCertificateModal(false)}></button>
                                </div>
                                <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Tên chứng chỉ <span className="text-danger">*</span></label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg"
                                            value={certificateForm.name}
                                            onChange={(e) => setCertificateForm({ ...certificateForm, name: e.target.value })}
                                            placeholder="Tên chứng chỉ"
                                        />
                                        {!certificateForm.name && (
                                            <div className="text-danger small mt-1">Vui lòng điền tên chứng chỉ của bạn</div>
                                        )}
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Tổ chức <span className="text-danger">*</span></label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg"
                                            value={certificateForm.organization}
                                            onChange={(e) => setCertificateForm({ ...certificateForm, organization: e.target.value })}
                                            placeholder="Tổ chức"
                                        />
                                        {!certificateForm.organization && (
                                            <div className="text-danger small mt-1">Vui lòng điền tên tổ chức phát hành chứng chỉ</div>
                                        )}
                                    </div>

                                    {/* Thời gian */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Thời gian <span className="text-danger">*</span></label>
                                        <div className="row g-2">
                                            <div className="col-6">
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={certificateForm.month}
                                                    onChange={(e) => setCertificateForm({ ...certificateForm, month: e.target.value })}
                                                >
                                                    <option value="">Tháng</option>
                                                    <option value="01">Tháng 1</option>
                                                    <option value="02">Tháng 2</option>
                                                    <option value="03">Tháng 3</option>
                                                    <option value="04">Tháng 4</option>
                                                    <option value="05">Tháng 5</option>
                                                    <option value="06">Tháng 6</option>
                                                    <option value="07">Tháng 7</option>
                                                    <option value="08">Tháng 8</option>
                                                    <option value="09">Tháng 9</option>
                                                    <option value="10">Tháng 10</option>
                                                    <option value="11">Tháng 11</option>
                                                    <option value="12">Tháng 12</option>
                                                </select>
                                            </div>
                                            <div className="col-6">
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={certificateForm.year}
                                                    onChange={(e) => setCertificateForm({ ...certificateForm, year: e.target.value })}
                                                >
                                                    <option value="">Năm</option>
                                                    {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                                        <option key={year} value={year}>{year}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Link chứng chỉ</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg"
                                            value={certificateForm.link}
                                            onChange={(e) => setCertificateForm({ ...certificateForm, link: e.target.value })}
                                            placeholder="Link chứng chỉ"
                                        />
                                    </div>

                                    {/* Mô tả chi tiết */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Mô tả chi tiết</label>
                                        
                                        {/* Rich Text Editor */}
                                        <div className="border rounded mb-2">
                                            <div className="d-flex gap-2 p-2 border-bottom bg-light">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary border-0"
                                                    title="Bold"
                                                    onClick={() => applyCertificateFormatting('bold')}
                                                >
                                                    <i className="bi bi-type-bold"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary border-0"
                                                    title="Italic"
                                                    onClick={() => applyCertificateFormatting('italic')}
                                                >
                                                    <i className="bi bi-type-italic"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary border-0"
                                                    title="Underline"
                                                    onClick={() => applyCertificateFormatting('underline')}
                                                >
                                                    <i className="bi bi-type-underline"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary border-0"
                                                    title="List"
                                                    onClick={() => applyCertificateFormatting('insertUnorderedList')}
                                                >
                                                    <i className="bi bi-list-ul"></i>
                                                </button>
                                            </div>
                                            <div
                                                ref={certificateEditorRef}
                                                className="p-3 bg-white"
                                                style={{ minHeight: '150px', outline: 'none', textAlign: 'left', lineHeight: 1.6, fontSize: '1rem' }}
                                                contentEditable
                                                suppressContentEditableWarning
                                                onInput={(e) => {
                                                    const html = e.currentTarget.innerHTML;
                                                    setCertificateForm({ ...certificateForm, descriptionHtml: html });
                                                }}
                                                onFocus={(e) => {
                                                    if (!sanitizePlainText(e.currentTarget.innerHTML)) {
                                                        placeCaretAtEnd(e.currentTarget);
                                                    }
                                                }}
                                                onClick={(e) => {
                                                    if (!sanitizePlainText(e.currentTarget.innerHTML)) {
                                                        placeCaretAtEnd(e.currentTarget);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer border-0">
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCertificateModal(false)}>Huỷ</button>
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        disabled={!isCertificateValid}
                                        onClick={() => {
                                            const date = `Tháng ${certificateForm.month}/${certificateForm.year}`;
                                            setCertificateList(prev => [...prev, {
                                                name: certificateForm.name,
                                                organization: certificateForm.organization,
                                                date: date,
                                                link: certificateForm.link,
                                                descriptionHtml: certificateForm.descriptionHtml
                                            }]);
                                            setCertificateForm({ name: '', organization: '', month: '', year: '', link: '', descriptionHtml: '' });
                                            setShowCertificateModal(false);
                                        }}
                                    >
                                        Lưu
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Award Modal */}
            {showAwardModal && (
                <>
                    <div className="modal-backdrop show" onClick={() => setShowAwardModal(false)}></div>
                    <div className="modal show d-block" tabIndex="-1">
                        <div className="modal-dialog modal-dialog-centered modal-xl">
                            <div className="modal-content" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                                <div className="modal-header border-0 bg-white">
                                    <h5 className="modal-title fw-bold fs-4">Giải thưởng</h5>
                                    <button type="button" className="btn-close" onClick={() => setShowAwardModal(false)}></button>
                                </div>
                                <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Tên giải thưởng <span className="text-danger">*</span></label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg"
                                            value={awardForm.name}
                                            onChange={(e) => setAwardForm({ ...awardForm, name: e.target.value })}
                                            placeholder="Tên giải thưởng"
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Tổ chức <span className="text-danger">*</span></label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg"
                                            value={awardForm.organization}
                                            onChange={(e) => setAwardForm({ ...awardForm, organization: e.target.value })}
                                            placeholder="Tổ chức"
                                        />
                                    </div>

                                    {/* Thời gian */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Thời gian <span className="text-danger">*</span></label>
                                        <div className="row g-2">
                                            <div className="col-6">
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={awardForm.month}
                                                    onChange={(e) => setAwardForm({ ...awardForm, month: e.target.value })}
                                                >
                                                    <option value="">Tháng</option>
                                                    <option value="01">Tháng 1</option>
                                                    <option value="02">Tháng 2</option>
                                                    <option value="03">Tháng 3</option>
                                                    <option value="04">Tháng 4</option>
                                                    <option value="05">Tháng 5</option>
                                                    <option value="06">Tháng 6</option>
                                                    <option value="07">Tháng 7</option>
                                                    <option value="08">Tháng 8</option>
                                                    <option value="09">Tháng 9</option>
                                                    <option value="10">Tháng 10</option>
                                                    <option value="11">Tháng 11</option>
                                                    <option value="12">Tháng 12</option>
                                                </select>
                                            </div>
                                            <div className="col-6">
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={awardForm.year}
                                                    onChange={(e) => setAwardForm({ ...awardForm, year: e.target.value })}
                                                >
                                                    <option value="">Năm</option>
                                                    {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                                        <option key={year} value={year}>{year}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mô tả chi tiết */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Mô tả chi tiết</label>
                                        
                                        {/* Tips Box */}
                                        <div className="alert alert-warning d-flex align-items-start gap-2 mb-3" style={{ backgroundColor: '#fff8e1', border: 'none' }}>
                                            <i className="bi bi-lightbulb-fill text-warning fs-5"></i>
                                            <div>
                                                <strong>Tips:</strong> Mô tả ngắn gọn về giải thưởng hoặc lí do đạt giải
                                            </div>
                                        </div>

                                        {/* Rich Text Editor */}
                                        <div className="border rounded mb-2">
                                            <div className="d-flex gap-2 p-2 border-bottom bg-light">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary border-0"
                                                    title="Bold"
                                                    onClick={() => applyAwardFormatting('bold')}
                                                >
                                                    <i className="bi bi-type-bold"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary border-0"
                                                    title="Italic"
                                                    onClick={() => applyAwardFormatting('italic')}
                                                >
                                                    <i className="bi bi-type-italic"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary border-0"
                                                    title="Underline"
                                                    onClick={() => applyAwardFormatting('underline')}
                                                >
                                                    <i className="bi bi-type-underline"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary border-0"
                                                    title="List"
                                                    onClick={() => applyAwardFormatting('insertUnorderedList')}
                                                >
                                                    <i className="bi bi-list-ul"></i>
                                                </button>
                                            </div>
                                            <div
                                                ref={awardEditorRef}
                                                className="p-3 bg-white"
                                                style={{ minHeight: '150px', outline: 'none', textAlign: 'left', lineHeight: 1.6, fontSize: '1rem' }}
                                                contentEditable
                                                suppressContentEditableWarning
                                                onInput={(e) => {
                                                    const html = e.currentTarget.innerHTML;
                                                    setAwardForm({ ...awardForm, descriptionHtml: html });
                                                }}
                                                onFocus={(e) => {
                                                    if (!sanitizePlainText(e.currentTarget.innerHTML)) {
                                                        placeCaretAtEnd(e.currentTarget);
                                                    }
                                                }}
                                                onClick={(e) => {
                                                    if (!sanitizePlainText(e.currentTarget.innerHTML)) {
                                                        placeCaretAtEnd(e.currentTarget);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer border-0">
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setShowAwardModal(false)}>Huỷ</button>
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        disabled={!isAwardValid}
                                        onClick={() => {
                                            const date = `Tháng ${awardForm.month}/${awardForm.year}`;
                                            setAwardList(prev => [...prev, {
                                                name: awardForm.name,
                                                organization: awardForm.organization,
                                                date: date,
                                                descriptionHtml: awardForm.descriptionHtml
                                            }]);
                                            setAwardForm({ name: '', organization: '', month: '', year: '', descriptionHtml: '' });
                                            setShowAwardModal(false);
                                        }}
                                    >
                                        Lưu
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* CV Preview Modal */}
            {showCvPreview && selectedCv && (
                <>
                    <div className="modal-backdrop show" onClick={() => setShowCvPreview(false)}></div>
                    <div className="modal show d-block" tabIndex="-1">
                        <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '95vw', width: '95vw' }}>
                            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-lg" style={{ height: '92vh', backgroundColor: '#f4f6fb' }}>
                                <div className="position-relative border-0 bg-white">
                                    <div className="px-4 py-3 d-flex flex-column flex-md-row align-items-md-center gap-3 pe-5">
                                        <div className="flex-grow-1">
                                            <h5 className="modal-title fw-bold mb-1">{selectedCv.name}</h5>
                                            <div className="text-muted small">
                                                {selectedCv.size} • Tải lên ngày {selectedCv.uploadDate}
                                            </div>
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="badge rounded-pill bg-light text-dark border">{fileTypeLabel}</span>
                                            {previewUrl && (
                                                <a
                                                    href={previewUrl}
                                                    download={selectedCv.name}
                                                    className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                                                >
                                                    <i className="bi bi-download"></i>
                                                    Tải xuống
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-light btn-sm shadow position-absolute"
                                        style={{ top: '0.4rem', right: '0.4rem', zIndex: 10 }}
                                        onClick={() => setShowCvPreview(false)}
                                    >
                                        <i className="bi bi-x-lg"></i>
                                    </button>
                                </div>
                                <div className="modal-body p-0" style={{ backgroundColor: '#1f2229', overflow: 'hidden' }}>
                                    {isPdfPreview && previewUrl ? (
                                        <iframe
                                            src={previewUrl}
                                            style={{ width: '100%', height: '100%', border: 'none' }}
                                            title="CV Preview"
                                        />
                                    ) : (
                                        <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center text-white px-4">
                                            <i className="bi bi-file-earmark-word" style={{ fontSize: '5rem' }}></i>
                                            <p className="mt-3 mb-1">Không thể xem trước file Word trực tiếp</p>
                                            <p className="text-white-50 mb-3">Vui lòng tải xuống để xem nội dung chi tiết</p>
                                            {previewUrl && (
                                                <a
                                                    href={previewUrl}
                                                    download={selectedCv.name}
                                                    className="btn btn-primary d-flex align-items-center gap-2"
                                                >
                                                    <i className="bi bi-download"></i>
                                                    Tải xuống
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* CV Delete Confirmation */}
            {cvPendingDelete && (
                <>
                    <div className="modal-backdrop show" onClick={() => setCvPendingDelete(null)}></div>
                    <div className="modal show d-block" tabIndex="-1">
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content">
                                <div className="modal-header border-0">
                                    <h5 className="modal-title fw-bold">Xóa CV</h5>
                                    <button type="button" className="btn-close" onClick={() => setCvPendingDelete(null)}></button>
                                </div>
                                <div className="modal-body">
                                    <p className="mb-1">Bạn có chắc muốn xóa CV <strong>{cvPendingDelete.name}</strong>?</p>
                                    <p className="text-muted small mb-0">Hành động này không thể hoàn tác.</p>
                                </div>
                                <div className="modal-footer border-0">
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setCvPendingDelete(null)}>Huỷ</button>
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        onClick={() => handleDeleteCv(cvPendingDelete)}
                                    >
                                        Xóa
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Profile;
