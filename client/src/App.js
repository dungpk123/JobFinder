import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
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
import EmployerRegister from './features/auth/EmployerRegister';
import VerifyOTP from './features/auth/VerifyOTP';
import WelcomeIntro from './features/auth/WelcomeIntro';
import DesiredJobForm from './features/auth/DesiredJobForm';
import AdminDashboard from './features/admin/AdminDashboard';
import EmployerLayout from './features/employer/EmployerLayout';
import EmployerOverview from './features/employer/dashboard/EmployerOverview';
import CVSearch from './features/employer/dashboard/CVSearch';
import CVManage from './features/employer/dashboard/CVManage';
import JobManagement from './features/employer/dashboard/JobManagement';
import JobCreate from './features/employer/dashboard/JobCreate';
import JobDetail from './features/employer/dashboard/JobDetail';
import ApplicationManagement from './features/employer/dashboard/ApplicationManagement';
import Statistics from './features/employer/dashboard/Statistics';
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
import PWAUpdatePrompt from './components/pwa/PWAUpdatePrompt';
import AccountInstallPrompt from './components/pwa/AccountInstallPrompt';
import { API_BASE } from './config/apiBase';
import './App.css';

function AppContent() {
  const location = useLocation();

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
                          location.pathname.startsWith('/employer') || 
                          location.pathname === '/candidate';
  const isAuthPage = ['/login', '/register', '/forgot-password', '/register-employer'].includes(location.pathname);
  const showPublicChrome = !isDashboardPage && !isAuthPage;

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
          <Route path="/register-employer" element={<EmployerRegister />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />
          <Route path="/welcome" element={<WelcomeIntro />} />
          <Route path="/desired-job" element={<DesiredJobForm />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/create-cv" element={<CreateCvHub />} />
          <Route path="/cv-management" element={<CvManagementPage />} />
          <Route path="/create-cv/templates" element={<OnlineCvBuilder />} />
          <Route path="/create-cv/online-editor" element={<OnlineCvEditor />} />
          <Route path="/career-guide" element={<CareerGuide />} />
          <Route path="/career-guide/create" element={<CareerGuideManage />} />
          <Route path="/career-guide/:id" element={<CareerGuideDetail />} />

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
            <Route path="statistics" element={<Statistics />} />
            <Route path="company" element={<CompanyProfile />} />
            <Route path="account" element={<EmployerAccount />} />
          </Route>

          {/* Đã xóa route /candidate */}
        </Routes>
      </main>

      {showPublicChrome && <Footer />}
      {showPublicChrome && <AIAssistantWidget />}
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
