document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = document.querySelector('.login-btn');

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        // 禁用按钮，防止重复提交
        loginBtn.disabled = true;
        loginBtn.textContent = '登录中...';
        errorMessage.textContent = '';

        const formData = new FormData(loginForm);
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

        try {
            const response = await fetch('/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                },
                body: formData
            });

            // 检查响应状态
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                // 获取重定向URL
                const redirectUrl = data.redirect_url; // || '/profile/';

                // 打印调试信息
                console.log('登录成功，跳转到:', redirectUrl);
                console.log('用户角色:', data.role);

                // 使用 window.location.href 进行跳转
                window.location.href = redirectUrl;
            } else {
                errorMessage.textContent = data.message || '登录失败，请检查用户名和密码';
                loginBtn.disabled = false;
                loginBtn.textContent = '登录';
            }
        } catch (error) {
            errorMessage.textContent = '登录失败，请检查网络连接后重试';
            console.error('Login error:', error);
            loginBtn.disabled = false;
            loginBtn.textContent = '登录';
        }
    });

    // 回车键提交表单
    document.querySelectorAll('#loginForm input').forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loginForm.dispatchEvent(new Event('submit'));
            }
        });
    });
});