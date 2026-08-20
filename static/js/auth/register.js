document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('registerForm');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const registerBtn = document.getElementById('registerBtn');
    const registerBtnLabel = registerBtn.querySelector('.register-btn-label');
    const roleModal = document.getElementById('roleModal');
    const roleInput = document.getElementById('roleInput');
    const currentRoleDisplay = document.getElementById('currentRoleDisplay');
    const changeRoleBtn = document.getElementById('changeRoleBtn');
    const prevStepBtn = document.getElementById('prevStepBtn');
    const nextStepBtn = document.getElementById('nextStepBtn');
    const stepPosition = document.getElementById('stepPosition');
    const registerSummary = document.getElementById('registerSummary');
    const confirmSubmission = document.getElementById('confirmSubmission');
    const formSteps = Array.from(document.querySelectorAll('.form-step'));
    const stepIndicators = Array.from(document.querySelectorAll('[data-step-indicator]'));

    const candidateSchoolRow = document.getElementById('candidateSchoolRow');
    const interviewerDepartmentRow = document.getElementById('interviewerDepartmentRow');
    const homeroomLabel = document.getElementById('homeroomLabel');
    const homeroomHint = document.getElementById('homeroomHint');
    const schoolSelect = document.getElementById('school');
    const departmentSelect = document.getElementById('department');
    const homeroomInput = document.getElementById('homeroom');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm_password');
    const studentNumberInput = document.getElementById('student_number');
    const telephoneInput = document.getElementById('telephone');

    const totalSteps = 4;
    let selectedRole = null;
    let currentStep = 1;

    function getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]').value;
    }

    function clearMessages() {
        errorMessage.textContent = '';
        successMessage.textContent = '';
    }

    function showError(message) {
        errorMessage.textContent = message;
        successMessage.textContent = '';
    }

    function showSuccess(message) {
        successMessage.textContent = message;
        errorMessage.textContent = '';
    }

    function setSubmitting(isSubmitting) {
        registerBtn.disabled = isSubmitting;
        registerBtn.classList.toggle('is-loading', isSubmitting);
        registerBtn.setAttribute('aria-busy', String(isSubmitting));
        registerBtnLabel.textContent = isSubmitting ? '正在创建账号' : '确认注册';
    }

    function setFieldState(field) {
        if (field.disabled || field.type === 'hidden') return true;
        const isValid = field.checkValidity();
        field.classList.toggle('is-valid', isValid && Boolean(field.value));
        field.classList.toggle('is-invalid', !isValid);
        return isValid;
    }

    function resetFormValidation() {
        registerForm.querySelectorAll('input, select').forEach(field => {
            field.classList.remove('is-valid', 'is-invalid');
            field.setCustomValidity('');
        });
    }

    function switchFormFields(role) {
        const isCandidate = role === 'candidate';
        candidateSchoolRow.style.display = isCandidate ? 'grid' : 'none';
        interviewerDepartmentRow.style.display = isCandidate ? 'none' : 'grid';

        schoolSelect.required = isCandidate;
        schoolSelect.disabled = !isCandidate;
        departmentSelect.required = !isCandidate;
        departmentSelect.disabled = isCandidate;

        homeroomLabel.textContent = isCandidate ? '班级 *' : '组别 *';
        homeroomHint.textContent = isCandidate ? '例：数学类2601班' : '例：行政组、执行组等';
        homeroomInput.placeholder = isCandidate ? '请输入班级' : '请输入组别';

        currentRoleDisplay.textContent = isCandidate ? '面试者' : '工作人员';
        currentRoleDisplay.className = `role-tag ${isCandidate ? 'role-candidate' : 'role-interviewer'}`;
    }

    function renderSummary() {
        const genderText = document.getElementById('gender').selectedOptions[0]?.textContent || '未填写';
        const scopeSelect = selectedRole === 'candidate' ? schoolSelect : departmentSelect;
        const scopeLabel = selectedRole === 'candidate' ? '学院' : '部门';
        const roomLabel = selectedRole === 'candidate' ? '班级' : '组别';
        const values = [
            ['注册身份', selectedRole === 'candidate' ? '面试者' : '工作人员'],
            ['用户名', document.getElementById('username').value || '未填写'],
            ['姓名', document.getElementById('name').value || '未填写'],
            ['性别', genderText],
            ['学号', studentNumberInput.value || '未填写'],
            [scopeLabel, scopeSelect.selectedOptions[0]?.textContent || '未填写'],
            [roomLabel, homeroomInput.value || '未填写'],
            ['手机号', telephoneInput.value || '未填写']
        ];

        registerSummary.replaceChildren();
        values.forEach(([label, value]) => {
            const item = document.createElement('div');
            item.className = 'summary-item';
            const itemLabel = document.createElement('span');
            itemLabel.textContent = label;
            const itemValue = document.createElement('strong');
            itemValue.textContent = value;
            item.append(itemLabel, itemValue);
            registerSummary.appendChild(item);
        });
    }

    function showStep(step, shouldFocus = true) {
        currentStep = Math.max(1, Math.min(totalSteps, step));
        formSteps.forEach(section => {
            const isActive = Number(section.dataset.step) === currentStep;
            section.hidden = !isActive;
            section.classList.toggle('active', isActive);
        });

        stepIndicators.forEach(indicator => {
            const stepNumber = Number(indicator.dataset.stepIndicator);
            indicator.classList.toggle('active', stepNumber === currentStep);
            indicator.classList.toggle('completed', stepNumber < currentStep);
            if (stepNumber === currentStep) indicator.setAttribute('aria-current', 'step');
            else indicator.removeAttribute('aria-current');
        });

        prevStepBtn.hidden = currentStep === 1;
        nextStepBtn.hidden = currentStep === totalSteps;
        registerBtn.hidden = currentStep !== totalSteps;
        stepPosition.textContent = `第 ${currentStep} 步，共 ${totalSteps} 步`;
        clearMessages();

        if (currentStep === totalSteps) renderSummary();

        if (shouldFocus) {
            const heading = document.getElementById(`stepTitle${currentStep}`);
            heading.setAttribute('tabindex', '-1');
            heading.focus({ preventScroll: true });
            registerForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function focusInvalid(field, message) {
        field.classList.add('is-invalid');
        showError(message || field.validationMessage || '请检查当前步骤的必填信息');
        field.focus();
        return false;
    }

    function validateStep(step) {
        clearMessages();
        const section = formSteps.find(item => Number(item.dataset.step) === step);
        const fields = Array.from(section.querySelectorAll('input, select')).filter(field => !field.disabled);

        if (step === 1) {
            const passwordRegex = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};:'",.<>/?`~]+$/;
            if (passwordInput.value.length < 8) {
                passwordInput.setCustomValidity('密码至少需要8位字符');
            } else if (!passwordRegex.test(passwordInput.value)) {
                passwordInput.setCustomValidity('密码只能包含英文、数字和符号');
            } else {
                passwordInput.setCustomValidity('');
            }
            confirmPasswordInput.setCustomValidity(
                confirmPasswordInput.value !== passwordInput.value ? '两次输入的密码不一致' : ''
            );
        }

        if (step === 3) {
            if (selectedRole === 'candidate' && schoolSelect.value === 'UN') {
                return focusInvalid(schoolSelect, '请选择学院');
            }
            if (selectedRole === 'interviewer' && departmentSelect.value === 'UNK') {
                return focusInvalid(departmentSelect, '请选择部门');
            }
        }

        for (const field of fields) {
            if (!setFieldState(field)) return focusInvalid(field);
        }
        return true;
    }

    function validateAllSteps() {
        for (let step = 1; step <= 3; step += 1) {
            showStep(step, false);
            if (!validateStep(step)) return false;
        }
        showStep(4, false);
        return true;
    }

    document.querySelectorAll('.role-btn').forEach(button => {
        button.addEventListener('click', function() {
            selectedRole = this.dataset.role;
            roleInput.value = selectedRole;
            roleModal.style.display = 'none';
            registerForm.style.display = 'block';
            switchFormFields(selectedRole);
            resetFormValidation();
            showStep(1, false);
            document.getElementById('username').focus();
        });
    });

    changeRoleBtn.addEventListener('click', function() {
        const shouldSwitch = window.confirm('切换身份会调整学院、部门和班级/组别字段，其他已填内容会保留。是否继续？');
        if (!shouldSwitch) return;
        roleModal.style.display = 'flex';
        registerForm.style.display = 'none';
        confirmSubmission.checked = false;
        clearMessages();
    });

    nextStepBtn.addEventListener('click', function() {
        if (validateStep(currentStep)) showStep(currentStep + 1);
    });

    prevStepBtn.addEventListener('click', function() {
        showStep(currentStep - 1);
    });

    studentNumberInput.addEventListener('input', function() {
        const isValid = /^2[0-6]\d{6}$/.test(this.value);
        this.setCustomValidity(this.value && !isValid ? '学号应为2开头的8位数字' : '');
    });

    telephoneInput.addEventListener('input', function() {
        const isValid = /^1[3-9]\d{9}$/.test(this.value);
        this.setCustomValidity(this.value && !isValid ? '请输入有效的11位手机号' : '');
    });

    confirmPasswordInput.addEventListener('input', function() {
        this.setCustomValidity(this.value !== passwordInput.value ? '两次输入的密码不一致' : '');
    });

    passwordInput.addEventListener('input', function() {
        const hint = this.parentElement.querySelector('.hint');
        hint.classList.remove('is-error', 'is-success');
        if (!this.value) {
            hint.textContent = '至少8位字符';
        } else if (this.value.length < 8) {
            hint.textContent = '密码至少需要8位字符';
            hint.classList.add('is-error');
        } else {
            hint.textContent = '密码长度符合要求';
            hint.classList.add('is-success');
        }
        if (confirmPasswordInput.value) {
            confirmPasswordInput.setCustomValidity(
                confirmPasswordInput.value !== this.value ? '两次输入的密码不一致' : ''
            );
        }
    });

    registerForm.querySelectorAll('input, select').forEach(field => {
        field.addEventListener('blur', function() {
            setFieldState(this);
        });
        field.addEventListener('input', function() {
            this.classList.remove('is-invalid');
            clearMessages();
        });
        field.addEventListener('change', function() {
            this.classList.remove('is-invalid');
            clearMessages();
        });
    });

    registerForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        clearMessages();

        if (!selectedRole) {
            showError('请先选择注册身份');
            return;
        }

        if (!validateAllSteps()) return;

        if (!confirmSubmission.checked) {
            showError('请先确认已核对报名信息');
            confirmSubmission.focus();
            return;
        }

        setSubmitting(true);
        const formData = new FormData(registerForm);

        try {
            const response = await fetch('/register/', {
                method: 'POST',
                headers: { 'X-CSRFToken': getCSRFToken() },
                body: formData
            });

            const contentType = response.headers.get('content-type') || '';
            const data = contentType.includes('application/json')
                ? await response.json()
                : { success: false, message: '注册服务返回了异常页面，请稍后重试' };

            if (response.ok && data.success) {
                showSuccess('账号创建成功，正在返回登录页……');
                setTimeout(() => window.location.assign('/'), 1400);
            } else {
                showError(data.message || '注册失败，请检查填写内容');
                setSubmitting(false);
            }
        } catch (error) {
            console.error('Register error:', error);
            showError('暂时无法连接注册服务，请检查网络后重试');
            setSubmitting(false);
        }
    });
});
