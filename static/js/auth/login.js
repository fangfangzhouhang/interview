/* 登录页交互：登录提交 + 密码显隐 + 使用须知模态框（非强锁，提示性）
 * 用户反馈修正：
 *   - 登录/注册随时可点（不再 disabled/locked）
 *   - 使用须知、创建报名账号链接可正常点击
 */
document.addEventListener('DOMContentLoaded', function() {
    // ========== DOM 引用 ==========
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnLabel = loginBtn.querySelector('.login-btn-label');
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.getElementById('passwordToggle');

    // 使用须知模态框
    const usageModal = document.getElementById('usageModal');
    const openUsageBtn = document.getElementById('openUsageBtn');
    const usageBody = document.getElementById('usageBody');
    const usageAgree = document.getElementById('usageAgree');
    const usageConfirmBtn = document.getElementById('usageConfirmBtn');
    const usageStatus = document.getElementById('usageStatus');
    const STORAGE_KEY = 'ecust_usage_agreed_v1';   // 记住 7 天

    // ========== 通用工具 ==========
    function setLoading(isLoading) {
        loginBtn.disabled = isLoading;
        loginBtn.classList.toggle('is-loading', isLoading);
        loginBtn.setAttribute('aria-busy', String(isLoading));
        loginBtnLabel.textContent = isLoading ? '正在登录' : '登录';
    }

    function showError(message) {
        errorMessage.textContent = message;
        if (message) errorMessage.classList.add('is-visible');
        else errorMessage.classList.remove('is-visible');
    }

    function setUsageStatus(text, isError) {
        usageStatus.textContent = text || '';
        usageStatus.classList.toggle('is-error', !!isError);
    }

    // ========== 密码显示/隐藏切换 ==========
    passwordToggle.addEventListener('click', function() {
        const isShowing = passwordInput.type === 'text';
        passwordInput.type = isShowing ? 'password' : 'text';
        passwordToggle.classList.toggle('is-showing', !isShowing);
        passwordToggle.setAttribute('aria-pressed', String(!isShowing));
        // title：显示当前眼睛图标对应的动作（与图标语义匹配）
        // 现在：密码隐藏→显示斜线眼睛→title提示"点击显示密码"
        //      密码显示→显示普通眼睛→title提示"点击隐藏密码"
        passwordToggle.setAttribute('title', !isShowing ? '隐藏密码' : '显示密码');
        passwordInput.focus({ preventScroll: true });
    });

    // ========== 使用须知：打开 ==========
    function openUsageModal() {
        if (!usageModal) return;
        usageModal.classList.add('is-open');
        usageModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';   // 防止背景滚动
        // 打开时重置滚动/勾选状态，确保每次打开都走"阅读流程"
        usageBody.scrollTop = 0;
        usageAgree.checked = false;
        usageAgree.disabled = true;
        usageConfirmBtn.disabled = true;
        setTimeout(function() { usageBody.focus(); }, 50);
    }

    // ========== 使用须知：关闭 ==========
    function closeUsageModal() {
        if (!usageModal) return;
        usageModal.classList.remove('is-open');
        usageModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    // 打开按钮
    if (openUsageBtn) {
        openUsageBtn.addEventListener('click', openUsageModal);
    }

    // 关闭触发：遮罩 / 右上角 × / ESC
    if (usageModal) {
        usageModal.addEventListener('click', function(e) {
            if (e.target.hasAttribute('data-close-usage')) closeUsageModal();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && usageModal.classList.contains('is-open')) {
                closeUsageModal();
            }
        });
    }

    // ========== 使用须知：滚动到底 → 解锁 checkbox → 解锁确认按钮 ==========
    if (usageBody && usageAgree && usageConfirmBtn) {
        usageBody.addEventListener('scroll', function() {
            const scrolledToBottom =
                usageBody.scrollTop + usageBody.clientHeight >= usageBody.scrollHeight - 4;
            if (scrolledToBottom) {
                usageAgree.disabled = false;
            }
        });

        usageAgree.addEventListener('change', function() {
            usageConfirmBtn.disabled = !usageAgree.checked;
        });

        // 点击"同意并开始使用" → 记住 7 天 → 关闭模态 → 绿色提示
        usageConfirmBtn.addEventListener('click', function() {
            if (!usageAgree.checked) return;
            try {
                const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
                localStorage.setItem(STORAGE_KEY, String(expiresAt));
            } catch (_) { /* 隐私模式下忽略 */ }
            setUsageStatus('✓ 已阅读《使用须知》，感谢配合');
            closeUsageModal();
        });
    }

    // 页面加载时：检查是否已经同意过（7 天内）
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && Number(saved) > Date.now()) {
            setUsageStatus('✓ 已阅读《使用须知》，感谢配合');
        }
    } catch (_) { /* ignore */ }

    // ========== 登录提交：取消"必须同意须知"的强校验，仅做友好提示 ==========
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!loginForm.checkValidity()) {
            const invalidField = loginForm.querySelector(':invalid');
            showError('请填写用户名和密码后再登录');
            if (invalidField) invalidField.focus();
            return;
        }

        // 友好提示：如果没阅读过须知，提示一下（但不阻止登录）
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            const hasAgreed = saved && Number(saved) > Date.now();
            if (!hasAgreed) {
                setUsageStatus('温馨提示：登录前建议先阅读《使用须知》', true);
                // 仅提示一次，3.5 秒后自动消掉
                setTimeout(function() {
                    if (usageStatus.classList.contains('is-error')) setUsageStatus('');
                }, 3500);
            }
        } catch (_) { /* ignore */ }

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
