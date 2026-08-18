document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('registerForm');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const registerBtn = document.querySelector('.register-btn');
    const roleModal = document.getElementById('roleModal');
    const roleInput = document.getElementById('roleInput');
    const currentRoleDisplay = document.getElementById('currentRoleDisplay');
    const changeRoleBtn = document.getElementById('changeRoleBtn');

    // 表单字段
    const candidateSchoolRow = document.getElementById('candidateSchoolRow');
    const interviewerDepartmentRow = document.getElementById('interviewerDepartmentRow');
    const homeroomLabel = document.getElementById('homeroomLabel');
    const homeroomHint = document.getElementById('homeroomHint');
    const schoolSelect = document.getElementById('school');
    const departmentSelect = document.getElementById('department');
    const homeroomInput = document.getElementById('homeroom');

    let selectedRole = null;

    // 获取CSRF Token
    function getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]').value;
    }

    // 显示错误信息
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 显示成功信息
    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
        successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 清除消息
    function clearMessages() {
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
    }

    // 重置表单验证状态
    function resetFormValidation() {
        const inputs = registerForm.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.style.borderColor = '';
            input.setCustomValidity('');
        });
    }

    // 切换表单字段根据角色
    function switchFormFields(role) {
        if (role === 'candidate') {
            // 面试者模式
            candidateSchoolRow.style.display = 'flex';
            interviewerDepartmentRow.style.display = 'none';

            // 设置必填属性
            schoolSelect.required = true;
            departmentSelect.required = false;

            // 启用/禁用
            schoolSelect.disabled = false;
            departmentSelect.disabled = true;

            // 重置值
            if (departmentSelect.value === 'UNK') {
                departmentSelect.value = 'UNK';
            }

            homeroomLabel.textContent = '班级 *';
            homeroomHint.textContent = '面试者请填写班级';
            homeroomInput.placeholder = '请输入班级';

            currentRoleDisplay.textContent = '面试者';
            currentRoleDisplay.className = 'role-tag role-candidate';

        } else if (role === 'interviewer') {
            // 工作人员模式
            candidateSchoolRow.style.display = 'none';
            interviewerDepartmentRow.style.display = 'flex';

            // 设置必填属性
            schoolSelect.required = false;
            departmentSelect.required = true;

            // 启用/禁用
            schoolSelect.disabled = true;
            departmentSelect.disabled = false;

            // 重置值
            if (schoolSelect.value === 'UN') {
                schoolSelect.value = 'UN';
            }

            homeroomLabel.textContent = '组别 *';
            homeroomHint.textContent = '例：行政组、执行组等';
            homeroomInput.placeholder = '请输入组别';

            currentRoleDisplay.textContent = '工作人员';
            currentRoleDisplay.className = 'role-tag role-interviewer';
        }
    }

    // ========== 角色选择按钮事件 ==========
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const role = this.dataset.role;
            selectedRole = role;
            roleInput.value = role;

            roleModal.style.display = 'none';
            registerForm.style.display = 'block';

            switchFormFields(role);

            clearMessages();
            resetFormValidation();
        });
    });

    // ========== 切换身份按钮 ==========
    changeRoleBtn.addEventListener('click', function() {
        if (!confirm('切换身份将清空已填写的表单数据，确定要继续吗？')) {
            return;
        }

        registerForm.reset();
        clearMessages();
        resetFormValidation();

        registerForm.style.display = 'none';
        roleModal.style.display = 'flex';

        selectedRole = null;
        roleInput.value = '';
        currentRoleDisplay.textContent = '未选择';
        currentRoleDisplay.className = 'role-tag';

        // 重置为面试者默认（但需要重置所有字段的disabled状态）
        candidateSchoolRow.style.display = 'flex';
        interviewerDepartmentRow.style.display = 'none';

        schoolSelect.required = true;
        departmentSelect.required = false;
        schoolSelect.disabled = false;
        departmentSelect.disabled = true;

        // 重置选择框的值
        schoolSelect.value = 'UN';
        departmentSelect.value = 'UNK';

        homeroomLabel.textContent = '班级 *';
        homeroomHint.textContent = '面试者请填写班级';
        homeroomInput.placeholder = '请输入班级';

        // 重置所有输入框的边框颜色
        document.querySelectorAll('input, select').forEach(el => {
            el.style.borderColor = '';
        });
    });

    // ========== 实时验证 ==========

    // 学号验证
    document.getElementById('student_number').addEventListener('input', function() {
        const value = this.value;
        const pattern = /^2[0-6]\d{6}$/;
        if (value.length > 0 && value.length < 8) {
            this.setCustomValidity('学号必须为8位数字');
        } else if (value.length === 8 && !pattern.test(value)) {
            this.setCustomValidity('学号格式不正确，应为2开头的8位数字');
        } else {
            this.setCustomValidity('');
        }
    });

    // 手机号验证
    document.getElementById('telephone').addEventListener('input', function() {
        const value = this.value;
        const pattern = /^1[3-9]\d{9}$/;
        if (value.length > 0 && value.length < 11) {
            this.setCustomValidity('手机号必须为11位数字');
        } else if (value.length === 11 && !pattern.test(value)) {
            this.setCustomValidity('手机号格式不正确，应为11位数字且以13-19开头');
        } else {
            this.setCustomValidity('');
        }
    });

    // 密码匹配验证
    document.getElementById('confirm_password').addEventListener('input', function() {
        const password = document.getElementById('password').value;
        if (this.value && this.value !== password) {
            this.setCustomValidity('两次输入的密码不一致');
        } else {
            this.setCustomValidity('');
        }
    });

    // 密码强度提示
    document.getElementById('password').addEventListener('input', function() {
        const value = this.value;
        const hint = this.parentElement.querySelector('.hint');
        const passwordRegex = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};:'",.<>/?`~]+$/;

        if (value.length === 0) {
            hint.style.color = '#a0aec0';
            hint.textContent = '至少8位字符';
            return;
        }

        if (value.length < 8) {
            hint.style.color = '#e53e3e';
            hint.textContent = '❌ 密码至少需要8位字符';
        } else if (value.length >= 8) {
            if (!passwordRegex.test(value)) {
                hint.style.color = '#e53e3e';
                hint.textContent = '❌ 密码只能包含英文、数字和符号';
            } else {
                hint.style.color = '#48bb78';
                hint.textContent = '✓ 密码强度符合要求';
            }
        }
    });

    // ========== 获取表单数据（辅助函数） ==========
    function getFormData() {
        const formData = new FormData(registerForm);
        const data = {};
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        return data;
    }

    // ========== 表单提交 ==========
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        clearMessages();

        if (!selectedRole) {
            showError('请先选择注册身份');
            return;
        }

        // 使用 FormData 获取所有表单数据
        const formData = new FormData(registerForm);

        // 验证密码
        const password = formData.get('password');
        const confirmPassword = formData.get('confirm_password');

        if (!password || !confirmPassword) {
            showError('请完整填写密码信息');
            return;
        }

        if (password !== confirmPassword) {
            showError('两次输入的密码不一致');
            document.getElementById('confirm_password').focus();
            return;
        }

        if (password.length < 8) {
            showError('密码长度至少为8位');
            document.getElementById('password').focus();
            return;
        }

        const passwordRegex = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};:'",.<>/?`~]+$/;
        if (!passwordRegex.test(password)) {
            showError('密码只能包含英文、数字和符号');
            document.getElementById('password').focus();
            return;
        }

        // 验证基本必填字段
        const name = formData.get('name');
        const gender = formData.get('gender');
        const politicalStatus = formData.get('political_status');
        const studentNumber = formData.get('student_number');
        const telephone = formData.get('telephone');
        const homeroom = formData.get('homeroom');

        if (!name || !name.trim()) {
            showError('请输入姓名');
            document.getElementById('name').focus();
            return;
        }

        if (!gender) {
            showError('请选择性别');
            document.getElementById('gender').focus();
            return;
        }

        if (!politicalStatus || !politicalStatus.trim()) {
            showError('请输入政治面貌');
            document.getElementById('political_status').focus();
            return;
        }

        if (!studentNumber || !studentNumber.trim()) {
            showError('请输入学号');
            document.getElementById('student_number').focus();
            return;
        }

        // 学号格式验证
        const studentPattern = /^2[0-6]\d{6}$/;
        if (!studentPattern.test(studentNumber)) {
            showError('学号格式不正确，应为2开头的8位数字');
            document.getElementById('student_number').focus();
            return;
        }

        if (!telephone || !telephone.trim()) {
            showError('请输入手机号');
            document.getElementById('telephone').focus();
            return;
        }

        // 手机号格式验证
        const phonePattern = /^1[3-9]\d{9}$/;
        if (!phonePattern.test(telephone)) {
            showError('手机号格式不正确，应为11位数字且以13-19开头');
            document.getElementById('telephone').focus();
            return;
        }

        if (!homeroom || !homeroom.trim()) {
            const label = selectedRole === 'candidate' ? '班级' : '组别';
            showError(`请输入${label}`);
            document.getElementById('homeroom').focus();
            return;
        }

        // 根据角色验证额外字段
        if (selectedRole === 'candidate') {
            const school = formData.get('school');
            if (!school || school === 'UN') {
                showError('请选择学院');
                schoolSelect.focus();
                return;
            }
        } else if (selectedRole === 'interviewer') {
            const department = formData.get('department');
            if (!department || department === 'UNK') {
                showError('请选择部门');
                departmentSelect.focus();
                return;
            }
        }

        // 禁用按钮防止重复提交
        registerBtn.disabled = true;
        registerBtn.textContent = '注册中...';

        try {
            const response = await fetch('/register/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCSRFToken(),
                },
                body: formData
            });

            // 检查响应是否成功
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                const roleText = data.role === 'interviewer' ? '工作人员' : '面试者';
                showSuccess(`🎉 ${roleText}注册成功！即将跳转到登录页面...`);

                // 重新启用按钮（虽然即将跳转，但为了安全）
                registerBtn.disabled = false;
                registerBtn.textContent = '注册';

                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            } else {
                showError(data.message || '注册失败，请检查输入信息');
                registerBtn.disabled = false;
                registerBtn.textContent = '注册';
            }
        } catch (error) {
            console.error('注册请求失败:', error);
            showError('注册失败，请检查网络连接后重试');
            registerBtn.disabled = false;
            registerBtn.textContent = '注册';
        }
    });

    // ========== 表单字段失去焦点验证 ==========
    const inputs = registerForm.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            // 跳过隐藏的或禁用的字段
            if (this.disabled || this.type === 'hidden') {
                return;
            }

            if (this.hasAttribute('required') && !this.value) {
                this.style.borderColor = '#e53e3e';
            } else if (this.type === 'text' && this.value && this.hasAttribute('pattern')) {
                const pattern = new RegExp(this.getAttribute('pattern'));
                if (!pattern.test(this.value)) {
                    this.style.borderColor = '#e53e3e';
                } else {
                    this.style.borderColor = '#68d391';
                }
            } else if (this.type === 'tel' && this.value && this.hasAttribute('pattern')) {
                const pattern = new RegExp(this.getAttribute('pattern'));
                if (!pattern.test(this.value)) {
                    this.style.borderColor = '#e53e3e';
                } else {
                    this.style.borderColor = '#68d391';
                }
            } else if (this.value) {
                this.style.borderColor = '#68d391';
            } else {
                this.style.borderColor = '';
            }
        });

        input.addEventListener('focus', function() {
            this.style.borderColor = '#667eea';
        });
    });
});