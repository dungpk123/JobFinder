const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'timkiemvieclam.db');
const db = new sqlite3.Database(dbPath);

console.log('\n=== DANH SÁCH TÀI KHOẢN ===\n');

db.all('SELECT MaNguoiDung, Email, HoTen, VaiTro FROM NguoiDung ORDER BY MaNguoiDung', (err, rows) => {
    if (err) {
        console.error('Lỗi:', err.message);
    } else {
        if (rows.length === 0) {
            console.log('Chưa có tài khoản nào.');
        } else {
            rows.forEach(user => {
                console.log(`${user.MaNguoiDung}. ${user.HoTen} (${user.Email}) - Vai trò: ${user.VaiTro}`);
            });
        }
    }
    
    console.log('\n=== DANH SÁCH CÔNG TY ===\n');
    
    db.all('SELECT * FROM CongTy', (err2, companies) => {
        if (err2) {
            console.error('Lỗi:', err2.message);
        } else {
            if (companies.length === 0) {
                console.log('Chưa có công ty nào.');
            } else {
                companies.forEach(company => {
                    console.log(`${company.MaCongTy}. ${company.TenCongTy} (MST: ${company.MaSoThue})`);
                    console.log(`   Địa chỉ: ${company.DiaChi}`);
                    console.log(`   Người đại diện: User ID ${company.NguoiDaiDien}`);
                });
            }
        }
        db.close();
    });
});
