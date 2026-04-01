import React from 'react';
import './Hero.css';

const careers = [
    'Công nghệ thông tin',
    'Phát triển phần mềm',
    'Phân tích dữ liệu',
    'Quản trị hệ thống',
    'An ninh mạng',
    'Marketing',
    'Digital Marketing',
    'Content Marketing',
    'Thiết kế đồ họa',
    'Thiết kế UI/UX',
    'Truyền thông',
    'Bán hàng',
    'Chăm sóc khách hàng',
    'Kinh doanh B2B',
    'Kinh doanh B2C',
    'Tài chính/Kế toán',
    'Kiểm toán',
    'Ngân hàng',
    'Nhân sự',
    'Hành chính',
    'Giáo dục/Đào tạo',
    'Biên/Phiên dịch',
    'Luật/Pháp chế',
    'Y tế/Chăm sóc sức khỏe',
    'Dược',
    'Xây dựng/Kiến trúc',
    'Bất động sản',
    'Kỹ thuật điện/Điện tử',
    'Cơ khí/Kỹ thuật',
    'Logistics/Xuất nhập khẩu',
    'Chuỗi cung ứng',
    'Sản xuất/Vận hành',
    'Ẩm thực/Nhà hàng/Khách sạn',
    'Du lịch/Lữ hành',
    'Báo chí/Biên tập viên'
];

const provinces = [
    'An Giang', 'Bà Rịa - Vũng Tàu', 'Bạc Liêu', 'Bắc Giang', 'Bắc Kạn', 'Bắc Ninh',
    'Bến Tre', 'Bình Dương', 'Bình Định', 'Bình Phước', 'Bình Thuận', 'Cà Mau',
    'Cao Bằng', 'Cần Thơ', 'Đà Nẵng', 'Đắk Lắk', 'Đắk Nông', 'Điện Biên', 'Đồng Nai',
    'Đồng Tháp', 'Gia Lai', 'Hà Giang', 'Hà Nam', 'Hà Nội', 'Hà Tĩnh', 'Hải Dương',
    'Hải Phòng', 'Hậu Giang', 'Hòa Bình', 'Hồ Chí Minh', 'Hưng Yên', 'Khánh Hòa',
    'Kiên Giang', 'Kon Tum', 'Lai Châu', 'Lâm Đồng', 'Lạng Sơn', 'Lào Cai',
    'Long An', 'Nam Định', 'Nghệ An', 'Ninh Bình', 'Ninh Thuận', 'Phú Thọ',
    'Phú Yên', 'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị',
    'Sóc Trăng', 'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên', 'Thanh Hóa',
    'Thừa Thiên Huế', 'Tiền Giang', 'Trà Vinh', 'Tuyên Quang', 'Vĩnh Long',
    'Vĩnh Phúc', 'Yên Bái'
];

const Hero = () => {
    const featured = ['Công nghệ thông tin', 'Marketing', 'Kinh doanh', 'Thiết kế UI/UX'];
    return (
        <section className="hero-section text-white">
            <span className="hero-glow hero-glow-one"></span>
            <span className="hero-glow hero-glow-two"></span>
            <span className="hero-glow hero-glow-three"></span>
            <div className="container hero-wrapper">
                <div className="text-center">
                    <p className="hero-eyebrow">JobFinder • Trải nghiệm ứng tuyển khác biệt</p>
                    <h1 className="display-4 fw-bold">Tìm việc làm mơ ước của bạn</h1>
                    <p className="lead opacity-75">Hàng ngàn cơ hội việc làm đa dạng đang chờ đợi bạn khám phá.</p>
                </div>
                <div className="hero-tags d-flex flex-wrap justify-content-center gap-2 mt-4">
                    {featured.map(tag => (
                        <span key={tag} className="hero-tag">{tag}</span>
                    ))}
                </div>
                <div className="hero-search-card mt-5 mx-auto">
                    <form className="row g-3 align-items-end">
                        <div className="col-lg-3 col-md-6">
                            <label htmlFor="search-position" className="form-label text-secondary fw-semibold">Vị trí mong muốn</label>
                            <input id="search-position" type="text" className="form-control" placeholder="Nhập vị trí muốn ứng tuyển" />
                        </div>
                        <div className="col-lg-3 col-md-6">
                            <label htmlFor="search-career" className="form-label text-secondary fw-semibold">Ngành nghề</label>
                            <div className="input-group icon-field">
                                <span className="input-group-text">
                                    <img src="/images/briefcase.png" alt="Ngành nghề" />
                                </span>
                                <input
                                    id="search-career"
                                    type="text"
                                    className="form-control"
                                    placeholder="Ví dụ: Full-stack"
                                    autoComplete="off"
                                    list="careerList"
                                />
                            </div>
                            <datalist id="careerList">
                                {careers.map(career => (
                                    <option key={career} value={career} />
                                ))}
                            </datalist>
                        </div>
                        <div className="col-lg-3 col-md-6">
                            <label htmlFor="search-location" className="form-label text-secondary fw-semibold">Tỉnh/Thành phố</label>
                            <div className="input-group icon-field">
                                <span className="input-group-text">
                                    <img src="/images/location.png" alt="Tỉnh/Thành" />
                                </span>
                                <input
                                    id="search-location"
                                    type="text"
                                    className="form-control"
                                    placeholder="Ví dụ: Hà Nội"
                                    list="provinceList"
                                />
                            </div>
                            <datalist id="provinceList">
                                {provinces.map(province => (
                                    <option key={province} value={province} />
                                ))}
                            </datalist>
                        </div>
                        <div className="col-lg-3 col-md-6 d-grid">
                            <button type="submit" className="btn btn-gradient fw-semibold">Tìm kiếm</button>
                        </div>
                    </form>
                </div>
            </div>
        </section>
    );
};

export default Hero;