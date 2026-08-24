// profile.js - 个人简历 Step Form
document.addEventListener('DOMContentLoaded', function() {
    const TOTAL_STEPS = 4;
    let currentStep = 1;
    const formData = {};
    let canEdit = true;
    let currentAvatarUrl = null;
    let avatarFile = null;

    const $ = (id) => document.getElementById(id);
    const profileForm = $('profileForm');
    const errorMessage = $('errorMessage');
    const stepFill = $('stepFill');
    const stepIndicatorText = $('stepIndicatorText');
    const prevBtn = $('prevStepBtn');
    const nextBtn = $('nextStepBtn');
    const submitBtn = $('submitBtn');

    function getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]').value;
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.style.display = 'block';
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => { errorMessage.style.display = 'none'; }, 5000);
    }

    function hideError() {
        errorMessage.style.display = 'none';
    }

    // 侧边栏切换
    $('toggleSidebar').addEventListener('click', function() {
        $('sidebar').classList.toggle('collapsed');
    });

    // 步骤切换
    function goToStep(step) {
        if (step < 1 || step > TOTAL_STEPS) return;
        currentStep = step;

        document.querySelectorAll('.step-indicator').forEach(el => {
            const s = parseInt(el.dataset.step);
            el.classList.toggle('active', s === step);
            el.classList.toggle('completed', s < step);
        });

        document.querySelectorAll('.step-panel').forEach(el => {
            el.classList.toggle('active', parseInt(el.dataset.stepPanel) === step);
        });

        const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;
        stepFill.style.width = progress + '%';
        stepIndicatorText.textContent = `第 ${step} 步 / 共 ${TOTAL_STEPS} 步`;

        prevBtn.disabled = step === 1;

        if (step === TOTAL_STEPS) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'flex';
            submitBtn.disabled = false;
            buildReviewCards();
        } else {
            nextBtn.style.display = 'flex';
            submitBtn.style.display = 'none';
        }

        hideError();
    }

    // 收集当前步骤数据
    function collectStepData(step) {
        const data = {};
        const fields = {
            1: ['name', 'gender', 'political_status', 'student_number'],
            2: ['school', 'homeroom', 'telephone', 'username', 'qq_id', 'wx_id', 'email'],
            3: ['character', 'introduction', 'experience', 'honor'],
        };
        const stepFields = fields[step] || [];
        stepFields.forEach(id => {
            const el = $(id);
            if (el) data[id] = el.value.trim();
        });
        return data;
    }

    // 校验当前步骤
    function validateStep(step) {
        const errors = [];

        if (step === 1) {
            if (!currentAvatarUrl && !avatarFile) {
                errors.push('请上传证件照');
                $('avatarError').style.display = 'flex';
            } else {
                $('avatarError').style.display = 'none';
            }
            if (!$('name').value.trim()) errors.push('请输入姓名');
            if (!$('political_status').value.trim()) errors.push('请输入政治面貌');
        }

        if (step === 2) {
            if ($('school').value === 'UN') errors.push('请选择学院');
            if (!$('homeroom').value.trim()) errors.push('请输入班级');
            const tel = $('telephone').value.trim();
            if (!tel) errors.push('请输入手机号');
            else if (!/^1[3-9]\d{9}$/.test(tel)) errors.push('请输入有效的11位手机号');
        }

        if (errors.length > 0) {
            showError(errors.map((e, i) => `${i + 1}. ${e}`).join(' | '));
            return false;
        }
        return true;
    }

    // 下一步
    nextBtn.addEventListener('click', function() {
        hideError();
        if (!validateStep(currentStep)) return;
        Object.assign(formData, collectStepData(currentStep));
        goToStep(currentStep + 1);
    });

    // 上一步
    prevBtn.addEventListener('click', function() {
        hideError();
        goToStep(currentStep - 1);
    });

    // 字数统计
    function setupWordCounter(textareaId, maxLen, countId) {
        const ta = $(textareaId);
        const count = $(countId);
        if (!ta) return;
        ta.addEventListener('input', function() {
            const remain = maxLen - this.value.length;
            if (remain < 0) this.value = this.value.substring(0, maxLen);
            count.textContent = `剩余 ${Math.max(0, remain)} 字`;
            count.style.color = remain < 50 ? 'var(--resume-danger)' : 'var(--resume-text-muted)';
        });
    }
    setupWordCounter('character', 500, 'characterCount');
    setupWordCounter('introduction', 150, 'introductionCount');
    setupWordCounter('experience', 500, 'experienceCount');
    setupWordCounter('honor', 500, 'honorCount');

    // 证件照上传
    const avatarInput = $('avatarInput');
    const avatarImage = $('avatarImage');
    const avatarPlaceholder = $('avatarPlaceholder');
    const avatarPreview = $('avatarPreview');
    const removeAvatarBtn = $('removeAvatarBtn');
    const uploadAvatarBtn = $('uploadAvatarBtn');

    function updateAvatarDisplay() {
        if (currentAvatarUrl) {
            avatarImage.src = currentAvatarUrl;
            avatarImage.style.display = 'block';
            avatarImage.classList.add('visible', 'loaded');
            avatarPreview.classList.add('has-image');
            avatarPlaceholder.style.display = 'none';
            removeAvatarBtn.style.display = 'inline-block';
            uploadAvatarBtn.textContent = '重新选择';
        } else {
            avatarImage.style.display = 'none';
            avatarPreview.classList.remove('has-image');
            avatarPlaceholder.style.display = 'block';
            if (avatarFile) {
                removeAvatarBtn.style.display = 'inline-block';
                uploadAvatarBtn.textContent = '重新选择';
            } else {
                removeAvatarBtn.style.display = 'none';
                uploadAvatarBtn.textContent = '选择文件';
            }
        }
    }

    avatarPreview.addEventListener('click', function() {
        if (!canEdit) return;
        avatarInput.click();
    });

    uploadAvatarBtn.addEventListener('click', function() {
        if (!canEdit) return;
        avatarInput.click();
    });

    avatarInput.addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            showError('仅支持 jpeg/jpg/png 格式的图片');
            this.value = '';
            return;
        }
        if (file.size > 3 * 1024 * 1024) {
            showError('图片大小不能超过 3MB');
            this.value = '';
            return;
        }
        avatarFile = file;
        const reader = new FileReader();
        reader.onload = function(e) {
            currentAvatarUrl = e.target.result;
            updateAvatarDisplay();
            hideError();
        };
        reader.readAsDataURL(file);
    });

    removeAvatarBtn.addEventListener('click', async function() {
        if (!(await Modal.confirm('确定要移除证件照吗？'))) return;
        currentAvatarUrl = null;
        avatarFile = null;
        avatarInput.value = '';
        updateAvatarDisplay();
    });

    // 构建确认预览
    function buildReviewCards() {
        const cards = $('reviewCards');
        const g = (v) => (v && v.trim()) ? v : '<span class="review-item-value empty">未填写</span>';

        const schoolMap = {
            'HG': '化工学院', 'HF': '化学与分子工程学院', 'SG': '生物工程学院',
            'YX': '药学院', 'CL': '材料科学与工程学院', 'XX': '信息科学与工程学院',
            'JX': '机械与动力工程学院', 'ZH': '资源与环境工程学院', 'SY': '数学学院',
            'WL': '物理学院', 'SX': '商学院', 'SH': '社会与公共管理学院',
            'YS': '艺术设计与传媒学院', 'WG': '外国语学院', 'FX': '法学院',
            'TY': '体育科学与工程学院', 'GZ': '国际卓越工程师学院'
        };

        const genderMap = { 'M': '男', 'F': '女' };

        const avatarHtml = currentAvatarUrl
            ? `<div class="review-avatar"><img src="${currentAvatarUrl}" alt="证件照"></div>`
            : '<div class="review-item-value empty">未上传</div>';

        cards.innerHTML = `
            <div class="review-group">
                <div class="review-group-title">📷 基础信息</div>
                <div class="review-grid">
                    <div class="review-item"><span class="review-item-label">证件照</span>${avatarHtml}</div>
                    <div class="review-item"><span class="review-item-label">姓名</span>${g($('name').value)}</div>
                    <div class="review-item"><span class="review-item-label">性别</span>${g(genderMap[$('gender').value])}</div>
                    <div class="review-item"><span class="review-item-label">政治面貌</span>${g($('political_status').value)}</div>
                    <div class="review-item"><span class="review-item-label">学号</span>${g($('student_number').value)}</div>
                </div>
            </div>
            <div class="review-group">
                <div class="review-group-title">🎓 学业与联系</div>
                <div class="review-grid">
                    <div class="review-item"><span class="review-item-label">学院</span>${g(schoolMap[$('school').value] || '')}</div>
                    <div class="review-item"><span class="review-item-label">班级</span>${g($('homeroom').value)}</div>
                    <div class="review-item"><span class="review-item-label">手机号</span>${g($('telephone').value)}</div>
                    <div class="review-item"><span class="review-item-label">QQ号</span>${g($('qq_id').value)}</div>
                    <div class="review-item"><span class="review-item-label">微信号</span>${g($('wx_id').value)}</div>
                    <div class="review-item"><span class="review-item-label">电子邮箱</span>${g($('email').value)}</div>
                </div>
            </div>
            <div class="review-group">
                <div class="review-group-title">✍️ 经历与能力</div>
                <div class="review-grid">
                    <div class="review-item" style="grid-column: 1/-1;"><span class="review-item-label">兴趣爱好及特长</span>${g($('character').value)}</div>
                    <div class="review-item" style="grid-column: 1/-1;"><span class="review-item-label">自我介绍</span>${g($('introduction').value)}</div>
                    <div class="review-item" style="grid-column: 1/-1;"><span class="review-item-label">学生工作经历</span>${g($('experience').value)}</div>
                    <div class="review-item" style="grid-column: 1/-1;"><span class="review-item-label">所获荣誉</span>${g($('honor').value)}</div>
                </div>
            </div>
            <div style="margin-top: 12px; padding: 12px 16px; background: #FEF3C7; border-radius: 8px; font-size: 13px; color: #92400E;">
                💡 志愿部门请前往「<a href="/volunteer/" style="color:#2563EB;font-weight:600;text-decoration:underline;">志愿管理</a>」页面单独设置
            </div>
        `;
    }

    // 提交
    submitBtn.addEventListener('click', async function() {
        if (!$('confirmSubmit').checked) {
            showError('请先勾选确认信息准确无误');
            return;
        }

        Object.assign(formData, collectStepData(currentStep));

        const btn = this;
        btn.disabled = true;
        btn.querySelector('span').textContent = '提交中...';

        const formD = new FormData();
        formD.append('name', $('name').value.trim());
        formD.append('gender', $('gender').value);
        formD.append('political_status', $('political_status').value.trim());
        formD.append('school', $('school').value);
        formD.append('homeroom', $('homeroom').value.trim());
        formD.append('telephone', $('telephone').value.trim());
        formD.append('qq_id', $('qq_id').value.trim());
        formD.append('wx_id', $('wx_id').value.trim());
        formD.append('email', $('email').value.trim());
        formD.append('character', $('character').value);
        formD.append('introduction', $('introduction').value);
        formD.append('experience', $('experience').value);
        formD.append('honor', $('honor').value);
        formD.append('racetrack', $('racetrack') ? $('racetrack').value : 'UNK');
        formD.append('adjustable', $('adjustable') ? $('adjustable').value : 'O');
        formD.append('volunteers', JSON.stringify([]));

        if (avatarFile) {
            formD.append('avatar', avatarFile);
        }

        try {
            const resp = await fetch('/api/profile/update/', {
                method: 'POST',
                headers: { 'X-CSRFToken': getCSRFToken() },
                body: formD
            });
            const result = await resp.json();
            if (result.success) {
                showError('✅ 个人信息保存成功！即将跳转...');
                setTimeout(() => {
                    window.location.href = '/volunteer/';
                }, 1500);
            } else {
                showError(result.message || '保存失败');
                btn.disabled = false;
                btn.querySelector('span').textContent = '✓ 提交报名信息';
            }
        } catch (err) {
            showError('保存失败，请检查网络连接后重试');
            btn.disabled = false;
            btn.querySelector('span').textContent = '✓ 提交报名信息';
        }
    });

    // 加载数据
    async function loadProfile() {
        try {
            const resp = await fetch('/api/profile/');
            const result = await resp.json();
            if (!result.success) {
                // 非面试者账号（如管理员预览）给出明确提示，避免误以为表单可用
                if ((result.message || '').indexOf('用户信息不存在') !== -1) {
                    showError('当前账号不是面试者，无法填写个人简历');
                }
                return;
            }
            const d = result.data;

            canEdit = d.can_edit !== undefined ? d.can_edit : true;

            $('username').value = d.username || '';
            $('student_number').value = d.student_number || '';
            $('name').value = d.name || '';
            $('gender').value = d.gender || 'M';
            $('political_status').value = d.political_status || '';
            $('school').value = d.school || 'UN';
            $('homeroom').value = d.homeroom || '';
            $('telephone').value = d.telephone || '';
            $('qq_id').value = d.qq_id || '';
            $('wx_id').value = d.wx_id || '';
            $('email').value = d.email || '';
            $('character').value = d.character || '';
            $('introduction').value = d.introduction || '';
            $('experience').value = d.experience || '';
            $('honor').value = d.honor || '';

            if (d.avatar_thumbnail_url || d.avatar_url) {
                currentAvatarUrl = d.avatar_thumbnail_url || d.avatar_url;
            }
            updateAvatarDisplay();

            const statusEl = $('candidateStatusDisplay');
            if (statusEl) {
                statusEl.textContent = d.status_display || '未完善';
                statusEl.className = 'status-badge ' + (d.status ? d.status.toLowerCase() : 'incomplete');
            }

            document.querySelectorAll('.form-field input, .form-field select, .form-field textarea').forEach(el => {
                if (!canEdit && el.id !== 'username' && el.id !== 'student_number') {
                    el.setAttribute('disabled', 'disabled');
                }
            });

            ['character', 'introduction', 'experience', 'honor'].forEach(id => {
                const ta = $(id);
                const count = $(id + 'Count');
                if (ta && count) {
                    const remain = ta.maxLength - ta.value.length;
                    count.textContent = `剩余 ${Math.max(0, remain)} 字`;
                }
            });
        } catch (err) {
            console.error('加载失败:', err);
        }
    }

    loadProfile();
    goToStep(1);
});
