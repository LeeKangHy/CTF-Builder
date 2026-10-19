const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const express = require("express");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);

// ================================ 
// 1. Kết nối database
// ================================
const db = new DatabaseSync(
    path.join(__dirname, "database.db")
);

console.log("Connected to SQLite!");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user'
    );
`);

// Tạo hai tài khoản mẫu nếu chưa tồn tại
const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (username, password, role)
    VALUES (?, ?, ?)
`);

insertUser.run("alice", "alice123", "user");
insertUser.run("admin", "admin123", "admin");


// ================================
// 2. Middleware
// ================================

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/register", (req, res) => {
    const { username, password } = req.body || {};

    // 1. Kiểm tra dữ liệu đầu vào
    if (
        typeof username !== "string" ||
        typeof password !== "string"
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid request."
        });
    }

    // 2. Kiểm tra dữ liệu rỗng
    if (
        username.trim() === "" ||
        password.length === 0
    ) {
        return res.status(400).json({
            success: false,
            message: "Username and password are required."
        });
    }

    // 3. Giới hạn độ dài cho bài lab
    if (
        username.length > 30 ||
        password.length > 100
    ) {
        return res.status(400).json({
            success: false,
            message: "Input is too long."
        });
    }

    try {
        // 4. Dùng prepared statement để thêm tài khoản
        const insertUser = db.prepare(`
            INSERT INTO users (username, password, role)
            VALUES (?, ?, 'user')
        `);

        insertUser.run(username.trim(), password);

        return res.status(201).json({
            success: true,
            message: "Registration successful!"
        });
    } catch (err) {
        // 5. Xử lý trường hợp username đã tồn tại
        if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(409).json({
                success: false,
                message: "Username already exists."
            });
        }

        console.error("Registration error:", err);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
});

// ================================
// 3. Quản lý session
// ================================

// Lưu session trong bộ nhớ server
const sessions = new Map();

const SESSION_DURATION = 60 * 60 * 1000; // 1 giờ

function getSession(req) {
const cookies = req.headers.cookie || "";

const sidCookie = cookies
    .split(";")
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith("sid="));

if (!sidCookie) {
    return null;
}

const sid = sidCookie.slice("sid=".length);
const session = sessions.get(sid);

if (!session) {
    return null;
}

// Kiểm tra session hết hạn
if (Date.now() >= session.expiresAt) {
    sessions.delete(sid);
    return null;
}

return session;

}



// Yêu cầu người dùng phải đăng nhập
function requireLogin(req, res, next) {
const session = getSession(req);

if (!session) {
    return res.redirect("/");
}

req.sessionUser = session;
next();

}

// Chỉ cho phép admin
function requireAdmin(req, res, next) {
const session = getSession(req);

if (!session) {
    return res.redirect("/");
}

if (session.role !== "admin") {
    return res.status(403).send("403 Forbidden: Admin only");
}

req.sessionUser = session;
next();

}

// ================================
// 4. Đăng nhập
// ================================

app.post("/login", (req, res) => {
const { username, password } = req.body || {};

// Kiểm tra dữ liệu đầu vào
if (
    typeof username !== "string" ||
    typeof password !== "string"
) {
    return res.status(400).json({
        success: false,
        message: "Invalid request."
    });
}

// CỐ Ý TẠO LỖ HỔNG SQL INJECTION
// Chỉ sử dụng trong challenge CTF chạy local.                                                       
                                                                                                             // BUG
const query = `
    SELECT id, username, role
    FROM users
    WHERE username = '${username}' 
        AND password = '${password}'
`;
                                                                                                                // 
console.log("SQL query:", query);

let user;

try {
    user = db.prepare(query).get();
} catch (err) {
    // Giữ lab hoạt động khi người học thử payload sai cú pháp SQL.
    console.error("Login query error:", err.message);

    return res.status(400).json({
        success: false,
        message: "Invalid login input."
    });
}

if (!user) {
    return res.status(401).json({
        success: false,
        message: "Invalid username or password."
    });
}

// Tạo mã session ngẫu nhiên
const sid = crypto.randomBytes(32).toString("hex");

// Lưu thông tin người dùng ở phía server
sessions.set(sid, {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: Date.now() + SESSION_DURATION
});

// Gửi session ID về trình duyệt bằng cookie
res.setHeader(
    "Set-Cookie",
    `sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`
);

return res.json({
    success: true,
    message: "Login successful!",
    role: user.role
});

});




// ================================
// 5. Trang User
// ================================

app.get("/user", requireLogin, (req, res) => {
res.sendFile(
path.join(__dirname, "private", "user.html")
);
});

// ================================
// 6. Trang Admin
// ================================

app.get("/admin", requireAdmin, (req, res) => {
res.sendFile(
path.join(__dirname, "private", "admin.html")
);
});

// ================================
// 7. Đăng xuất
// ================================

app.post("/logout", (req, res) => {
const cookies = req.headers.cookie || "";

const sidCookie = cookies
    .split(";")
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith("sid="));

if (sidCookie) {
    const sid = sidCookie.slice("sid=".length);
    sessions.delete(sid);
}

// Xóa cookie trong trình duyệt
res.setHeader(
    "Set-Cookie",
    "sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"
);

return res.json({ success: true });

});


// ================================
// 8. Khởi động server
// ================================

app.listen(PORT, "127.0.0.1", () => {
    console.log(`Server running at http://127.0.0.1:${PORT}`);
});

