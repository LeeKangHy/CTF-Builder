const loginForm = document.getElementById("login-form");
const message = document.getElementById("login-message");

loginForm.addEventListener("submit", async (event) => {
    // Ngăn trình duyệt tải lại trang theo cách mặc định
    event.preventDefault();

    const username = loginForm.elements["username"].value;
    const password = loginForm.elements["password"].value;

    try {
        const response = await fetch("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        const result = await response.json();
        message.textContent = result.message;

        
        if (response.ok && result.success) {
            if (result.role === "admin") {
                window.location.href = "/admin";
            } else {
                window.location.href = "/user";
            }
        } else {
            message.textContent = result.message;
        }


    } catch (error) {
        message.textContent = "Cannot connect to server.";
        console.error(error);
    }
});



