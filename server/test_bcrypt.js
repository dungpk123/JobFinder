const bcrypt = require('bcryptjs');
const hash = "$2b$10$7DVrVJ4jqAyzs.sPd37dOubl/UPCqZ0lzwFG9Xg2r8qp1HDsRHEEy";
const password = "dung12345";

bcrypt.compare(password, hash, (err, result) => {
    if (err) throw err;
    console.log("So sánh mật khẩu:", result);
});
