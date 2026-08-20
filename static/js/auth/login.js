document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnLabel = loginBtn.querySelector('.login-btn-label');
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.getElementById('passwordToggle');

    function setLoading(isLoading) {
        loginBtn.disabled = isLoading;
        loginBtn.classList.toggle('is-loading', isLoading);
        loginBtn.setAttribute('aria-busy', String(isLoading));
        loginBtnLabel.textContent = isLoading ? '正在登录' : '登录';
    }

    function showError(message) {
        errorMessage.textContent = message;
    }

    passwordToggle.addEventListener('click', function() {
        const shouldShow = passwordInput.type === 'password';
        passwordInput.type = shouldShow ? 'text' : 'password';
        passwordToggle.textContent = shouldShow ? '隐藏' : '显示';
        passwordToggle.setAttribute('aria-pressed', String(shouldShow));
        passwordInput.focus({ preventScroll: true });
    });

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!loginForm.checkValidity()) {
            const invalidField = loginForm.querySelector(':invalid');
            showError('请填写用户名和密码后再登录');
            if (invalidField) invalidField.focus();
            return;
        }

        setLoading(true);
        showError('');

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

            const contentType = response.headers.get('content-type') || '';
            const data = contentType.includes('application/json')
                ? await response.json()
                : { success: false, message: '登录服务返回了异常页面，请稍后重试' };

            if (response.ok && data.success) {
                window.location.assign(data.redirect_url || '/');
            } else {
                showError(data.message || '登录失败，请检查用户名和密码');
                setLoading(false);
            }
        } catch (error) {
            showError('暂时无法连接登录服务，请检查网络后重试');
            console.error('Login error:', error);
            setLoading(false);
        }
    });
});
