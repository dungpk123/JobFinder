const db = require('./config/sqlite');

setTimeout(() => {
    db.all('SELECT MaNguoiDung, Email, HoTen, VaiTro FROM NguoiDung', (err, users) => {
        if (err) {
            console.error(err);
        } else {
            console.log('\n📋 DANH SÁCH TÀI KHOẢN:\n');
            users.forEach(u => {
                console.log(`${u.MaNguoiDung}. ${u.Email}`);
                console.log(`   ${u.HoTen} - ${u.VaiTro}\n`);
            });
        }
        process.exit(0);
    });
}, 1000);
