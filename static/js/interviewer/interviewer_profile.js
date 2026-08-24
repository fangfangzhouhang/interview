document.addEventListener('DOMContentLoaded', function() {
    // DOM元素
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const profileForm = document.getElementById('profileForm');
    const resetBtn = document.getElementById('resetBtn');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');

    // 获取CSRF Token
    function getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]').value;
    }

    // 显示消息
    function showMessage(type, text) {
        if (type === 'success') {
            successMessage.textContent = text;
            successMessage.style.display = 'block';
            errorMessage.style.display = 'none';
            setTimeout(() => {
                successMessage.style.display = 'none';
            }, 3000);
        } else if (type === 'error') {
            errorMessage.textContent = text;
            errorMessage.style.display = 'block';
            successMessage.style.display = 'none';
        }
    }

    function hideMessages() {
        successMessage.style.display = 'none';
        errorMessage.style.display = 'none';
    }

    // 切换侧边栏
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
        });
    }

    // ========== 加载个人资料 ==========
    async function loadProfile() {
        try {
            // 使用正确的API路径
            const response = await fetch('/api/interviewer/profile/');
            const result = await response.json();

            //console.log('加载个人信息响应:', result); // 调试日志

            if (result.success) {
                const data = result.data;

                // 填充表单
                document.getElementById('username').value = data.username || '';
                document.getElementById('student_number').value = data.student_number || '';
                document.getElementById('name').value = data.name || '';
                document.getElementById('gender').value = data.gender || 'M';
                document.getElementById('political_status').value = data.political_status || '';
                document.getElementById('department').value = data.department || 'UNK';
                document.getElementById('homeroom').value = data.homeroom || '';
                document.getElementById('telephone').value = data.telephone || '';
            } else {
                showMessage('error', result.message || '加载个人信息失败');
                // 如果有调试信息，打印到控制台
                if (result.debug) {
                    console.error('调试信息:', result.debug);
                }
            }
        } catch (error) {
            console.error('加载个人信息失败:', error);
            showMessage('error', '加载个人信息失败，请刷新页面重试');
        }
    }

    // ========== 提交表单 ==========
    profileForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideMessages();

        // 验证必填字段
        const name = document.getElementById('name').value.trim();
        const political_status = document.getElementById('political_status').value.trim();
        const department = document.getElementById('department').value;
        const homeroom = document.getElementById('homeroom').value.trim();
        const telephone = document.getElementById('telephone').value.trim();

        if (!name) {
            showMessage('error', '请输入姓名');
            document.getElementById('name').focus();
            return;
        }
        if (!political_status) {
            showMessage('error', '请输入政治面貌');
            document.getElementById('political_status').focus();
            return;
        }
        if (!department || department === 'UNK') {
            showMessage('error', '请选择部门');
            document.getElementById('department').focus();
            return;
        }
        if (!homeroom) {
            showMessage('error', '请输入组别');
            document.getElementById('homeroom').focus();
            return;
        }
        if (!telephone) {
            showMessage('error', '请输入手机号');
            document.getElementById('telephone').focus();
            return;
        }

        const phonePattern = /^1[3-9]\d{9}$/;
        if (!phonePattern.test(telephone)) {
            showMessage('error', '请输入有效的手机号（11位，以13-19开头）');
            document.getElementById('telephone').focus();
            return;
        }

        // 构建提交数据
        const formData = {
            name: name,
            gender: document.getElementById('gender').value,
            political_status: political_status,
            department: department,
            homeroom: homeroom,
            telephone: telephone,
        };

        //e.log('提交数据:', formData); // 调试日志

        const submitBtn = document.querySelector('.save-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = '保存中...';

        try {
            // 使用正确的API路径
            const response = await fetch('/api/interviewer/profile/update/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCSRFToken(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            //console.log('保存响应:', result); // 调试日志

            if (result.success) {
                showMessage('success', '✅ 个人信息保存成功！');
                await loadProfile();
            } else {
                showMessage('error', result.message || '保存失败');
            }
        } catch (error) {
            console.error('保存个人信息失败:', error);
            showMessage('error', '保存失败，请检查网络连接后重试');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '保存修改';
        }
    });

    // 重置按钮（次要操作，无需确认弹窗）
    resetBtn.addEventListener('click', async function() {
        await loadProfile();
        hideMessages();
        if (window.Modal) {
            Modal.success('已重置为保存的数据');
        } else {
            showMessage('success', '已重置为保存的数据');
        }
    });

    // 页面加载时加载个人资料
    loadProfile();
});