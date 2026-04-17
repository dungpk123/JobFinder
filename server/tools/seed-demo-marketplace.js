require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const DEMO_PASSWORD = 'Demo@123';
const DEMO_STATUS = 1;

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });

const buildDeadline = (offsetDays) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const EMPLOYER_DEMOS = [
  {
    email: 'nhatuyendung1@jobfinder.local',
    fullName: 'Trần Hữu Phúc',
    phone: '0902110001',
    address: '18 Nguyễn Thị Định, Cầu Giấy, Hà Nội',
    company: {
      name: 'LogiNext Bắc Nam',
      taxCode: '0319001001',
      website: 'https://loginext-bacnam.vn',
      address: '18 Nguyễn Thị Định, Cầu Giấy, Hà Nội',
      city: 'Hà Nội',
      field: 'Vận tải thông minh',
      description:
        'LogiNext Bắc Nam xây dựng mạng lưới giao vận liên tỉnh bằng dữ liệu thời gian thực, tập trung giảm tỷ lệ xe rỗng và nâng độ chính xác giờ giao.'
    },
    jobs: [
      {
        title: 'Điều phối tuyến giao nhận liên tỉnh',
        description:
          'Bạn sẽ chịu trách nhiệm phân lịch xe container tuyến Bắc Trung Nam theo mật độ đơn từng khung giờ, đồng thời xử lý sự cố phát sinh từ kho trung chuyển để đảm bảo SLA.',
        requirements:
          'Ưu tiên ứng viên từng làm điều phối vận tải đường bộ, đọc được bảng điều độ nhiều chặng và giao tiếp tốt với tài xế tuyến dài.',
        benefits:
          'Phụ cấp điện thoại và ca trực đêm, thưởng theo tỷ lệ giao hàng đúng hẹn mỗi tháng, hỗ trợ học chứng chỉ nghiệp vụ logistics.',
        experience: '2 năm',
        level: 'Nhân viên',
        salaryFrom: 15000000,
        salaryTo: 22000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Hà Nội',
        address: 'Kho điều phối Cầu Giấy, Hà Nội',
        field: 'Logistics',
        deadline: buildDeadline(45)
      },
      {
        title: 'Chuyên viên tối ưu dữ liệu kho trung chuyển',
        description:
          'Vị trí này phân tích dữ liệu vào ra của 5 kho vùng, thiết kế dashboard cảnh báo sớm tắc nghẽn và đề xuất phương án dồn chuyến theo mùa vụ.',
        requirements:
          'Thành thạo SQL và tư duy phân tích vận hành, có khả năng trình bày insight rõ ràng cho quản lý kho và đội điều phối.',
        benefits:
          'Làm việc theo mô hình hybrid, cấp ngân sách học Power BI, thưởng quý theo mức giảm tỷ lệ tồn kho quá hạn.',
        experience: '3 năm',
        level: 'Nhân viên',
        salaryFrom: 18000000,
        salaryTo: 26000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Hà Nội',
        address: 'Văn phòng phân tích vận hành, Hà Nội',
        field: 'Phân tích dữ liệu',
        deadline: buildDeadline(52)
      },
      {
        title: 'Trưởng nhóm chăm sóc mạng lưới tài xế',
        description:
          'Bạn dẫn dắt nhóm hỗ trợ tài xế 24/7, triển khai quy trình phản hồi sự cố trong 30 phút và xây dựng chương trình giữ chân tài xế tuyến trọng điểm.',
        requirements:
          'Có kinh nghiệm quản lý đội chăm sóc vận hành, xử lý khiếu nại đa tình huống và thiết kế KPI dịch vụ khả thi.',
        benefits:
          'Thưởng lãnh đạo đội theo mức ổn định mạng lưới, ngân sách team building theo quý, bảo hiểm sức khỏe mở rộng cho người thân.',
        experience: '4 năm',
        level: 'Trưởng nhóm',
        salaryFrom: 22000000,
        salaryTo: 32000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Hà Nội',
        address: 'Trung tâm hỗ trợ vận hành, Hà Nội',
        field: 'Dịch vụ khách hàng',
        deadline: buildDeadline(60)
      }
    ]
  },
  {
    email: 'nhatuyendung2@jobfinder.local',
    fullName: 'Lê Nhã Linh',
    phone: '0902110002',
    address: '22 Trương Định, Hai Bà Trưng, Hà Nội',
    company: {
      name: 'Lumen Learning Hub',
      taxCode: '0319001002',
      website: 'https://lumenlearninghub.vn',
      address: '22 Trương Định, Hai Bà Trưng, Hà Nội',
      city: 'Hà Nội',
      field: 'EdTech',
      description:
        'Lumen Learning Hub phát triển sản phẩm đào tạo trực tuyến cho khối doanh nghiệp với triết lý học ngắn, thực hành ngay và đo lường năng lực sau mỗi chặng.'
    },
    jobs: [
      {
        title: 'Product Content Designer cho nền tảng học tập',
        description:
          'Bạn phối hợp SME để chuyển đổi nội dung chuyên môn thành bài học tương tác, thiết kế luồng micro-learning và tối ưu tỷ lệ hoàn thành khóa học.',
        requirements:
          'Có nền tảng instructional design, viết tốt tiếng Việt học thuật ứng dụng, biết storyboard và công cụ dựng bài giảng.',
        benefits:
          'Quỹ sáng tạo nội dung cá nhân hằng quý, làm việc 4.5 ngày mỗi tuần, ngân sách đọc sách và tham dự hội thảo giáo dục số.',
        experience: '2 năm',
        level: 'Nhân viên',
        salaryFrom: 16000000,
        salaryTo: 24000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Hà Nội',
        address: 'Campus Lumen, Hà Nội',
        field: 'Giáo dục',
        deadline: buildDeadline(40)
      },
      {
        title: 'Chuyên viên vận hành lớp học online doanh nghiệp',
        description:
          'Vị trí chịu trách nhiệm lịch học, điều phối giảng viên, hỗ trợ kỹ thuật cho lớp trực tuyến và báo cáo mức độ tham gia của từng phòng ban.',
        requirements:
          'Kỹ năng điều phối tốt, xử lý linh hoạt khi lớp học thay đổi gấp, sử dụng thành thạo nền tảng họp trực tuyến và LMS.',
        benefits:
          'Thưởng theo chất lượng vận hành lớp, phụ cấp thiết bị làm việc tại nhà, hỗ trợ chứng chỉ quản trị đào tạo nội bộ.',
        experience: '1 năm',
        level: 'Nhân viên',
        salaryFrom: 13000000,
        salaryTo: 19000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Hà Nội',
        address: 'Trung tâm vận hành lớp học, Hà Nội',
        field: 'Vận hành giáo dục',
        deadline: buildDeadline(48)
      },
      {
        title: 'Backend Engineer cho hệ thống đánh giá năng lực',
        description:
          'Bạn xây API phục vụ ngân hàng câu hỏi thích ứng, tối ưu truy vấn kết quả học tập và triển khai cơ chế chống gian lận thi trực tuyến.',
        requirements:
          'Thành thạo Node.js hoặc Python backend, hiểu thiết kế hệ thống dữ liệu lớn và có kinh nghiệm bảo mật API.',
        benefits:
          'Chính sách ESOP theo cấp bậc, trợ cấp học ngoại ngữ, review lương 2 lần mỗi năm theo năng lực kỹ thuật.',
        experience: '3 năm',
        level: 'Nhân viên',
        salaryFrom: 26000000,
        salaryTo: 38000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Hà Nội',
        address: 'Khối công nghệ Lumen, Hà Nội',
        field: 'CNTT',
        deadline: buildDeadline(58)
      }
    ]
  },
  {
    email: 'nhatuyendung3@jobfinder.local',
    fullName: 'Phan Gia Huy',
    phone: '0902110003',
    address: '95 Phan Xích Long, Phú Nhuận, TP.HCM',
    company: {
      name: 'Mây Trắng Creative Studio',
      taxCode: '0319001003',
      website: 'https://maytrangstudio.vn',
      address: '95 Phan Xích Long, Phú Nhuận, TP.HCM',
      city: 'TP.HCM',
      field: 'Truyền thông sáng tạo',
      description:
        'Mây Trắng Creative Studio là agency tập trung vào storytelling thương hiệu, sản xuất nội dung đa nền tảng và tối ưu hiệu quả truyền thông bằng dữ liệu hành vi.'
    },
    jobs: [
      {
        title: 'Producer video thương hiệu đa nền tảng',
        description:
          'Bạn chịu trách nhiệm từ tiền kỳ đến hậu kỳ cho chuỗi video campaign, phối hợp đạo diễn, art và media để giữ đúng thông điệp thương hiệu.',
        requirements:
          'Có kinh nghiệm sản xuất video quảng cáo, kiểm soát tiến độ nhiều đầu việc và giao tiếp tốt với khách hàng doanh nghiệp.',
        benefits:
          'Hỗ trợ thiết bị quay dựng cá nhân, thưởng theo hiệu quả chiến dịch, ngân sách tham gia workshop điện ảnh ứng dụng.',
        experience: '3 năm',
        level: 'Nhân viên',
        salaryFrom: 20000000,
        salaryTo: 30000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'TP.HCM',
        address: 'Studio Phú Nhuận, TP.HCM',
        field: 'Truyền thông',
        deadline: buildDeadline(47)
      },
      {
        title: 'Copywriter long-form cho ngành lifestyle',
        description:
          'Vị trí viết bài dài chuyên sâu cho blog thương hiệu, landing page chuyển đổi và nội dung social có chiều sâu ngôn ngữ.',
        requirements:
          'Viết tiếng Việt chắc tay, có portfolio đa dạng chủ đề lifestyle, biết khai thác insight người dùng thành luận điểm mạch lạc.',
        benefits:
          'Lịch làm việc linh hoạt theo dự án, thưởng bản thảo đạt KPI chuyển đổi, mentoring trực tiếp với content lead.',
        experience: '2 năm',
        level: 'Nhân viên',
        salaryFrom: 15000000,
        salaryTo: 23000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'TP.HCM',
        address: 'Creative office Phú Nhuận, TP.HCM',
        field: 'Nội dung',
        deadline: buildDeadline(54)
      },
      {
        title: 'Performance Marketing Specialist cho commerce',
        description:
          'Bạn xây cấu trúc quảng cáo Meta và TikTok cho thương hiệu bán lẻ, tối ưu CAC theo từng nhóm sản phẩm và thiết kế quy trình A/B test liên tục.',
        requirements:
          'Hiểu sâu tracking, attribution và phân tích funnel; có kinh nghiệm quản lý ngân sách ads từ mức trung bình trở lên.',
        benefits:
          'Thưởng theo ROAS theo quý, hỗ trợ chứng chỉ nền tảng quảng cáo, quyền đề xuất ngân sách thử nghiệm ý tưởng mới.',
        experience: '3 năm',
        level: 'Nhân viên',
        salaryFrom: 22000000,
        salaryTo: 34000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'TP.HCM',
        address: 'Performance hub quận Phú Nhuận, TP.HCM',
        field: 'Marketing',
        deadline: buildDeadline(62)
      }
    ]
  },
  {
    email: 'nhatuyendung4@jobfinder.local',
    fullName: 'Nguyễn Quỳnh Hoa',
    phone: '0902110004',
    address: '46 Lê Văn Lương, Thanh Xuân, Hà Nội',
    company: {
      name: 'Bệnh viện Quốc tế Hòa Bình',
      taxCode: '0319001004',
      website: 'https://benhvienhoabinh.vn',
      address: '46 Lê Văn Lương, Thanh Xuân, Hà Nội',
      city: 'Hà Nội',
      field: 'Y tế chất lượng cao',
      description:
        'Bệnh viện Quốc tế Hòa Bình vận hành theo chuẩn quản trị bệnh viện hiện đại, lấy trải nghiệm người bệnh và an toàn lâm sàng làm trọng tâm.'
    },
    jobs: [
      {
        title: 'Điều dưỡng phòng mổ chuyên khoa ngoại',
        description:
          'Bạn phối hợp ekip bác sĩ trong toàn bộ quy trình tiền mê, hỗ trợ dụng cụ trong mổ và theo dõi hậu phẫu theo checklist chuẩn.',
        requirements:
          'Tốt nghiệp điều dưỡng chính quy, có chứng chỉ kiểm soát nhiễm khuẩn và kinh nghiệm thực hành phòng mổ.',
        benefits:
          'Phụ cấp trực chuyên khoa, hỗ trợ cập nhật chứng chỉ CME, chính sách chăm sóc sức khỏe cho gia đình nhân viên.',
        experience: '2 năm',
        level: 'Nhân viên',
        salaryFrom: 17000000,
        salaryTo: 25000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Hà Nội',
        address: 'Khu ngoại khoa tầng 5, Hà Nội',
        field: 'Y tế',
        deadline: buildDeadline(39)
      },
      {
        title: 'Chuyên viên quản trị chất lượng bệnh viện',
        description:
          'Vị trí theo dõi chỉ số chất lượng dịch vụ, chuẩn hóa quy trình phối hợp liên khoa và triển khai dự án cải tiến liên tục.',
        requirements:
          'Có kinh nghiệm quản lý chất lượng trong môi trường y tế, làm báo cáo KPI rõ ràng và phối hợp tốt với nhiều phòng ban.',
        benefits:
          'Thưởng theo dự án cải tiến đạt mục tiêu, ngân sách đào tạo quản trị chất lượng, hỗ trợ tham dự hội thảo chuyên ngành.',
        experience: '3 năm',
        level: 'Trưởng nhóm',
        salaryFrom: 23000000,
        salaryTo: 33000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Hà Nội',
        address: 'Khối quản trị chất lượng, Hà Nội',
        field: 'Quản lý y tế',
        deadline: buildDeadline(57)
      },
      {
        title: 'Kỹ sư bảo trì thiết bị y tế hình ảnh',
        description:
          'Bạn phụ trách bảo trì định kỳ máy MRI, CT và hệ thống PACS, phối hợp hãng để xử lý sự cố nhằm giảm downtime thiết bị.',
        requirements:
          'Nắm vững điện tử y sinh, đọc được tài liệu kỹ thuật tiếng Anh và có tư duy xử lý sự cố thiết bị phức tạp.',
        benefits:
          'Phụ cấp ca kỹ thuật, hỗ trợ chứng chỉ hãng, thưởng theo mức ổn định uptime hệ thống chẩn đoán hình ảnh.',
        experience: '3 năm',
        level: 'Nhân viên',
        salaryFrom: 25000000,
        salaryTo: 36000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Hà Nội',
        address: 'Trung tâm kỹ thuật thiết bị y tế, Hà Nội',
        field: 'Kỹ thuật y sinh',
        deadline: buildDeadline(64)
      }
    ]
  },
  {
    email: 'nhatuyendung5@jobfinder.local',
    fullName: 'Võ Thanh Bình',
    phone: '0902110005',
    address: '12 Võ Văn Kiệt, Ninh Kiều, Cần Thơ',
    company: {
      name: 'Mekong SmartFarm',
      taxCode: '0319001005',
      website: 'https://mekongsmartfarm.vn',
      address: '12 Võ Văn Kiệt, Ninh Kiều, Cần Thơ',
      city: 'Cần Thơ',
      field: 'Nông nghiệp số',
      description:
        'Mekong SmartFarm kết hợp cảm biến IoT, dữ liệu thời tiết và chuỗi lạnh để nâng chất lượng nông sản xuất khẩu tại khu vực Đồng bằng sông Cửu Long.'
    },
    jobs: [
      {
        title: 'Kỹ sư IoT giám sát trang trại thông minh',
        description:
          'Bạn triển khai thiết bị cảm biến đất nước khí hậu, tích hợp gateway tại trang trại và hiệu chỉnh ngưỡng cảnh báo phục vụ quyết định canh tác.',
        requirements:
          'Có kinh nghiệm với thiết bị IoT công nghiệp, đọc sơ đồ điện cơ bản và làm việc được trong môi trường hiện trường nông nghiệp.',
        benefits:
          'Phụ cấp công tác hiện trường, hỗ trợ ăn ở khi đi trang trại, thưởng theo dự án triển khai đúng tiến độ.',
        experience: '2 năm',
        level: 'Nhân viên',
        salaryFrom: 16000000,
        salaryTo: 24000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Cần Thơ',
        address: 'Trung tâm kỹ thuật Ninh Kiều, Cần Thơ',
        field: 'IoT',
        deadline: buildDeadline(44)
      },
      {
        title: 'Chuyên viên phát triển thị trường nông sản cao cấp',
        description:
          'Bạn xây mạng lưới khách hàng B2B cho trái cây đạt chuẩn truy xuất nguồn gốc, đàm phán kế hoạch cung ứng và phối hợp đội vận hành mùa vụ.',
        requirements:
          'Hiểu thị trường nông sản, có kỹ năng đàm phán hợp đồng và quản lý pipeline khách hàng theo từng vùng miền.',
        benefits:
          'Thưởng doanh số theo biên lợi nhuận, chính sách công tác linh hoạt, đào tạo chuyên sâu về thương mại nông sản xuất khẩu.',
        experience: '3 năm',
        level: 'Nhân viên',
        salaryFrom: 18000000,
        salaryTo: 30000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Cần Thơ',
        address: 'Văn phòng thương mại Mekong, Cần Thơ',
        field: 'Kinh doanh nông nghiệp',
        deadline: buildDeadline(56)
      },
      {
        title: 'Quản lý vận hành kho lạnh sau thu hoạch',
        description:
          'Vị trí chịu trách nhiệm cân bằng công suất kho lạnh theo mùa vụ, kiểm soát nhiệt độ theo lô hàng và điều phối giao nhận đúng lịch xuất kho.',
        requirements:
          'Có kinh nghiệm quản lý kho lạnh hoặc chuỗi cung ứng nông sản, kỹ năng lập kế hoạch và dẫn dắt đội vận hành theo ca.',
        benefits:
          'Phụ cấp trách nhiệm quản lý ca, thưởng ổn định hao hụt thấp, bảo hiểm tai nạn nghề nghiệp mở rộng.',
        experience: '4 năm',
        level: 'Quản lý / Giám sát',
        salaryFrom: 24000000,
        salaryTo: 36000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Cần Thơ',
        address: 'Cụm kho lạnh Bình Thủy, Cần Thơ',
        field: 'Vận hành kho',
        deadline: buildDeadline(66)
      }
    ]
  },
  {
    email: 'nhatuyendung6@jobfinder.local',
    fullName: 'Đặng Thảo Vy',
    phone: '0902110006',
    address: '88 Pasteur, Quận 1, TP.HCM',
    company: {
      name: 'Sổ Quỹ Nhanh Fintech',
      taxCode: '0319001006',
      website: 'https://soquynhanh.vn',
      address: '88 Pasteur, Quận 1, TP.HCM',
      city: 'TP.HCM',
      field: 'Công nghệ tài chính',
      description:
        'Sổ Quỹ Nhanh xây dựng nền tảng tài chính số cho doanh nghiệp vừa và nhỏ, tập trung tự động hóa đối soát dòng tiền và quản trị rủi ro tín dụng.'
    },
    jobs: [
      {
        title: 'Chuyên viên kiểm soát rủi ro tín dụng số',
        description:
          'Bạn phân tích hồ sơ dòng tiền doanh nghiệp, xây bộ quy tắc cảnh báo sớm và phối hợp sản phẩm để điều chỉnh chính sách cấp hạn mức.',
        requirements:
          'Nền tảng tài chính hoặc ngân hàng, hiểu mô hình chấm điểm rủi ro và có khả năng diễn giải số liệu cho khối kinh doanh.',
        benefits:
          'Thưởng theo chất lượng danh mục tín dụng, hỗ trợ thi chứng chỉ FRM cơ bản, cơ hội tham gia dự án sản phẩm mới.',
        experience: '3 năm',
        level: 'Nhân viên',
        salaryFrom: 22000000,
        salaryTo: 34000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'TP.HCM',
        address: 'Khối rủi ro tài chính số, Quận 1',
        field: 'Tài chính',
        deadline: buildDeadline(43)
      },
      {
        title: 'Frontend Engineer cho ứng dụng ví doanh nghiệp',
        description:
          'Bạn phát triển giao diện dashboard dòng tiền thời gian thực, tối ưu trải nghiệm đa thiết bị và cải thiện hiệu suất hiển thị dữ liệu lớn.',
        requirements:
          'Thành thạo React, kiến thức vững về state management và từng làm UI cho sản phẩm có yêu cầu độ chính xác dữ liệu cao.',
        benefits:
          'Trợ cấp thiết bị kỹ thuật, review lương định kỳ theo performance, quỹ học tập công nghệ frontend mới.',
        experience: '2 năm',
        level: 'Nhân viên',
        salaryFrom: 25000000,
        salaryTo: 38000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'TP.HCM',
        address: 'Tech floor Sổ Quỹ Nhanh, Quận 1',
        field: 'CNTT',
        deadline: buildDeadline(53)
      },
      {
        title: 'Chuyên viên đối soát giao dịch đa cổng thanh toán',
        description:
          'Vị trí theo dõi đối soát với ngân hàng và ví đối tác, phát hiện lệch giao dịch theo ngày và vận hành quy trình xử lý hoàn tiền.',
        requirements:
          'Cẩn thận với dữ liệu, sử dụng tốt Excel nâng cao hoặc SQL cơ bản, có tư duy kiểm soát vận hành tài chính.',
        benefits:
          'Phụ cấp ca đối soát cuối ngày, thưởng theo mức giảm sai lệch giao dịch, lộ trình lên trưởng nhóm vận hành.',
        experience: '1 năm',
        level: 'Nhân viên',
        salaryFrom: 15000000,
        salaryTo: 23000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'TP.HCM',
        address: 'Trung tâm vận hành thanh toán, Quận 1',
        field: 'Vận hành tài chính',
        deadline: buildDeadline(63)
      }
    ]
  },
  {
    email: 'nhatuyendung7@jobfinder.local',
    fullName: 'Bùi Khắc Duy',
    phone: '0902110007',
    address: '58 Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
    company: {
      name: 'Gỗ Vĩnh Phát Furniture',
      taxCode: '0319001007',
      website: 'https://govinhphat.vn',
      address: '58 Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
      city: 'Đà Nẵng',
      field: 'Sản xuất nội thất',
      description:
        'Gỗ Vĩnh Phát thiết kế và sản xuất nội thất theo đơn hàng cá nhân hóa, chú trọng quy trình tinh gọn và chất lượng hoàn thiện thủ công cao cấp.'
    },
    jobs: [
      {
        title: 'Kỹ sư thiết kế sản phẩm nội thất gỗ tự nhiên',
        description:
          'Bạn nghiên cứu nhu cầu khách hàng, phát triển bản vẽ sản phẩm và phối hợp xưởng mẫu để tối ưu cân bằng giữa thẩm mỹ và khả năng sản xuất.',
        requirements:
          'Sử dụng tốt phần mềm thiết kế 2D/3D, hiểu vật liệu gỗ tự nhiên và có tư duy cải tiến sản phẩm theo phản hồi thực tế.',
        benefits:
          'Thưởng theo mẫu bán chạy, hỗ trợ tham gia triển lãm nội thất, phụ cấp bản quyền thiết kế được thương mại hóa.',
        experience: '2 năm',
        level: 'Nhân viên',
        salaryFrom: 17000000,
        salaryTo: 27000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Đà Nẵng',
        address: 'Xưởng thiết kế mẫu, Đà Nẵng',
        field: 'Thiết kế sản phẩm',
        deadline: buildDeadline(41)
      },
      {
        title: 'Quản đốc xưởng hoàn thiện bề mặt',
        description:
          'Vị trí quản lý dây chuyền sơn phủ và hoàn thiện bề mặt, đảm bảo tiêu chuẩn màu sắc theo lô và kiểm soát tỷ lệ hàng lỗi thấp.',
        requirements:
          'Có kinh nghiệm quản lý xưởng sản xuất, hiểu quy trình sơn gỗ và kỹ năng tổ chức nhân sự theo ca.',
        benefits:
          'Phụ cấp trách nhiệm xưởng, thưởng năng suất theo tháng, hỗ trợ đào tạo an toàn lao động chuyên sâu.',
        experience: '4 năm',
        level: 'Quản lý / Giám sát',
        salaryFrom: 23000000,
        salaryTo: 34000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Đà Nẵng',
        address: 'Nhà máy Vĩnh Phát, Đà Nẵng',
        field: 'Sản xuất',
        deadline: buildDeadline(55)
      },
      {
        title: 'Chuyên viên mua hàng nguyên liệu gỗ',
        description:
          'Bạn tìm nguồn cung gỗ đạt chứng chỉ, đàm phán giá theo kỳ và kiểm soát tiến độ nhập hàng để không gián đoạn kế hoạch sản xuất.',
        requirements:
          'Kỹ năng thương lượng tốt, nắm được tiêu chuẩn nguồn gốc gỗ hợp pháp và quản lý hợp đồng nhà cung cấp.',
        benefits:
          'Thưởng tiết kiệm chi phí mua hàng, hỗ trợ đi khảo sát nhà cung cấp, lộ trình phát triển lên trưởng phòng cung ứng.',
        experience: '3 năm',
        level: 'Nhân viên',
        salaryFrom: 18000000,
        salaryTo: 28000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Đà Nẵng',
        address: 'Phòng cung ứng Vĩnh Phát, Đà Nẵng',
        field: 'Chuỗi cung ứng',
        deadline: buildDeadline(68)
      }
    ]
  },
  {
    email: 'nhatuyendung8@jobfinder.local',
    fullName: 'Ngô Nhật Lam',
    phone: '0902110008',
    address: '131 Hai Bà Trưng, Quận 1, TP.HCM',
    company: {
      name: 'PeakMove Sports Retail',
      taxCode: '0319001008',
      website: 'https://peakmove.vn',
      address: '131 Hai Bà Trưng, Quận 1, TP.HCM',
      city: 'TP.HCM',
      field: 'Bán lẻ thể thao',
      description:
        'PeakMove vận hành chuỗi cửa hàng thể thao kết hợp trải nghiệm thử sản phẩm thực tế với thương mại điện tử omnichannel trên toàn quốc.'
    },
    jobs: [
      {
        title: 'Store Operations Manager chuỗi cửa hàng flagship',
        description:
          'Bạn quản lý vận hành cửa hàng trọng điểm, tối ưu bố trí nhân sự giờ cao điểm và giữ chuẩn trải nghiệm khách hàng nhất quán theo thương hiệu.',
        requirements:
          'Từng quản lý bán lẻ quy mô lớn, có kỹ năng đọc số liệu bán hàng theo ca và huấn luyện đội ngũ frontline.',
        benefits:
          'Thưởng theo doanh thu cửa hàng, phụ cấp quản lý ca linh hoạt, chương trình mua sản phẩm nội bộ ưu đãi sâu.',
        experience: '4 năm',
        level: 'Quản lý / Giám sát',
        salaryFrom: 22000000,
        salaryTo: 32000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'TP.HCM',
        address: 'Flagship Store Quận 1, TP.HCM',
        field: 'Bán lẻ',
        deadline: buildDeadline(42)
      },
      {
        title: 'Chuyên viên thương mại điện tử marketplace',
        description:
          'Bạn phụ trách vận hành gian hàng trên sàn, tối ưu danh mục sản phẩm, theo dõi campaign sale và cải thiện tỷ lệ chuyển đổi theo tuần.',
        requirements:
          'Có kinh nghiệm vận hành sàn TMĐT, kỹ năng phân tích dữ liệu bán hàng và phối hợp tốt với đội creative.',
        benefits:
          'Thưởng theo tăng trưởng GMV, ngân sách thử nghiệm campaign mới, hỗ trợ học chứng chỉ vận hành sàn.',
        experience: '2 năm',
        level: 'Nhân viên',
        salaryFrom: 17000000,
        salaryTo: 26000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'TP.HCM',
        address: 'Ecommerce Hub PeakMove, TP.HCM',
        field: 'Thương mại điện tử',
        deadline: buildDeadline(50)
      },
      {
        title: 'Huấn luyện viên trải nghiệm sản phẩm chạy bộ',
        description:
          'Vị trí tổ chức workshop thử giày chạy, tư vấn kỹ thuật chạy an toàn cho khách và tạo nội dung cộng đồng cho các nhóm runner địa phương.',
        requirements:
          'Yêu thích thể thao bền bỉ, giao tiếp tốt trước đám đông và có khả năng hướng dẫn kỹ thuật chạy cơ bản.',
        benefits:
          'Phụ cấp sự kiện cuối tuần, tài trợ tham gia giải chạy cộng đồng, thưởng theo chỉ số hài lòng khách hàng trải nghiệm.',
        experience: '1 năm',
        level: 'Nhân viên',
        salaryFrom: 13000000,
        salaryTo: 21000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'TP.HCM',
        address: 'Cộng đồng trải nghiệm PeakMove, TP.HCM',
        field: 'Dịch vụ khách hàng',
        deadline: buildDeadline(61)
      }
    ]
  },
  {
    email: 'nhatuyendung9@jobfinder.local',
    fullName: 'Lương Thanh Tùng',
    phone: '0902110009',
    address: '29 Trần Phú, Hải Châu, Đà Nẵng',
    company: {
      name: 'Du lịch Di sản Việt',
      taxCode: '0319001009',
      website: 'https://disanviettravel.vn',
      address: '29 Trần Phú, Hải Châu, Đà Nẵng',
      city: 'Đà Nẵng',
      field: 'Lữ hành cao cấp',
      description:
        'Du lịch Di sản Việt phát triển tour trải nghiệm chiều sâu văn hóa, kết nối tuyến điểm di sản với dịch vụ cá nhân hóa cho khách nội địa và quốc tế.'
    },
    jobs: [
      {
        title: 'Điều hành tour inbound thị trường châu Âu',
        description:
          'Bạn xây lịch trình inbound theo mùa, điều phối đối tác dịch vụ tại điểm đến và xử lý tình huống tour phát sinh trong thời gian thực.',
        requirements:
          'Có kinh nghiệm điều hành tour quốc tế, giao tiếp tiếng Anh tốt và khả năng tổ chức tuyến điểm nhiều tỉnh thành.',
        benefits:
          'Thưởng theo mức độ hài lòng đoàn khách, phụ cấp đi tuyến dài ngày, hỗ trợ học thêm ngôn ngữ thứ hai.',
        experience: '3 năm',
        level: 'Nhân viên',
        salaryFrom: 18000000,
        salaryTo: 30000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Đà Nẵng',
        address: 'Trung tâm điều hành tour Hải Châu, Đà Nẵng',
        field: 'Du lịch',
        deadline: buildDeadline(46)
      },
      {
        title: 'Chuyên viên sáng tạo hành trình MICE doanh nghiệp',
        description:
          'Bạn thiết kế concept hành trình MICE theo mục tiêu thương hiệu, làm việc với nhà cung cấp và xây proposal chi tiết cho doanh nghiệp.',
        requirements:
          'Kinh nghiệm tổ chức sự kiện doanh nghiệp, tư duy sáng tạo hành trình và trình bày proposal thuyết phục.',
        benefits:
          'Thưởng dự án theo giá trị hợp đồng, ngân sách khảo sát địa điểm mới, cơ hội tham gia hội chợ du lịch quốc tế.',
        experience: '2 năm',
        level: 'Nhân viên',
        salaryFrom: 17000000,
        salaryTo: 28000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Đà Nẵng',
        address: 'Khối MICE Di sản Việt, Đà Nẵng',
        field: 'Sự kiện du lịch',
        deadline: buildDeadline(59)
      },
      {
        title: 'Nhân viên chăm sóc khách hàng cao cấp sau tour',
        description:
          'Vị trí gọi phản hồi sau tour, xử lý yêu cầu phát sinh và xây chương trình khách hàng thân thiết cho nhóm khách quay lại.',
        requirements:
          'Giọng nói rõ ràng, thái độ dịch vụ tốt, biết khai thác phản hồi khách hàng thành cải tiến cụ thể cho đội vận hành.',
        benefits:
          'Thưởng theo chỉ số tái sử dụng dịch vụ, phụ cấp ngoại ngữ, đào tạo kỹ năng xử lý tình huống khách hàng khó.',
        experience: '1 năm',
        level: 'Nhân viên',
        salaryFrom: 12000000,
        salaryTo: 19000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'Đà Nẵng',
        address: 'Trung tâm CSKH Di sản Việt, Đà Nẵng',
        field: 'Chăm sóc khách hàng',
        deadline: buildDeadline(67)
      }
    ]
  },
  {
    email: 'nhatuyendung10@jobfinder.local',
    fullName: 'Tạ Khánh Nam',
    phone: '0902110010',
    address: '200 Xa Lộ Hà Nội, TP. Thủ Đức, TP.HCM',
    company: {
      name: 'Sao Bắc Data Center',
      taxCode: '0319001010',
      website: 'https://saobakdc.vn',
      address: '200 Xa Lộ Hà Nội, TP. Thủ Đức, TP.HCM',
      city: 'TP.HCM',
      field: 'Hạ tầng trung tâm dữ liệu',
      description:
        'Sao Bắc Data Center cung cấp dịch vụ colocation, cloud private và vận hành hạ tầng mission-critical cho doanh nghiệp công nghệ tại Việt Nam.'
    },
    jobs: [
      {
        title: 'Site Reliability Engineer cho nền tảng cloud private',
        description:
          'Bạn vận hành cụm dịch vụ cloud private, xây playbook ứng phó sự cố và triển khai tự động hóa để nâng độ ổn định hệ thống.',
        requirements:
          'Có kinh nghiệm Linux, networking và monitoring, tư duy hệ thống tốt và chủ động trong ca trực kỹ thuật.',
        benefits:
          'Phụ cấp trực on-call, thưởng uptime theo quý, tài trợ thi chứng chỉ cloud và hệ thống.',
        experience: '3 năm',
        level: 'Nhân viên',
        salaryFrom: 28000000,
        salaryTo: 42000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'TP.HCM',
        address: 'Data Hall A, TP. Thủ Đức',
        field: 'DevOps',
        deadline: buildDeadline(49)
      },
      {
        title: 'Chuyên viên an toàn thông tin SOC ca xoay',
        description:
          'Vị trí giám sát log bảo mật 24/7, phân loại cảnh báo, điều phối ứng cứu sự cố và hoàn thiện báo cáo hậu kiểm định kỳ.',
        requirements:
          'Nắm vững nguyên tắc an toàn thông tin, quen SIEM hoặc IDS/IPS và có khả năng viết quy trình phản ứng sự cố.',
        benefits:
          'Phụ cấp ca đêm, phụ cấp chứng chỉ bảo mật, lộ trình phát triển sang incident response lead.',
        experience: '2 năm',
        level: 'Nhân viên',
        salaryFrom: 24000000,
        salaryTo: 36000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'TP.HCM',
        address: 'SOC Center Sao Bắc, TP. Thủ Đức',
        field: 'An ninh mạng',
        deadline: buildDeadline(58)
      },
      {
        title: 'Quản lý dự án triển khai hạ tầng doanh nghiệp',
        description:
          'Bạn dẫn dắt các dự án triển khai rack, network và backup site cho khách hàng doanh nghiệp, kiểm soát phạm vi tiến độ ngân sách và nghiệm thu.',
        requirements:
          'Kỹ năng quản lý dự án hạ tầng tốt, giao tiếp với nhiều bên liên quan và có khả năng ra quyết định trong điều kiện áp lực.',
        benefits:
          'Thưởng milestone theo từng giai đoạn, ngân sách học PMP nền tảng, phụ cấp di chuyển khi triển khai liên vùng.',
        experience: '5 năm',
        level: 'Trưởng/Phó phòng',
        salaryFrom: 35000000,
        salaryTo: 50000000,
        salaryType: 'Tháng',
        workType: 'Toàn thời gian',
        city: 'TP.HCM',
        address: 'Khối dự án hạ tầng Sao Bắc, TP. Thủ Đức',
        field: 'Quản lý dự án CNTT',
        deadline: buildDeadline(70)
      }
    ]
  }
];

const CANDIDATE_DEMOS = [
  {
    email: 'ungvien1@jobfinder.local',
    fullName: 'Phạm Minh Anh',
    phone: '0913110001',
    address: '12 Nguyễn Chí Thanh, Đống Đa, Hà Nội',
    profile: {
      birthday: '1998-03-12',
      gender: 'Nữ',
      city: 'Hà Nội',
      district: 'Đống Đa',
      title: 'Chuyên viên vận hành logistics',
      education: 'Đại học Kinh tế Quốc dân - Quản trị chuỗi cung ứng',
      experienceYears: 3,
      intro:
        'Có kinh nghiệm điều phối đơn hàng đa kho và xử lý sự cố giao nhận theo thời gian thực. Mạnh về phối hợp liên phòng ban.',
      personalLink: 'https://portfolio.jobfinder.local/candidate1'
    }
  },
  {
    email: 'ungvien2@jobfinder.local',
    fullName: 'Nguyễn Tuấn Kiệt',
    phone: '0913110002',
    address: '44 Trần Bình Trọng, Hai Bà Trưng, Hà Nội',
    profile: {
      birthday: '1997-11-05',
      gender: 'Nam',
      city: 'Hà Nội',
      district: 'Hai Bà Trưng',
      title: 'Instructional Designer',
      education: 'Đại học Sư phạm Hà Nội - Công nghệ giáo dục',
      experienceYears: 4,
      intro:
        'Thiết kế chương trình học trực tuyến cho doanh nghiệp, tập trung vào bài học ngắn và đo lường năng lực sau đào tạo.',
      personalLink: 'https://portfolio.jobfinder.local/candidate2'
    }
  },
  {
    email: 'ungvien3@jobfinder.local',
    fullName: 'Lê Hồng Vân',
    phone: '0913110003',
    address: '88 Lê Quang Định, Bình Thạnh, TP.HCM',
    profile: {
      birthday: '1996-06-21',
      gender: 'Nữ',
      city: 'TP.HCM',
      district: 'Bình Thạnh',
      title: 'Content Strategist',
      education: 'Đại học KHXH&NV - Báo chí',
      experienceYears: 5,
      intro:
        'Phát triển chiến lược nội dung dài hạn cho thương hiệu lifestyle, kết hợp nghiên cứu insight và tối ưu chuyển đổi.',
      personalLink: 'https://portfolio.jobfinder.local/candidate3'
    }
  },
  {
    email: 'ungvien4@jobfinder.local',
    fullName: 'Trịnh Quang Hải',
    phone: '0913110004',
    address: '102 Nguyễn Trãi, Thanh Xuân, Hà Nội',
    profile: {
      birthday: '1995-01-17',
      gender: 'Nam',
      city: 'Hà Nội',
      district: 'Thanh Xuân',
      title: 'Kỹ sư thiết bị y sinh',
      education: 'Đại học Bách khoa Hà Nội - Kỹ thuật y sinh',
      experienceYears: 6,
      intro:
        'Kinh nghiệm bảo trì thiết bị chẩn đoán hình ảnh, tối ưu uptime hệ thống và phối hợp chặt với đội lâm sàng.',
      personalLink: 'https://portfolio.jobfinder.local/candidate4'
    }
  },
  {
    email: 'ungvien5@jobfinder.local',
    fullName: 'Đỗ Thị Ngọc Mai',
    phone: '0913110005',
    address: '35 Mậu Thân, Ninh Kiều, Cần Thơ',
    profile: {
      birthday: '1999-09-30',
      gender: 'Nữ',
      city: 'Cần Thơ',
      district: 'Ninh Kiều',
      title: 'Kỹ sư IoT nông nghiệp',
      education: 'Đại học Cần Thơ - Kỹ thuật điều khiển và tự động hóa',
      experienceYears: 2,
      intro:
        'Triển khai cảm biến môi trường cho trang trại và phân tích dữ liệu để tối ưu lịch tưới bón theo mùa vụ.',
      personalLink: 'https://portfolio.jobfinder.local/candidate5'
    }
  },
  {
    email: 'ungvien6@jobfinder.local',
    fullName: 'Hoàng Đức Mạnh',
    phone: '0913110006',
    address: '16 Võ Thị Sáu, Quận 3, TP.HCM',
    profile: {
      birthday: '1998-12-08',
      gender: 'Nam',
      city: 'TP.HCM',
      district: 'Quận 3',
      title: 'Chuyên viên rủi ro tài chính',
      education: 'Đại học Ngân hàng TP.HCM - Tài chính doanh nghiệp',
      experienceYears: 4,
      intro:
        'Từng xây mô hình cảnh báo rủi ro cho sản phẩm tín dụng số và hỗ trợ điều chỉnh chính sách hạn mức theo dữ liệu.',
      personalLink: 'https://portfolio.jobfinder.local/candidate6'
    }
  },
  {
    email: 'ungvien7@jobfinder.local',
    fullName: 'Ngô Thu Hà',
    phone: '0913110007',
    address: '73 Hoàng Diệu, Hải Châu, Đà Nẵng',
    profile: {
      birthday: '1997-04-14',
      gender: 'Nữ',
      city: 'Đà Nẵng',
      district: 'Hải Châu',
      title: 'Thiết kế sản phẩm nội thất',
      education: 'Đại học Kiến trúc Đà Nẵng - Thiết kế công nghiệp',
      experienceYears: 3,
      intro:
        'Thiết kế sản phẩm nội thất theo hướng công thái học, chú trọng cân bằng thẩm mỹ và khả năng sản xuất hàng loạt.',
      personalLink: 'https://portfolio.jobfinder.local/candidate7'
    }
  },
  {
    email: 'ungvien8@jobfinder.local',
    fullName: 'Phan Quốc Khánh',
    phone: '0913110008',
    address: '210 Lý Chính Thắng, Quận 3, TP.HCM',
    profile: {
      birthday: '1996-10-02',
      gender: 'Nam',
      city: 'TP.HCM',
      district: 'Quận 3',
      title: 'Ecommerce Specialist',
      education: 'Đại học Kinh tế TP.HCM - Thương mại điện tử',
      experienceYears: 5,
      intro:
        'Quản lý gian hàng đa sàn cho ngành bán lẻ, tối ưu vận hành campaign và cải thiện tỷ lệ chuyển đổi theo từng danh mục.',
      personalLink: 'https://portfolio.jobfinder.local/candidate8'
    }
  },
  {
    email: 'ungvien9@jobfinder.local',
    fullName: 'Tăng Mỹ Duyên',
    phone: '0913110009',
    address: '54 Bạch Đằng, Hải Châu, Đà Nẵng',
    profile: {
      birthday: '1995-08-26',
      gender: 'Nữ',
      city: 'Đà Nẵng',
      district: 'Hải Châu',
      title: 'Điều hành tour quốc tế',
      education: 'Đại học Ngoại ngữ Đà Nẵng - Tiếng Anh thương mại',
      experienceYears: 6,
      intro:
        'Điều hành đoàn khách inbound quy mô lớn, xử lý phát sinh nhanh và tối ưu trải nghiệm khách theo tuyến điểm di sản.',
      personalLink: 'https://portfolio.jobfinder.local/candidate9'
    }
  },
  {
    email: 'ungvien10@jobfinder.local',
    fullName: 'Vũ Đình Long',
    phone: '0913110010',
    address: '155 Võ Văn Ngân, TP. Thủ Đức, TP.HCM',
    profile: {
      birthday: '1994-02-11',
      gender: 'Nam',
      city: 'TP.HCM',
      district: 'TP. Thủ Đức',
      title: 'Site Reliability Engineer',
      education: 'Đại học Công nghệ Thông tin - Hệ thống thông tin',
      experienceYears: 7,
      intro:
        'Vận hành hạ tầng cloud quy mô lớn, xây quy trình ứng cứu sự cố và cải thiện độ ổn định hệ thống bằng tự động hóa.',
      personalLink: 'https://portfolio.jobfinder.local/candidate10'
    }
  }
];

const upsertUser = async ({ email, fullName, phone, role, address, passwordHash }) => {
  const existing = await dbGet(
    'SELECT MaNguoiDung FROM NguoiDung WHERE lower(Email) = lower(?) LIMIT 1',
    [email]
  );

  if (existing?.MaNguoiDung) {
    await dbRun(
      `UPDATE NguoiDung
       SET MatKhau = ?,
           HoTen = ?,
           SoDienThoai = ?,
           VaiTro = ?,
           TrangThai = ?,
           DiaChi = ?,
           NgayCapNhat = datetime('now','localtime')
       WHERE MaNguoiDung = ?`,
      [passwordHash, fullName, phone, role, DEMO_STATUS, address, existing.MaNguoiDung]
    );
    return existing.MaNguoiDung;
  }

  const inserted = await dbRun(
    `INSERT INTO NguoiDung (Email, MatKhau, HoTen, SoDienThoai, VaiTro, TrangThai, DiaChi)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [email, passwordHash, fullName, phone, role, DEMO_STATUS, address]
  );

  if (inserted?.lastID) return inserted.lastID;

  const fallback = await dbGet(
    'SELECT MaNguoiDung FROM NguoiDung WHERE lower(Email) = lower(?) LIMIT 1',
    [email]
  );
  if (!fallback?.MaNguoiDung) {
    throw new Error(`Không thể tạo hoặc tìm user demo: ${email}`);
  }
  return fallback.MaNguoiDung;
};

const upsertEmployer = async ({ userId, company }) => {
  const existing = await dbGet(
    'SELECT MaNhaTuyenDung FROM NhaTuyenDung WHERE MaNguoiDung = ? LIMIT 1',
    [userId]
  );

  if (existing?.MaNhaTuyenDung) {
    await dbRun(
      `UPDATE NhaTuyenDung
       SET TenCongTy = ?, MaSoThue = ?, Website = ?, DiaChi = ?, ThanhPho = ?, MoTa = ?,
           NgayCapNhat = datetime('now','localtime')
       WHERE MaNhaTuyenDung = ?`,
      [
        company.name,
        company.taxCode,
        company.website,
        company.address,
        company.city,
        company.description,
        existing.MaNhaTuyenDung
      ]
    );
    return existing.MaNhaTuyenDung;
  }

  const inserted = await dbRun(
    `INSERT INTO NhaTuyenDung (MaNguoiDung, TenCongTy, MaSoThue, Website, DiaChi, ThanhPho, MoTa)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      company.name,
      company.taxCode,
      company.website,
      company.address,
      company.city,
      company.description
    ]
  );

  if (inserted?.lastID) return inserted.lastID;

  const fallback = await dbGet(
    'SELECT MaNhaTuyenDung FROM NhaTuyenDung WHERE MaNguoiDung = ? LIMIT 1',
    [userId]
  );
  if (!fallback?.MaNhaTuyenDung) {
    throw new Error(`Không thể tạo hồ sơ nhà tuyển dụng cho user #${userId}`);
  }
  return fallback.MaNhaTuyenDung;
};

const upsertCompany = async ({ userId, company }) => {
  const existing = await dbGet(
    'SELECT MaCongTy FROM CongTy WHERE NguoiDaiDien = ? ORDER BY MaCongTy ASC LIMIT 1',
    [userId]
  );

  if (existing?.MaCongTy) {
    await dbRun(
      `UPDATE CongTy
       SET TenCongTy = ?, MaSoThue = ?, DiaChi = ?, ThanhPho = ?, Website = ?, LinhVuc = ?, MoTa = ?,
           NgayCapNhat = datetime('now','localtime')
       WHERE MaCongTy = ?`,
      [
        company.name,
        company.taxCode,
        company.address,
        company.city,
        company.website,
        company.field,
        company.description,
        existing.MaCongTy
      ]
    );
    return existing.MaCongTy;
  }

  const inserted = await dbRun(
    `INSERT INTO CongTy (TenCongTy, MaSoThue, DiaChi, ThanhPho, Website, LinhVuc, MoTa, NguoiDaiDien)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      company.name,
      company.taxCode,
      company.address,
      company.city,
      company.website,
      company.field,
      company.description,
      userId
    ]
  );

  if (inserted?.lastID) return inserted.lastID;

  const fallback = await dbGet(
    'SELECT MaCongTy FROM CongTy WHERE NguoiDaiDien = ? ORDER BY MaCongTy ASC LIMIT 1',
    [userId]
  );
  if (!fallback?.MaCongTy) {
    throw new Error(`Không thể tạo công ty cho user #${userId}`);
  }
  return fallback.MaCongTy;
};

const upsertJob = async ({ employerId, job }) => {
  const existing = await dbGet(
    'SELECT MaTin FROM TinTuyenDung WHERE MaNhaTuyenDung = ? AND TieuDe = ? LIMIT 1',
    [employerId, job.title]
  );

  if (existing?.MaTin) {
    await dbRun(
      `UPDATE TinTuyenDung
       SET MoTa = ?, YeuCau = ?, QuyenLoi = ?, KinhNghiem = ?, CapBac = ?,
           LuongTu = ?, LuongDen = ?, KieuLuong = ?, DiaDiem = ?, ThanhPho = ?,
           LinhVucCongViec = ?, HinhThuc = ?, TrangThai = 'Đã đăng', HanNopHoSo = ?
       WHERE MaTin = ?`,
      [
        job.description,
        job.requirements,
        job.benefits,
        job.experience,
        job.level,
        job.salaryFrom,
        job.salaryTo,
        job.salaryType,
        job.address,
        job.city,
        job.field,
        job.workType,
        job.deadline,
        existing.MaTin
      ]
    );
    return existing.MaTin;
  }

  const inserted = await dbRun(
    `INSERT INTO TinTuyenDung (
      MaNhaTuyenDung, TieuDe, MoTa, YeuCau, QuyenLoi, KinhNghiem, CapBac,
      LuongTu, LuongDen, KieuLuong, DiaDiem, ThanhPho, LinhVucCongViec,
      HinhThuc, TrangThai, HanNopHoSo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Đã đăng', ?)`,
    [
      employerId,
      job.title,
      job.description,
      job.requirements,
      job.benefits,
      job.experience,
      job.level,
      job.salaryFrom,
      job.salaryTo,
      job.salaryType,
      job.address,
      job.city,
      job.field,
      job.workType,
      job.deadline
    ]
  );

  if (inserted?.lastID) return inserted.lastID;

  const fallback = await dbGet(
    'SELECT MaTin FROM TinTuyenDung WHERE MaNhaTuyenDung = ? AND TieuDe = ? LIMIT 1',
    [employerId, job.title]
  );
  if (!fallback?.MaTin) {
    throw new Error(`Không thể tạo tin tuyển dụng: ${job.title}`);
  }
  return fallback.MaTin;
};

const upsertCandidateProfile = async ({ userId, profile, address }) => {
  const existing = await dbGet(
    'SELECT MaHoSo FROM HoSoUngVien WHERE MaNguoiDung = ? LIMIT 1',
    [userId]
  );

  if (existing?.MaHoSo) {
    await dbRun(
      `UPDATE HoSoUngVien
       SET NgaySinh = ?, GioiTinh = ?, DiaChi = ?, ThanhPho = ?, QuanHuyen = ?,
           GioiThieuBanThan = ?, TrinhDoHocVan = ?,
           ChucDanh = ?, LinkCaNhan = ?, NgayCapNhat = datetime('now','localtime')
       WHERE MaHoSo = ?`,
      [
        profile.birthday,
        profile.gender,
        address,
        profile.city,
        profile.district,
        profile.intro,
        profile.education,
        profile.title,
        profile.personalLink,
        existing.MaHoSo
      ]
    );
    return existing.MaHoSo;
  }

  const inserted = await dbRun(
    `INSERT INTO HoSoUngVien (
      MaNguoiDung, NgaySinh, GioiTinh, DiaChi, ThanhPho, QuanHuyen,
      GioiThieuBanThan, TrinhDoHocVan, ChucDanh, LinkCaNhan
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      profile.birthday,
      profile.gender,
      address,
      profile.city,
      profile.district,
      profile.intro,
      profile.education,
      profile.title,
      profile.personalLink
    ]
  );

  if (inserted?.lastID) return inserted.lastID;

  const fallback = await dbGet(
    'SELECT MaHoSo FROM HoSoUngVien WHERE MaNguoiDung = ? LIMIT 1',
    [userId]
  );
  if (!fallback?.MaHoSo) {
    throw new Error(`Không thể tạo hồ sơ ứng viên cho user #${userId}`);
  }
  return fallback.MaHoSo;
};

const seedEmployers = async (passwordHash) => {
  for (const entry of EMPLOYER_DEMOS) {
    const userId = await upsertUser({
      email: entry.email,
      fullName: entry.fullName,
      phone: entry.phone,
      role: 'Nhà tuyển dụng',
      address: entry.address,
      passwordHash
    });

    const employerId = await upsertEmployer({ userId, company: entry.company });
    await upsertCompany({ userId, company: entry.company });

    for (const job of entry.jobs) {
      await upsertJob({ employerId, job });
    }
  }
};

const seedCandidates = async (passwordHash) => {
  for (const entry of CANDIDATE_DEMOS) {
    const userId = await upsertUser({
      email: entry.email,
      fullName: entry.fullName,
      phone: entry.phone,
      role: 'Ứng viên',
      address: entry.address,
      passwordHash
    });

    await upsertCandidateProfile({
      userId,
      profile: entry.profile,
      address: entry.address
    });
  }
};

const printSummary = async () => {
  const demoUsers = await dbAll(
    `SELECT Email, VaiTro
     FROM NguoiDung
     WHERE lower(Email) LIKE 'nhatuyendung%@jobfinder.local'
        OR lower(Email) LIKE 'ungvien%@jobfinder.local'
     ORDER BY Email ASC`
  );

  const employerUsers = demoUsers.filter((u) => u.VaiTro === 'Nhà tuyển dụng').length;
  const candidateUsers = demoUsers.filter((u) => u.VaiTro === 'Ứng viên').length;

  const demoJobs = await dbGet(
    `SELECT COUNT(1) AS total
     FROM TinTuyenDung ttd
     JOIN NhaTuyenDung ntd ON ntd.MaNhaTuyenDung = ttd.MaNhaTuyenDung
     JOIN NguoiDung nd ON nd.MaNguoiDung = ntd.MaNguoiDung
     WHERE lower(nd.Email) LIKE 'nhatuyendung%@jobfinder.local'`
  );

  console.log('--- Seed demo summary ---');
  console.log(`Demo password: ${DEMO_PASSWORD}`);
  console.log(`Employer accounts: ${employerUsers}`);
  console.log(`Candidate accounts: ${candidateUsers}`);
  console.log(`Employer demo jobs: ${Number(demoJobs?.total || 0)}`);
};

async function main() {
  try {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    await seedEmployers(passwordHash);
    await seedCandidates(passwordHash);

    await printSummary();
    console.log('Seed demo marketplace hoàn tất.');
    process.exit(0);
  } catch (error) {
    console.error('Seed demo marketplace thất bại:', error.message);
    process.exit(1);
  }
}

main();
