import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './features/public/HomePage';
import JobSearchPage from './features/public/JobSearchPage';
import JobPublicDetail from './features/public/JobPublicDetail';
import SavedJobsPage from './features/candidate/SavedJobsPage';
import AppliedJobsPage from './features/candidate/AppliedJobsPage';
import MatchingJobsPage from './features/candidate/MatchingJobsPage';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage';
import VerifyOTP from './features/auth/VerifyOTP';
import RoleSelectionPage from './features/auth/RoleSelectionPage';
import CompleteProfilePage from './features/auth/CompleteProfilePage';
import AdminDashboard from './features/admin/AdminDashboard';
import EmployerLayout from './features/employer/EmployerLayout';
import EmployerOverview from './features/employer/dashboard/EmployerOverview';
import CVSearch from './features/employer/dashboard/CVSearch';
import CVManage from './features/employer/dashboard/CVManage';
import JobManagement from './features/employer/dashboard/JobManagement';
import JobCreate from './features/employer/dashboard/JobCreate';
import JobDetail from './features/employer/dashboard/JobDetail';
import ApplicationManagement from './features/employer/dashboard/ApplicationManagement';
import CompanyProfile from './features/employer/dashboard/CompanyProfile';
import EmployerAccount from './features/employer/dashboard/EmployerAccount';
import ProtectedRoute from './components/ProtectedRoute';
import Footer from './components/Footer';
import Profile from './features/candidate/Profile';
import CreateCvHub from './features/cv/CreateCvHub';
import CvManagementPage from './features/cv/CvManagementPage';
import OnlineCvBuilder from './features/cv/OnlineCvBuilder';
import OnlineCvEditor from './features/cv/OnlineCvEditor';
import AIAssistantWidget from './components/AIAssistantWidget';
import CareerGuide from './features/career-guide/CareerGuide';
import CareerGuideDetail from './features/career-guide/CareerGuideDetail';
import CareerGuideManage from './features/career-guide/CareerGuideManage';
import CareerGuideMyPosts from './features/career-guide/CareerGuideMyPosts';
import MessagesPage from './features/messages/MessagesPage';
import SupportCenterPage from './features/support/SupportCenterPage';
import PWAUpdatePrompt from './components/pwa/PWAUpdatePrompt';
import AccountInstallPrompt from './components/pwa/AccountInstallPrompt';
import FirebaseMessagingBridge from './components/FirebaseMessagingBridge';
import MessageNotificationBridge from './components/MessageNotificationBridge';
import { API_BASE } from './config/apiBase';
import './App.css';

const normalizeRoleValue = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const getUserRoleNormalized = (user) => normalizeRoleValue(
  user?.role
  || user?.vaiTro
  || user?.VaiTro
  || user?.LoaiNguoiDung
  || ''
);

const hasCareerGuideCreatePermission = (user) => {
  if (!user) return false;

  const isSuperAdmin = (
    user?.isSuperAdmin === true
    || user?.isSuperAdmin === 1
    || user?.isSuperAdmin === '1'
    || user?.IsSuperAdmin === true
    || user?.IsSuperAdmin === 1
    || user?.IsSuperAdmin === '1'
  );

  if (isSuperAdmin) return true;

  const normalizedRole = getUserRoleNormalized(user);
  return (
    normalizedRole === 'ung vien'
    || normalizedRole === 'nha tuyen dung'
    || normalizedRole === 'quan tri'
    || normalizedRole === 'sieu quan tri vien'
  );
};

function AppContent() {
  const location = useLocation();
  const normalizedPath = location.pathname.length > 1
    ? location.pathname.replace(/\/+$/, '')
    : location.pathname;
  const userStr = localStorage.getItem('user');
  const currentUser = (() => {
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  })();
  const token = String(localStorage.getItem('token') || '').trim();
  const isAuthenticated = Boolean(userStr && token);
  const canCreateCareerGuidePost = hasCareerGuideCreatePermission(currentUser);

  const isGuestVisiblePath = (pathname) => {
    const directPaths = new Set([
      '/',
      '/login',
      '/register',
      '/forgot-password',
      '/verify-otp',
      '/jobs',
      '/support',
      '/career-guide',
      '/create-cv/templates'
    ]);

    if (directPaths.has(pathname)) {
      return true;
    }

    const segments = pathname.split('/').filter(Boolean);

    // Allow only job detail path like /jobs/:id (not /jobs/saved|applied|matching)
    if (segments[0] === 'jobs' && segments.length === 2) {
      const blockedJobSubRoutes = new Set(['saved', 'applied', 'matching']);
      return !blockedJobSubRoutes.has(segments[1]);
    }

    // Allow only article detail path like /career-guide/:id (not /career-guide/create|my-posts)
    if (segments[0] === 'career-guide' && segments.length === 2) {
      const blockedCareerSubRoutes = new Set(['create', 'my-posts']);
      return !blockedCareerSubRoutes.has(segments[1]);
    }

    return false;
  };

  const isGuestBlockedPath = !isAuthenticated && !isGuestVisiblePath(normalizedPath);

  // Kiểm tra và xóa token không hợp lệ khi app khởi động
  useEffect(() => {
    const checkToken = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await fetch(`${API_BASE}/auth/verify-token`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) {
            // Token không hợp lệ, xóa và yêu cầu đăng nhập lại
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            console.log('Token đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
          }
        } catch (err) {
          // Lỗi kết nối, không xóa token
          console.error('Không thể xác thực token:', err);
        }
      }
    };
    checkToken();
  }, []);

  // Ẩn Header và Footer khi ở các trang dashboard
  const isDashboardPage = location.pathname.startsWith('/admin') || 
                          location.pathname.startsWith('/employer');
  const isAuthPage = ['/login', '/register', '/forgot-password', '/verify-otp', '/onboarding/role', '/onboarding/profile'].includes(normalizedPath);
  const showPublicChrome = !isDashboardPage && !isAuthPage;

  if (isGuestBlockedPath) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="App">
      {showPublicChrome && <Header />}

      <main className="AppMain">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/jobs" element={<JobSearchPage />} />
          <Route path="/jobs/saved" element={<SavedJobsPage />} />
          <Route path="/jobs/applied" element={<AppliedJobsPage />} />
          <Route path="/jobs/matching" element={<MatchingJobsPage />} />
          <Route path="/jobs/:id" element={<JobPublicDetail />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />
          <Route path="/onboarding/role" element={<RoleSelectionPage />} />
          <Route path="/onboarding/profile" element={<CompleteProfilePage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/create-cv" element={<CreateCvHub />} />
          <Route path="/cv-management" element={<CvManagementPage />} />
          <Route path="/create-cv/templates" element={<OnlineCvBuilder />} />
          <Route path="/create-cv/online-editor" element={<OnlineCvEditor />} />
          <Route path="/career-guide" element={<CareerGuide />} />
          <Route
            path="/career-guide/create"
            element={(
              isAuthenticated
                ? (canCreateCareerGuidePost ? <CareerGuideManage /> : <Navigate to="/career-guide" replace />)
                : <Navigate to="/login" replace state={{ from: location }} />
            )}
          />
          <Route
            path="/career-guide/my-posts"
            element={(
              isAuthenticated
                ? (canCreateCareerGuidePost ? <CareerGuideMyPosts /> : <Navigate to="/career-guide" replace />)
                : <Navigate to="/login" replace state={{ from: location }} />
            )}
          />
          <Route path="/career-guide/:id" element={<CareerGuideDetail />} />
          <Route path="/support" element={<SupportCenterPage />} />
          <Route
            path="/messages"
            element={(
              <ProtectedRoute allowedRoles={['Nhà tuyển dụng', 'Ứng viên']}>
                <MessagesPage />
              </ProtectedRoute>
            )}
          />

          {/* Protected routes for role-based dashboards */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['Quản trị', 'Siêu quản trị viên']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Employer Dashboard with nested routes */}
          <Route
            path="/employer/*"
            element={
              <ProtectedRoute allowedRoles={['Nhà tuyển dụng']}>
                <EmployerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<EmployerOverview />} />
            <Route path="cv-search" element={<CVSearch />} />
            <Route path="cv-manage" element={<CVManage />} />
            <Route path="jobs" element={<JobManagement />} />
            <Route path="jobs/create" element={<JobCreate />} />
            <Route path="jobs/:id/edit" element={<JobCreate />} />
            <Route path="jobs/:id" element={<JobDetail />} />
            <Route path="applications" element={<ApplicationManagement />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="notifications" element={<SupportCenterPage />} />
            <Route path="statistics" element={<Navigate to="/employer" replace />} />
            <Route path="company" element={<CompanyProfile />} />
            <Route path="account" element={<EmployerAccount />} />
          </Route>

        </Routes>
      </main>

      {showPublicChrome && <Footer />}
      {showPublicChrome && <AIAssistantWidget />}
      <FirebaseMessagingBridge />
      <MessageNotificationBridge />
      <AccountInstallPrompt />
      <PWAUpdatePrompt />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
