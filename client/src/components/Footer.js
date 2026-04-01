import React from 'react';

const Footer = () => {
    return (
        <footer className="jf-footer bg-dark text-white mt-auto">
            <div className="container">
                <div className="row g-3 align-items-start jf-footer-grid">
                    {/* Về JobFinder */}
                    <div className="col-12 col-md-2 d-flex flex-column">
                        <div className="fw-semibold jf-footer-title">Về JobFinder</div>
                        <ul className="list-unstyled mt-2 mb-0">
                            <li>Về chúng tôi</li>
                            <li>Quy chế hoạt động</li>
                            <li>Quy định bảo mật</li>
                            <li>Thỏa thuận sử dụng</li>
                            <li>Liên hệ</li>
                            <li>Sơ đồ trang web</li>
                            <li>JobFinder.asia</li>
                        </ul>
                    </div>
                    {/* Dành cho ứng viên */}
                    <div className="col-12 col-md-2 d-flex flex-column">
                        <div className="fw-semibold mb-2 jf-footer-title">Dành cho ứng viên</div>
                        <ul className="list-unstyled mb-0">
                            <li>Việc làm</li>
                            <li>Tìm việc làm nhanh</li>
                            <li>Công ty</li>
                            <li>Cẩm Nang Việc Làm</li>
                            <li>Mẫu CV Xin Việc</li>
                            <li>Tư Vấn Du Học Nhật Bản</li>
                        </ul>
                    </div>
                    {/* Dành cho nhà tuyển dụng */}
                    <div className="col-12 col-md-2 d-flex flex-column">
                        <div className="fw-semibold mb-2 jf-footer-title">Dành cho nhà tuyển dụng</div>
                        <ul className="list-unstyled mb-0">
                            <li>Dịch vụ nhân sự cao cấp</li>
                            <li>Cẩm nang tuyển dụng</li>
                        </ul>
                    </div>
                    {/* Việc làm theo khu vực */}
                    <div className="col-12 col-md-2">
                        <div className="fw-semibold mb-2 jf-footer-title">Việc làm theo khu vực</div>
                        <ul className="list-unstyled mb-0">
                            <li>Hồ Chí Minh</li>
                            <li>Hà Nội</li>
                            <li>Đà Nẵng</li>
                            <li>Hải Phòng</li>
                            <li>Cần Thơ</li>
                        </ul>
                    </div>
                    {/* Việc làm theo ngành nghề */}
                    <div className="col-12 col-md-2 d-flex flex-column">
                        <div className="fw-semibold mb-2 jf-footer-title">Việc làm theo ngành nghề</div>
                        <ul className="list-unstyled mb-0">
                            <li>Kế toán</li>
                            <li>Tiếng Nhật</li>
                            <li>Ngân hàng</li>
                            <li>IT - Phần mềm</li>
                            <li>IT - Phần cứng / Mạng</li>
                        </ul>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;