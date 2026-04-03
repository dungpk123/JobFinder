import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import JobList from './features/public/JobList';
import JobSearchPage from './features/public/JobSearchPage';
import JobPublicDetail from './features/public/JobPublicDetail';
import SavedJobsPage from './features/candidate/SavedJobsPage';
import AppliedJobsPage from './features/candidate/AppliedJobsPage';
import MatchingJobsPage from './features/candidate/MatchingJobsPage';
import Login, { LoginForm } from './features/auth/Login';
import Register, { RegisterForm } from './features/auth/Register';
import ForgotPassword from './features/auth/ForgotPassword';
import { EmployerRegisterForm } from './features/auth/EmployerRegister';
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
import CandidateDashboard from './features/candidate/CandidateDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import Footer from './components/Footer';
import Profile from './features/candidate/Profile';
import CreateCvHub from './features/cv/CreateCvHub';
import OnlineCvBuilder from './features/cv/OnlineCvBuilder';
import OnlineCvEditor from './features/cv/OnlineCvEditor';
import AIAssistantWidget from './components/AIAssistantWidget';
import CareerGuide from './features/career-guide/CareerGuide';
import CareerGuideDetail from './features/career-guide/CareerGuideDetail';
import CareerGuideManage from './features/career-guide/CareerGuideManage';
import { API_BASE } from './config/apiBase';
import './App.css';

function AppContent() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showEmployerRegisterModal, setShowEmployerRegisterModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
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

  const openLoginModal = () => setShowLoginModal(true);
  const closeLoginModal = () => setShowLoginModal(false);
  const openRegisterModal = () => setShowRegisterModal(true);
  const closeRegisterModal = () => setShowRegisterModal(false);
  const openEmployerRegisterModal = () => setShowEmployerRegisterModal(true);
  const closeEmployerRegisterModal = () => setShowEmployerRegisterModal(false);

  // Ẩn Header và Footer khi ở các trang dashboard
  const isDashboardPage = location.pathname.startsWith('/admin') || 
                          location.pathname.startsWith('/employer') || 
                          location.pathname === '/candidate';

  return (
    <div className="App">
      {!isDashboardPage && (
        <Header
          onLoginClick={() => {
            closeRegisterModal();
            closeEmployerRegisterModal();
            openLoginModal();
          }}
          onRegisterClick={() => {
            closeLoginModal();
            closeEmployerRegisterModal();
            openRegisterModal();
          }}
          onEmployerRegisterClick={() => {
            closeLoginModal();
            closeRegisterModal();
            openEmployerRegisterModal();
          }}
        />
      )}

      <main className="AppMain">
        <Routes>
          <Route path="/" element={<><Hero /><JobList /></>} />
          <Route path="/jobs" element={<JobSearchPage />} />
          <Route path="/jobs/saved" element={<SavedJobsPage />} />
          <Route path="/jobs/applied" element={<AppliedJobsPage />} />
          <Route path="/jobs/matching" element={<MatchingJobsPage />} />
          <Route path="/jobs/:id" element={<JobPublicDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />
          <Route path="/welcome" element={<WelcomeIntro />} />
          <Route path="/desired-job" element={<DesiredJobForm />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/create-cv" element={<CreateCvHub />} />
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

      {!isDashboardPage && <Footer />}
      {!isDashboardPage && <AIAssistantWidget />}

      {!isDashboardPage && showLoginModal && !showForgotModal && (
        <>
          <div className="modal-overlay" onClick={closeLoginModal}></div>
          <div className="modal-dialog-custom">
            <div className="text-center mb-1 modal-logo-wrapper">
              <img src="/images/logo.png" alt="JobFinder" className="modal-logo" />
            </div>
            <button type="button" className="btn-close modal-close" aria-label="Đóng" onClick={closeLoginModal}></button>
            <h5 className="modal-title text-center">Đăng nhập</h5>
            <div className="modal-body pt-0">
              <LoginForm
                onSuccess={closeLoginModal}
                onCreateAccount={() => {
                  closeLoginModal();
                  openRegisterModal();
                }}
                onForgotPassword={() => {
                  closeLoginModal();
                  setShowForgotModal(true);
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Forgot password modal (xuất hiện thay cho login modal) */}
      {!isDashboardPage && showForgotModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowForgotModal(false)}></div>
          <div className="modal-dialog-custom modal-dialog-large">
            <button type="button" className="btn-close modal-close" aria-label="Đóng" onClick={() => setShowForgotModal(false)}></button>
            <div className="modal-body pt-0">
              <ForgotPassword onClose={() => setShowForgotModal(false)} inline={true} />
            </div>
          </div>
        </>
      )}
      {!isDashboardPage && showRegisterModal && (
        <>
          <div className="modal-overlay" onClick={closeRegisterModal}></div>
          <div className="modal-dialog-custom modal-dialog-register">
            <button type="button" className="btn-close modal-close" aria-label="Đóng" onClick={closeRegisterModal}></button>
            <RegisterForm
              onSuccess={closeRegisterModal}
              onSwitchToLogin={() => {
                closeRegisterModal();
                openLoginModal();
              }}
            />
          </div>
        </>
      )}
      {!isDashboardPage && showEmployerRegisterModal && (
        <>
          <div className="modal-overlay" onClick={closeEmployerRegisterModal}></div>
          <div className="modal-dialog-custom modal-dialog-register">
            <button type="button" className="btn-close modal-close" aria-label="Đóng" onClick={closeEmployerRegisterModal}></button>
            <EmployerRegisterForm
              onSuccess={closeEmployerRegisterModal}
              onSwitchToLogin={() => {
                closeEmployerRegisterModal();
                openLoginModal();
              }}
            />
          </div>
        </>
      )}
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
