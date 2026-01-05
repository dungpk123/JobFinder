-- Seed data for CareerGuide table
-- Insert sample career guide posts

-- Post 1: Tips for writing a good CV
INSERT INTO CareerGuide (title, content, authorId, authorType, createdAt, views) VALUES 
('5 Bí Quyết Viết CV Thu Hút Nhà Tuyển Dụng', 
'<h2>Giới thiệu</h2>
<p>Một bản CV tốt là chìa khóa để bạn có được cơ hội phỏng vấn. Dưới đây là 5 bí quyết giúp CV của bạn nổi bật trong hàng trăm hồ sơ ứng tuyển.</p>

<h3>1. Định dạng rõ ràng, dễ đọc</h3>
<p>Sử dụng font chữ chuyên nghiệp như Arial, Calibri hoặc Times New Roman. Kích thước font từ 11-12pt cho nội dung và 14-16pt cho tiêu đề. Tránh sử dụng quá nhiều màu sắc và hiệu ứng.</p>

<h3>2. Tùy chỉnh CV cho từng vị trí</h3>
<p>Đọc kỹ mô tả công việc và điều chỉnh CV để làm nổi bật những kỹ năng, kinh nghiệm phù hợp với yêu cầu của nhà tuyển dụng.</p>

<h3>3. Sử dụng từ khóa quan trọng</h3>
<p>Nhiều công ty sử dụng hệ thống ATS (Applicant Tracking System) để lọc CV. Hãy đưa các từ khóa liên quan đến vị trí ứng tuyển vào CV của bạn.</p>

<h3>4. Nêu bật thành tích cụ thể</h3>
<p>Thay vì chỉ liệt kê trách nhiệm, hãy nêu rõ những thành tích đã đạt được với số liệu cụ thể. Ví dụ: "Tăng doanh số 30% trong 6 tháng".</p>

<h3>5. Kiểm tra kỹ lỗi chính tả và ngữ pháp</h3>
<p>Một CV có lỗi chính tả có thể khiến bạn mất điểm nghiêm trọng. Hãy đọc lại nhiều lần hoặc nhờ người khác kiểm tra giúp.</p>

<p><strong>Kết luận:</strong> Hãy dành thời gian để tạo một bản CV chuyên nghiệp, nó sẽ giúp bạn tăng đáng kể cơ hội được mời phỏng vấn!</p>', 
1, 'admin', datetime('now', '-5 days'), 245);

-- Post 2: Interview preparation tips
INSERT INTO CareerGuide (title, content, authorId, authorType, createdAt, views) VALUES 
('Chuẩn Bị Gì Trước Buổi Phỏng Vấn Xin Việc?', 
'<h2>Hướng dẫn chi tiết chuẩn bị phỏng vấn</h2>
<p>Phỏng vấn là bước quan trọng quyết định bạn có được nhận vào vị trí mong muốn hay không. Dưới đây là những điều bạn cần chuẩn bị:</p>

<h3>Trước buổi phỏng vấn 1-2 ngày</h3>
<ul>
  <li><strong>Nghiên cứu về công ty:</strong> Tìm hiểu về lịch sử, văn hóa, sản phẩm/dịch vụ, và tin tức gần đây của công ty</li>
  <li><strong>Xem lại JD:</strong> Đọc kỹ mô tả công việc để hiểu rõ yêu cầu và chuẩn bị câu trả lời phù hợp</li>
  <li><strong>Chuẩn bị câu trả lời:</strong> Luyện tập trả lời các câu hỏi phổ biến như "Giới thiệu về bản thân", "Điểm mạnh/yếu", "Tại sao muốn làm việc tại công ty"</li>
  <li><strong>Chuẩn bị câu hỏi:</strong> Nghĩ trước 3-5 câu hỏi thông minh để hỏi nhà tuyển dụng</li>
</ul>

<h3>Ngày phỏng vấn</h3>
<ul>
  <li>Ăn mặc chỉnh tề, phù hợp với văn hóa công ty</li>
  <li>Đến sớm 10-15 phút</li>
  <li>Mang theo CV, bằng cấp, chứng chỉ liên quan</li>
  <li>Tắt điện thoại hoặc chuyển sang chế độ im lặng</li>
  <li>Mang theo sổ tay và bút để ghi chép</li>
</ul>

<h3>Trong buổi phỏng vấn</h3>
<ul>
  <li>Bắt tay chắc chắn và duy trì giao tiếp bằng mắt</li>
  <li>Ngồi thẳng lưng, tự tin</li>
  <li>Lắng nghe kỹ câu hỏi trước khi trả lời</li>
  <li>Trả lời ngắn gọn, súc tích, có ví dụ minh họa</li>
  <li>Tránh nói xấu công ty cũ</li>
  <li>Thể hiện sự hứng thú với công việc và công ty</li>
</ul>

<h3>Sau buổi phỏng vấn</h3>
<p>Gửi email cảm ơn trong vòng 24 giờ, nhấn mạnh sự quan tâm của bạn đối với vị trí.</p>

<p><em>Chúc bạn thành công!</em></p>', 
1, 'admin', datetime('now', '-3 days'), 189);

-- Post 3: Career development tips
INSERT INTO CareerGuide (title, content, authorId, authorType, createdAt, views) VALUES 
('Làm Thế Nào Để Phát Triển Sự Nghiệp Trong Thời Đại 4.0?', 
'<h2>Chiến lược phát triển sự nghiệp hiện đại</h2>
<p>Thế giới công nghệ đang thay đổi nhanh chóng, và cách chúng ta làm việc cũng thay đổi theo. Dưới đây là những chiến lược giúp bạn phát triển sự nghiệp trong kỷ nguyên số:</p>

<h3>1. Học tập liên tục</h3>
<p>Đầu tư vào việc học các kỹ năng mới, đặc biệt là kỹ năng công nghệ. Tham gia các khóa học online, đọc sách, theo dõi các chuyên gia trong ngành.</p>

<h3>2. Xây dựng thương hiệu cá nhân</h3>
<p>Tạo dựng sự hiện diện trên mạng xã hội chuyên nghiệp như LinkedIn. Chia sẻ kiến thức, tham gia thảo luận, kết nối với đồng nghiệp.</p>

<h3>3. Phát triển kỹ năng mềm</h3>
<p>Ngoài kỹ năng chuyên môn, các kỹ năng như giao tiếp, làm việc nhóm, giải quyết vấn đề và tư duy phản biện cũng rất quan trọng.</p>

<h3>4. Mạng lưới quan hệ</h3>
<p>Tham gia các sự kiện ngành, hội thảo, workshop để mở rộng mạng lưới. Networking không chỉ giúp bạn tìm việc mà còn học hỏi kinh nghiệm từ người khác.</p>

<h3>5. Linh hoạt và thích nghi</h3>
<p>Sẵn sàng thay đổi và học những công việc mới. Những người thành công là những người biết thích nghi với môi trường làm việc mới.</p>

<h3>6. Đặt mục tiêu rõ ràng</h3>
<p>Xác định rõ bạn muốn gì trong 1, 3, 5 năm tới. Có kế hoạch cụ thể và đo lường được để theo đuổi mục tiêu.</p>

<blockquote>
"Thành công không phải là chìa khóa của hạnh phúc. Hạnh phúc là chìa khóa của thành công. Nếu bạn yêu thích công việc mình làm, bạn sẽ thành công." - Albert Schweitzer
</blockquote>

<p>Hãy kiên trì và không ngừng phát triển bản thân!</p>', 
1, 'admin', datetime('now', '-1 day'), 156);

-- Post 4: Salary negotiation
INSERT INTO CareerGuide (title, content, authorId, authorType, createdAt, views) VALUES 
('Bí Kíp Thương Lượng Lương Thành Công Cho Người Mới Bắt Đầu', 
'<h2>Nghệ thuật thương lượng lương</h2>
<p>Thương lượng lương là một kỹ năng quan trọng mà nhiều người thường ngại thực hiện. Dưới đây là hướng dẫn chi tiết giúp bạn tự tin hơn trong việc đàm phán mức lương xứng đáng.</p>

<h3>Chuẩn bị trước khi thương lượng</h3>
<ol>
  <li><strong>Nghiên cứu mức lương thị trường:</strong> Tìm hiểu mức lương trung bình cho vị trí tương tự trong ngành và khu vực</li>
  <li><strong>Biết giá trị của mình:</strong> Liệt kê các kỹ năng, kinh nghiệm và thành tích của bạn</li>
  <li><strong>Xác định mức lương mong muốn:</strong> Đặt ra một khoảng lương hợp lý (thấp nhất - cao nhất)</li>
</ol>

<h3>Thời điểm thương lượng</h3>
<p>Thời điểm tốt nhất để thương lượng lương là:</p>
<ul>
  <li>Khi nhà tuyển dụng đưa ra lời mời làm việc</li>
  <li>Khi bạn có offer từ công ty khác</li>
  <li>Sau khi hoàn thành xuất sắc một dự án quan trọng</li>
  <li>Trong buổi đánh giá hiệu suất hàng năm</li>
</ul>

<h3>Cách thương lượng hiệu quả</h3>
<p><strong>1. Bắt đầu bằng sự biết ơn:</strong> Cảm ơn nhà tuyển dụng về lời mời và thể hiện sự hứng thú</p>
<p><strong>2. Đưa ra con số cụ thể:</strong> Đề xuất một khoảng lương dựa trên nghiên cứu của bạn</p>
<p><strong>3. Nêu rõ giá trị bạn mang lại:</strong> Giải thích tại sao bạn xứng đáng với mức lương đó</p>
<p><strong>4. Lắng nghe và linh hoạt:</strong> Sẵn sàng đàm phán về các phúc lợi khác nếu không thể tăng lương cơ bản</p>

<h3>Những điều cần tránh</h3>
<ul>
  <li>❌ Đưa ra yêu cầu quá cao không thực tế</li>
  <li>❌ So sánh với đồng nghiệp khác</li>
  <li>❌ Nói về vấn đề tài chính cá nhân</li>
  <li>❌ Chấp nhận ngay lập tức lời đề nghị đầu tiên</li>
  <li>❌ Đe dọa nghỉ việc</li>
</ul>

<h3>Ví dụ câu thương lượng</h3>
<p><em>"Tôi rất vui mừng với lời mời này và mong muốn được làm việc tại [Tên công ty]. Dựa trên kinh nghiệm [X năm] và kỹ năng [liệt kê], cũng như mức lương thị trường hiện tại cho vị trí này, tôi hy vọng chúng ta có thể thảo luận về mức lương từ [X - Y] triệu đồng."</em></p>

<p><strong>Lưu ý:</strong> Nếu công ty không thể tăng lương cơ bản, hãy thương lượng về:</p>
<ul>
  <li>Bonus hiệu suất</li>
  <li>Ngày nghỉ phép thêm</li>
  <li>Làm việc từ xa</li>
  <li>Hỗ trợ đào tạo</li>
  <li>Xem xét tăng lương sớm hơn</li>
</ul>', 
1, 'admin', datetime('now', '-6 hours'), 78);

-- Post 5: Remote work tips
INSERT INTO CareerGuide (title, content, authorId, authorType, createdAt, views) VALUES 
('10 Mẹo Làm Việc Từ Xa Hiệu Quả', 
'<h2>Tối ưu hóa năng suất khi làm việc tại nhà</h2>
<p>Làm việc từ xa đang trở thành xu hướng phổ biến. Dưới đây là những mẹo giúp bạn làm việc hiệu quả hơn khi ở nhà:</p>

<h3>1. Tạo không gian làm việc riêng</h3>
<p>Thiết lập một góc làm việc tách biệt, tránh làm việc trên giường hoặc sofa. Đầu tư vào bàn ghế ergonomic.</p>

<h3>2. Thiết lập lịch trình rõ ràng</h3>
<p>Duy trì giờ giấc làm việc cố định, bắt đầu và kết thúc đúng giờ như ở văn phòng.</p>

<h3>3. Ăn mặc chỉnh chu</h3>
<p>Thay đồ ngủ, ăn mặc như đi làm để tạo tâm lý làm việc chuyên nghiệp.</p>

<h3>4. Sử dụng công cụ quản lý công việc</h3>
<p>Trello, Asana, Notion hay Google Calendar giúp bạn theo dõi và tổ chức công việc hiệu quả.</p>

<h3>5. Nghỉ giải lao đúng cách</h3>
<p>Áp dụng kỹ thuật Pomodoro: Làm việc 25 phút, nghỉ 5 phút. Tránh làm việc liên tục nhiều giờ.</p>

<h3>6. Giao tiếp thường xuyên với đồng nghiệp</h3>
<p>Sử dụng Slack, Teams, Zoom để duy trì kết nối. Đừng ngần ngại hỏi khi cần hỗ trợ.</p>

<h3>7. Tránh làm nhiều việc cùng lúc</h3>
<p>Tập trung vào một nhiệm vụ tại một thời điểm để đảm bảo chất lượng công việc.</p>

<h3>8. Tắt thông báo không cần thiết</h3>
<p>Hạn chế xao nhãng từ mạng xã hội, email cá nhân khi đang trong giờ làm việc.</p>

<h3>9. Chăm sóc sức khỏe</h3>
<p>Tập thể dục, uống đủ nước, ăn uống lành mạnh. Sức khỏe tốt = năng suất cao.</p>

<h3>10. Kết thúc ngày làm việc đúng cách</h3>
<p>Tắt máy tính, rời khỏi bàn làm việc. Phân tách rõ ràng giữa công việc và đời sống cá nhân.</p>

<p><strong>Bonus tip:</strong> Đầu tư vào internet tốc độ cao và thiết bị làm việc chất lượng (màn hình, bàn phím, webcam) để làm việc thoải mái hơn.</p>', 
1, 'admin', datetime('now', '-2 hours'), 45);

-- Add some sample comments
INSERT INTO CareerGuideComment (postId, userId, userType, content, createdAt) VALUES 
(1, 1, 'admin', 'Bài viết rất hữu ích! Cảm ơn tác giả đã chia sẻ.', datetime('now', '-4 days')),
(1, 1, 'admin', 'Mình đã áp dụng và thấy hiệu quả ngay. CV của mình đã được nhiều công ty phản hồi hơn.', datetime('now', '-3 days')),
(2, 1, 'admin', 'Những tips này rất thực tế. Mình sẽ áp dụng cho buổi phỏng vấn tuần sau!', datetime('now', '-2 days')),
(3, 1, 'admin', 'Rất đồng ý với quan điểm học tập liên tục. Trong thời đại này, không học là tụt hậu ngay.', datetime('now', '-1 day')),
(4, 1, 'admin', 'Mình hay ngại thương lượng lương nhưng sau khi đọc bài này thấy tự tin hơn nhiều!', datetime('now', '-5 hours'));
