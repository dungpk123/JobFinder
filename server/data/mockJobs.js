// Shared mock jobs dataset used by both /api/mock-jobs and AI job search.
// Keep this file CommonJS for compatibility with existing server code.

const jobs = [
  {
    id: 1,
    company: 'CATHAR',
    title: 'Nhân Viên Sale - Chăm Sóc Khách Hàng (Không Yêu Cầu Kinh Nghiệm)',
    salary: '12 - 20 triệu',
    salaryValue: 16,
    location: 'Bắc Ninh, Xã Văn Môn',
    province: 'Bắc Ninh',
    experience: 'Không yêu cầu',
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
    highlight: '',
    featured: false,
    logo: '/images/logo.png',
    type: 'fulltime',
    tags: ['Hồ Chí Minh', 'Phường Tân Tạo']
  }
];

module.exports = { jobs };
