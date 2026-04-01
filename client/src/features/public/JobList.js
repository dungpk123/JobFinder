import React, { useState } from 'react';

const topIndustries = [
    {
        name: 'Kinh doanh - Bán hàng',
        jobs: 10531,
        icon: (
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="16" width="40" height="28" rx="8" fill="#E6F9F0"/>
                <path d="M28 38c5 0 9-4 9-9s-4-9-9-9-9 4-9 9 4 9 9 9Z" fill="#00C271"/>
                <path d="M28 32v-4m0 0v-2m0 2h2m-2 0h-2" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="38" cy="18" r="4" fill="#fff" stroke="#00C271" strokeWidth="2"/>
                <path d="M40 16l-4 4" stroke="#00C271" strokeWidth="2" strokeLinecap="round"/>
            </svg>
        )
    },
    {
        name: 'Marketing - PR - Quảng cáo',
        jobs: 7444,
        icon: (
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="16" width="40" height="28" rx="8" fill="#E6F9F0"/>
                <path d="M20 36l16-8-16-8v16Z" fill="#00C271"/>
                <rect x="36" y="22" width="6" height="12" rx="3" fill="#00C271"/>
                <rect x="36" y="22" width="6" height="12" rx="3" fill="#00C271"/>
                <rect x="36" y="22" width="6" height="12" rx="3" fill="#00C271"/>
            </svg>
        )
    },
    {
        name: 'Chăm sóc khách hàng (Customer Service)',
        jobs: 2672,
        icon: (
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="16" width="40" height="28" rx="8" fill="#E6F9F0"/>
                <circle cx="28" cy="30" r="8" fill="#00C271"/>
                <rect x="20" y="24" width="16" height="8" rx="4" fill="#fff"/>
                <circle cx="28" cy="28" r="2" fill="#00C271"/>
            </svg>
        )
    },
    {
        name: 'Nhân sự - Hành chính - Pháp lý',
        jobs: 2973,
        icon: (
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="16" width="40" height="28" rx="8" fill="#E6F9F0"/>
                <rect x="20" y="24" width="16" height="8" rx="4" fill="#00C271"/>
                <rect x="24" y="32" width="8" height="4" rx="2" fill="#fff"/>
                <rect x="28" y="20" width="4" height="8" rx="2" fill="#00C271"/>
            </svg>
        )
    },
    {
        name: 'Công nghệ Thông tin',
        jobs: 2339,
        icon: (
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="16" width="40" height="28" rx="8" fill="#E6F9F0"/>
                <rect x="20" y="28" width="16" height="8" rx="4" fill="#00C271"/>
                <rect x="24" y="32" width="8" height="4" rx="2" fill="#fff"/>
                <rect x="28" y="20" width="4" height="8" rx="2" fill="#00C271"/>
                <text x="28" y="38" textAnchor="middle" fontSize="12" fill="#fff" fontWeight="bold">IT</text>
            </svg>
        )
    },
    {
        name: 'Tài chính - Ngân hàng - Bảo hiểm',
        jobs: 1518,
        icon: (
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="16" width="40" height="28" rx="8" fill="#E6F9F0"/>
                <rect x="20" y="28" width="16" height="8" rx="4" fill="#00C271"/>
                <circle cx="28" cy="28" r="8" fill="#fff"/>
                <circle cx="28" cy="28" r="4" fill="#00C271"/>
                <circle cx="36" cy="20" r="2" fill="#00C271"/>
            </svg>
        )
    },
    {
        name: 'Bất động sản',
        jobs: 403,
        icon: (
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="16" width="40" height="28" rx="8" fill="#E6F9F0"/>
                <rect x="20" y="28" width="16" height="8" rx="4" fill="#00C271"/>
                <rect x="24" y="32" width="8" height="4" rx="2" fill="#fff"/>
                <rect x="28" y="20" width="4" height="8" rx="2" fill="#00C271"/>
            </svg>
        )
    },
    {
        name: 'Kế toán - Kiểm toán - Thuế',
        jobs: 5726,
        icon: (
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="16" width="40" height="28" rx="8" fill="#E6F9F0"/>
                <rect x="20" y="28" width="16" height="8" rx="4" fill="#00C271"/>
                <rect x="24" y="32" width="8" height="4" rx="2" fill="#fff"/>
                <rect x="28" y="20" width="4" height="8" rx="2" fill="#00C271"/>
                <circle cx="36" cy="36" r="4" fill="#00C271"/>
                <path d="M36 36l2 2" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
        )
    },
];

function TopIndustriesSection() {
    return (
        <div className="container my-5">
            <h2 className="fw-bold mb-4" style={{color: '#00C271'}}>
                Top ngành nghề nổi bật
            </h2>
            <div className="row g-4">
                {topIndustries.map((ind, idx) => (
                    <div key={ind.name} className="col-12 col-sm-6 col-md-4 col-lg-3">
                        <div className={`bg-light rounded-4 p-4 h-100 d-flex flex-column align-items-center justify-content-center ${idx === 4 ? 'border border-success shadow-sm' : ''}`} style={idx === 4 ? {boxShadow: '0 4px 24px #00c27122'} : {}}>
                            <div className="mb-3">{ind.icon}</div>
                            <div className="fw-semibold text-center mb-2" style={{fontSize: 18}}>{ind.name}</div>
                            <div className="fw-bold text-success" style={{fontSize: 16}}>{ind.jobs.toLocaleString()} việc làm</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const jobsData = [
    {
        id: 1,
        company: 'CATHAR',
        title: 'Nhân Viên Sale - Chăm Sóc Khách Hàng (Không Yêu Cầu Kinh Nghiệm)',
        salary: '12 - 20 triệu',
        salaryValue: 16,
        location: 'Bắc Ninh, Xã Văn Môn',
        province: 'Bắc Ninh',
        experience: 'Không yêu cầu',
        career: 'Bán hàng',
        highlight: 'Ngẫu Nhiên',
        featured: true,
        logo: '/images/logo.png',
        type: 'fulltime',
        tags: ['Bắc Ninh', 'Xã Văn Môn']
    },
    {
        id: 2,
        company: 'TOPCV Việt Nam',
        title: 'Business Development',
        salary: 'Thoả thuận',
        salaryValue: 25,
        location: 'Hà Nội, Phường Thanh Xuân',
        province: 'Hà Nội',
        experience: '1-2 năm',
        career: 'Kinh doanh',
        highlight: 'NỔI BẬT',
        featured: true,
        logo: '/images/logo.png',
        type: 'fulltime',
        tags: ['Hà Nội', 'Phường Thanh Xuân']
    },
    {
        id: 3,
        company: 'MISA',
        title: 'Chuyên Viên Phân Tích Nghiệp Vụ',
        salary: 'Thoả thuận',
        salaryValue: 30,
        location: 'Hà Nội, Phường Cầu Giấy',
        province: 'Hà Nội',
        experience: '3-5 năm',
        career: 'Phân tích nghiệp vụ',
        highlight: 'TOP',
        featured: true,
        logo: '/images/logo.png',
        type: 'fulltime',
        tags: ['Hà Nội', 'Phường Cầu Giấy']
    },
    {
        id: 4,
        company: 'SAMCO',
        title: 'Nhân Viên Tư Vấn Bán Hàng Ô Tô & Xe Máy',
        salary: '12 - 50 triệu',
        salaryValue: 35,
        location: 'Hồ Chí Minh, Phường Tân Tạo',
        province: 'Hồ Chí Minh',
        experience: '1-2 năm',
        career: 'Bán hàng',
        highlight: '',
        featured: false,
        logo: '/images/logo.png',
        type: 'fulltime',
        tags: ['Hồ Chí Minh', 'Phường Tân Tạo']
    },
];


const locations = ['Tất cả', 'Miền Bắc', 'Miền Trung', 'Miền Nam', 'Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng'];

// Danh sách tỉnh theo miền
const provincesByRegion = {
    'Miền Bắc': [
        'Hà Nội', 'Bắc Ninh', 'Bắc Giang', 'Bắc Kạn', 'Cao Bằng', 'Điện Biên', 'Hà Giang', 'Hà Nam', 'Hải Dương', 'Hải Phòng', 'Hòa Bình', 'Hưng Yên', 'Lai Châu', 'Lào Cai', 'Nam Định', 'Ninh Bình', 'Phú Thọ', 'Quảng Ninh', 'Sơn La', 'Thái Bình', 'Thái Nguyên', 'Tuyên Quang', 'Vĩnh Phúc', 'Yên Bái'
    ],
    'Miền Trung': [
        'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Bình', 'Quảng Trị', 'Thừa Thiên Huế', 'Đà Nẵng', 'Quảng Nam', 'Quảng Ngãi', 'Bình Định', 'Phú Yên', 'Khánh Hòa', 'Ninh Thuận', 'Bình Thuận', 'Kon Tum', 'Gia Lai', 'Đắk Lắk', 'Đắk Nông', 'Lâm Đồng'
    ],
    'Miền Nam': [
        'Bình Phước', 'Bình Dương', 'Đồng Nai', 'Tây Ninh', 'Bà Rịa - Vũng Tàu', 'Hồ Chí Minh', 'Long An', 'Đồng Tháp', 'Tiền Giang', 'An Giang', 'Bến Tre', 'Vĩnh Long', 'Trà Vinh', 'Hậu Giang', 'Kiên Giang', 'Cần Thơ', 'Sóc Trăng', 'Bạc Liêu', 'Cà Mau'
    ]
};
const salaries = ['Tất cả', 'Dưới 15 triệu', '15-25 triệu', 'Trên 25 triệu'];
const experiences = ['Tất cả', 'Không yêu cầu', '1-2 năm', '3-5 năm'];


const JobList = () => {
    const [selectedLocation, setSelectedLocation] = useState('Tất cả');
    const [selectedSalary, setSelectedSalary] = useState('Tất cả');
    const [selectedExperience, setSelectedExperience] = useState('Tất cả');


    // Lọc dữ liệu theo các bộ lọc
    const filteredJobs = jobsData.filter(job => {
        let matchLocation = true;
        if (selectedLocation !== 'Tất cả') {
            if (provincesByRegion[selectedLocation]) {
                // Nếu chọn miền, kiểm tra province thuộc miền đó
                matchLocation = provincesByRegion[selectedLocation].includes(job.province);
            } else {
                // Nếu chọn tỉnh/thành phố cụ thể
                matchLocation = job.province === selectedLocation;
            }
        }
        const matchSalary = selectedSalary === 'Tất cả' ||
            (selectedSalary === 'Dưới 15 triệu' && job.salaryValue < 15) ||
            (selectedSalary === '15-25 triệu' && job.salaryValue >= 15 && job.salaryValue <= 25) ||
            (selectedSalary === 'Trên 25 triệu' && job.salaryValue > 25);
        const matchExperience = selectedExperience === 'Tất cả' || job.experience === selectedExperience;
        return matchLocation && matchSalary && matchExperience;
    });

    return (
        <div className="container my-5">
            <div className="d-flex align-items-center mb-2 gap-2">
                <h1 className="fw-bold text-success mb-0" style={{fontSize: '2.5rem'}}>Việc làm tốt nhất</h1>
                <div className="ms-auto d-flex align-items-center gap-2">
                    <a href="#" className="text-decoration-none">Xem tất cả</a>
                    <button className="btn btn-outline-success btn-sm rounded-circle"><i className="bi bi-chevron-left"></i></button>
                    <button className="btn btn-outline-success btn-sm rounded-circle"><i className="bi bi-chevron-right"></i></button>
                </div>
            </div>
            <div className="d-flex gap-2 mb-3 flex-wrap align-items-center">
                <span className="fw-semibold">Lọc theo:</span>
                <select className="form-select d-inline-block w-auto" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}>
                    {locations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                    ))}
                </select>
                <select className="form-select d-inline-block w-auto" value={selectedSalary} onChange={e => setSelectedSalary(e.target.value)}>
                    {salaries.map(sal => (
                        <option key={sal} value={sal}>{sal}</option>
                    ))}
                </select>
                <select className="form-select d-inline-block w-auto" value={selectedExperience} onChange={e => setSelectedExperience(e.target.value)}>
                    {experiences.map(exp => (
                        <option key={exp} value={exp}>{exp}</option>
                    ))}
                </select>

            </div>
            <div className="alert alert-primary py-2 mb-3" style={{fontSize: '1rem'}}>
                <i className="bi bi-lightbulb me-2"></i> Gợi ý: Di chuột vào tiêu đề việc làm để xem thêm thông tin chi tiết
            </div>
            <div className="row g-3">
                {filteredJobs.length === 0 && (
                    <div className="col-12 text-center text-muted">Không tìm thấy việc làm phù hợp.</div>
                )}
                {filteredJobs.map(job => (
                        <div className="col-md-4" key={job.id}>
                            <div className="card h-100 shadow-sm position-relative">
                                {job.featured && (
                                    <span className="badge bg-success position-absolute" style={{top: 10, left: 10, zIndex: 2}}>{job.highlight}</span>
                                )}
                                <div className="d-flex align-items-center gap-2 p-2">
                                    <img src={job.logo} alt={job.company} style={{width: 48, height: 48, objectFit: 'cover', borderRadius: 8}} />
                                    <div>
                                        <div className="fw-bold small text-uppercase text-secondary">{job.company}</div>
                                        <div className="fw-semibold" title={job.title} style={{fontSize: '1.1rem', cursor: 'pointer'}}>{job.title}</div>
                                    </div>
                                </div>
                                <div className="card-body pt-2 pb-1">
                                    <div className="d-flex flex-wrap gap-2 mb-2">
                                        <span className="badge bg-light text-dark border">{job.salary}</span>
                                        {job.tags.map(tag => (
                                            <span key={tag} className="badge bg-light text-dark border">{tag}</span>
                                        ))}
                                    </div>
                                    <div className="text-muted small">{job.location}</div>
                                </div>
                                <div className="card-footer bg-white border-0 pt-0 pb-3">
                                    <button className="btn btn-outline-success w-100">Yêu thích <i className="bi bi-heart ms-1"></i></button>
                                </div>
                            </div>
                        </div>
                ))}
            </div>
        </div>
    );
};

// Dữ liệu mẫu công ty nổi bật
const industries = [
    'Tất cả',
    'Ngân hàng',
    'Bất động sản',
    'Xây dựng',
    'IT - Phần mềm',
    'Tài chính',
    'Bán lẻ - Hàng tiêu dùng - FMCG',
    'Sản xuất',
    'Bảo hiểm',
    'Nông Lâm Ngư nghiệp',
    'Du lịch',
    'Giáo dục',
    'Y tế',
    'Vận tải',
    'Logistics',
    'Truyền thông',
    'Quảng cáo',
    'Luật',
    'Nhân sự',
    'Hành chính',
    'Thiết kế',
    'Marketing',
    'QA/QC',
    'Kế toán',
    'Kiểm toán',
    'Cơ khí',
    'Điện - Điện tử',
    'Hóa chất',
    'Dệt may',
    'Thực phẩm',
    'Môi trường',
    'Năng lượng',
    'Viễn thông',
    'Chứng khoán',
    'Thủy sản',
    'Bưu chính',
    'Thể thao',
    'Nghệ thuật',
    'Phiên dịch',
    'Xuất nhập khẩu',
    'Bảo trì',
    'Công nghệ sinh học',
];

const featuredCompanies = [
    {
        id: 1,
        name: 'CÔNG TY CỔ PHẦN CẢNG CAM RANH',
        logo: '/images/logo.png',
        industry: 'Sản xuất',
        jobs: 0,
        pro: true
    },
    {
        id: 2,
        name: 'NGÂN HÀNG THƯƠNG MẠI CỔ PHẦN KỸ THƯƠNG VIỆT NAM',
        logo: '/images/logo.png',
        industry: 'Ngân hàng',
        jobs: 20
    },
    {
        id: 3,
        name: 'CÔNG TY TNHH BẢO HIỂM NHÂN THỌ AIA (VIỆT NAM)',
        logo: '/images/logo.png',
        industry: 'Bảo hiểm',
        jobs: 6
    },
    {
        id: 4,
        name: 'CÔNG TY CỔ PHẦN CHĂN NUÔI C.P. VIỆT NAM',
        logo: '/images/logo.png',
        industry: 'Nông Lâm Ngư nghiệp',
        jobs: 53
    },
    {
        id: 5,
        name: 'NGÂN HÀNG TMCP HÀNG HẢI VIỆT NAM (MSB)',
        logo: '/images/logo.png',
        industry: 'Ngân hàng',
        jobs: 33
    },
];

const CompanyCard = ({ company }) => (
    <div className="col-md-4 mb-3">
        <div className="border rounded-4 p-3 h-100 d-flex flex-column justify-content-between position-relative">
            <div className="d-flex flex-column align-items-center gap-2 mb-2">
                <img src={company.logo} alt={company.name} style={{width: 64, height: 64, objectFit: 'cover', borderRadius: 12, border: '1px solid #eee'}} />
                <div className="fw-bold text-uppercase text-center" style={{fontSize: '1.1rem', color: '#b8860b'}}>{company.name}</div>
                <div className="text-secondary small text-center">{company.industry}</div>
            </div>
            <div className="d-flex flex-column align-items-center gap-2 mt-2">
                <span className="text-dark bg-light rounded-pill px-3 py-1 mb-1"><i className="bi bi-briefcase me-1"></i>{company.jobs} việc làm</span>
               
                <button className="btn btn-outline-warning rounded-pill px-3 py-1 fw-semibold" style={{color: '#7a5c00', borderColor: '#e0c68c', background: '#fffbe6'}}>+ Theo dõi</button>
            </div>
        </div>
    </div>
);

const FeaturedCompaniesSection = () => {
    const [selectedIndustry, setSelectedIndustry] = useState('Tất cả');
    const [scrollX, setScrollX] = useState(0);
    const scrollRef = React.useRef(null);
    const SCROLL_AMOUNT = 200;

    const filteredCompanies = featuredCompanies.filter(c => selectedIndustry === 'Tất cả' || c.industry === selectedIndustry);

    const handleScroll = (dir) => {
        if (!scrollRef.current) return;
        const container = scrollRef.current;
        const newScroll = dir === 'left' ? container.scrollLeft - SCROLL_AMOUNT : container.scrollLeft + SCROLL_AMOUNT;
        container.scrollTo({ left: newScroll, behavior: 'smooth' });
        setScrollX(newScroll);
    };

    return (
        <>
            <div className="container my-5">
                <h2 className="fw-bold mb-4" style={{color: '#b8860b'}}>Công ty nổi bật</h2>
                <div className="position-relative mb-3" style={{maxWidth: '100%', overflow: 'visible'}}>
                    <button
                        className="btn btn-light position-absolute top-50 start-0 translate-middle-y shadow-sm"
                        style={{zIndex:2, borderRadius: '50%', width: 44, height: 44, left: -24, border: '1px solid #b8860b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0}}
                        onClick={() => handleScroll('left')}
                        aria-label="Trước"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{transform: 'rotate(180deg)'}}>
                            <circle cx="12" cy="12" r="11" stroke="#b8860b" strokeWidth="2" fill="#fff"/>
                            <path d="M9.5 8L13.5 12L9.5 16" stroke="#b8860b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>
                    <div
                        ref={scrollRef}
                        className="d-flex gap-2 align-items-center"
                        style={{overflowX: 'auto', overflowY: 'hidden', whiteSpace: 'nowrap', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '0 40px'}}
                    >
                        {industries.map(ind => (
                            <button
                                key={ind}
                                className={`btn rounded-pill px-4 py-2 fw-semibold mx-1 ${selectedIndustry === ind ? 'text-white' : 'text-dark'} ${selectedIndustry === ind ? 'bg-warning' : 'bg-light'}`}
                                style={{border: 'none', boxShadow: selectedIndustry === ind ? '0 2px 8px #e0c68c' : 'none', flex: '0 0 auto'}}
                                onClick={() => setSelectedIndustry(ind)}
                            >
                                {ind}
                            </button>
                        ))}
                    </div>
                    <button
                        className="btn btn-light position-absolute top-50 end-0 translate-middle-y shadow-sm"
                        style={{zIndex:2, borderRadius: '50%', width: 44, height: 44, right: -24, border: '1px solid #b8860b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0}}
                        onClick={() => handleScroll('right')}
                        aria-label="Sau"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="11" stroke="#b8860b" strokeWidth="2" fill="#fff"/>
                            <path d="M9.5 8L13.5 12L9.5 16" stroke="#b8860b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>
                </div>
                <div className="row">
                    {filteredCompanies.length === 0 && (
                        <div className="col-12 text-center text-muted">Không tìm thấy công ty phù hợp.</div>
                    )}
                    {filteredCompanies.map(company => (
                        <CompanyCard key={company.id} company={company} />
                    ))}
                </div>
            </div>
            <TopIndustriesSection />
        </>
    );
};

const JobListWithCompanies = () => (
    <>
        <JobList />
        <FeaturedCompaniesSection />
    </>
);

export default JobListWithCompanies;