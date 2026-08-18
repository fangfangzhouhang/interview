// profile.js - 个人中心完整JavaScript文件

document.addEventListener('DOMContentLoaded', function() {
    // ===== DOM元素 =====
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const menuItems = document.querySelectorAll('.menu-item');
    const profileContainer = document.getElementById('profileContainer');
    const pageTitle = document.getElementById('pageTitle');
    const profileForm = document.getElementById('profileForm');
    const resetBtn = document.getElementById('resetBtn');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    const submitBtn = document.getElementById('submitBtn');

    // ===== 头像相关 DOM =====
    const avatarInput = document.getElementById('avatarInput');
    const avatarImage = document.getElementById('avatarImage');
    const avatarPlaceholder = document.getElementById('avatarPlaceholder');
    const avatarError = document.getElementById('avatarError');
    const removeAvatarBtn = document.getElementById('removeAvatarBtn');
    const avatarFileName = document.getElementById('avatarFileName');
    const avatarPreview = document.getElementById('avatarPreview');
    let currentAvatarUrl = null;
    let avatarFile = null;

    // 部门选项（从后端获取）
    let departmentChoices = [];
    let currentVolunteers = [];
    let canEdit = true;
    let currentRacetrack = 'UNK';

    // ===== 获取CSRF Token =====
    function getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]').value;
    }

    // ===== 显示消息 =====
    function showMessage(type, text) {
        if (type === 'success') {
            successMessage.textContent = text;
            successMessage.style.display = 'block';
            errorMessage.style.display = 'none';
            setTimeout(() => {
                successMessage.style.display = 'none';
            }, 5000);
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

    // ===== 侧边栏切换 =====
    toggleBtn.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        const icon = this.querySelector('.toggle-icon');
        if (sidebar.classList.contains('collapsed')) {
            icon.textContent = '▶';
        } else {
            icon.textContent = '◀';
        }
    });

    // ===== 侧边栏菜单点击 =====
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            if (this.classList.contains('logout-item')) {
                return;
            }
            // 先高亮当前菜单
            menuItems.forEach(m => m.classList.remove('active'));
            this.classList.add('active');
            // 让浏览器正常跳转，不阻止默认行为
        });
    });

    // 页面加载时高亮当前菜单
    function highlightCurrentMenu() {
        const currentPath = window.location.pathname;
        menuItems.forEach(item => {
            item.classList.remove('active');
            const href = item.getAttribute('href');
            if (href && currentPath.includes(href)) {
                item.classList.add('active');
            }
        });
        // 个人页面特殊处理
        if (currentPath === '/profile/' || currentPath === '/profile') {
            const profileItem = document.querySelector('.menu-item[href*="profile"]');
            if (profileItem) profileItem.classList.add('active');
        }
    }
    highlightCurrentMenu();

    // ===== 头像预览功能 =====
    function updateAvatarPreview(file) {
        avatarImage.classList.remove('visible', 'loaded');
        avatarPlaceholder.classList.add('hidden');
        if (avatarError) avatarError.style.display = 'none';

        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                avatarImage.src = e.target.result;
                avatarImage.classList.add('visible', 'loaded');
                avatarPlaceholder.classList.add('hidden');
                if (avatarError) avatarError.style.display = 'none';
                if (avatarFileName) {
                    avatarFileName.textContent = `已选择: ${file.name}`;
                    avatarFileName.style.display = 'inline';
                }
                if (removeAvatarBtn) {
                    removeAvatarBtn.style.display = 'inline-block';
                }
                avatarFile = file;
            };
            reader.readAsDataURL(file);
        } else if (currentAvatarUrl) {
            avatarImage.src = currentAvatarUrl;
            avatarImage.classList.add('visible');
            avatarImage.onload = function() {
                this.classList.add('loaded');
                avatarPlaceholder.classList.add('hidden');
                if (avatarError) avatarError.style.display = 'none';
            };
            avatarImage.onerror = function() {
                this.classList.remove('visible', 'loaded');
                this.src = '';
                avatarPlaceholder.classList.add('hidden');
                if (avatarError) {
                    avatarError.style.display = 'flex';
                }
                if (removeAvatarBtn) {
                    removeAvatarBtn.style.display = 'none';
                }
            };
            if (avatarFileName) {
                avatarFileName.textContent = '';
                avatarFileName.style.display = 'none';
            }
            if (removeAvatarBtn) {
                removeAvatarBtn.style.display = 'inline-block';
            }
            avatarFile = null;
        } else {
            avatarImage.src = '';
            avatarImage.classList.remove('visible', 'loaded');
            avatarPlaceholder.classList.remove('hidden');
            if (avatarError) avatarError.style.display = 'none';
            if (avatarFileName) {
                avatarFileName.textContent = '';
                avatarFileName.style.display = 'none';
            }
            if (removeAvatarBtn) {
                removeAvatarBtn.style.display = 'none';
            }
            avatarFile = null;
        }
    }

    // 点击预览区触发展开文件选择
    if (avatarPreview) {
        avatarPreview.addEventListener('click', function(e) {
            if (e.target.closest('.avatar-upload-btn-wrapper')) return;
            if (canEdit && avatarInput) {
                avatarInput.click();
            }
        });
    }

    // 文件选择事件
    if (avatarInput) {
        avatarInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
                if (!validTypes.includes(file.type)) {
                    showMessage('error', '仅支持 jpeg/jpg/png 格式的图片');
                    this.value = '';
                    return;
                }
                if (file.size > 3 * 1024 * 1024) {
                    showMessage('error', '图片大小不能超过 3MB');
                    this.value = '';
                    return;
                }
                updateAvatarPreview(file);
                hideMessages();
            }
        });
    }

    // 删除头像
    if (removeAvatarBtn) {
        removeAvatarBtn.addEventListener('click', function() {
            if (!canEdit) {
                showMessage('error', '当前状态不可修改');
                return;
            }
            if (!confirm('确定要删除证件照吗？')) return;
            currentAvatarUrl = null;
            avatarFile = null;
            updateAvatarPreview(null);
            if (avatarInput) {
                avatarInput.value = '';
            }
            hideMessages();
        });
    }

    // ===== 字数统计 =====
    function setupWordCounter(textareaId, maxLength, countDisplayId) {
        const textarea = document.getElementById(textareaId);
        const countDisplay = document.getElementById(countDisplayId);
        if (!textarea || !countDisplay) return;

        textarea.addEventListener('input', function() {
            const length = this.value.length;
            const remaining = maxLength - length;
            if (remaining < 0) {
                this.value = this.value.substring(0, maxLength);
                countDisplay.textContent = '已达到字数上限';
                countDisplay.style.color = '#e53e3e';
            } else {
                countDisplay.textContent = `剩余 ${remaining} 字`;
                countDisplay.style.color = remaining < 50 ? '#e53e3e' : '#a0aec0';
            }
        });
    }

    setupWordCounter('character', 500, 'characterCount');
    setupWordCounter('introduction', 150, 'introductionCount');
    setupWordCounter('experience', 500, 'experienceCount');
    setupWordCounter('honor', 500, 'honorCount');

    // ===== 赛道与部门联动 =====
    function getDepartmentsByRacetrack(racetrack) {
        if (racetrack === 'POL') {
            return ['BGS', 'QYB', 'XSB'];
        } else if (racetrack === 'ZHU') {
            return ['XCB', 'WYB', 'TYB'];
        } else {
            return departmentChoices.map(d => d.value);
        }
    }

    function updateDepartmentOptions(racetrack) {
        const selects = document.querySelectorAll('.volunteer-dept-select');
        const allowedDepts = getDepartmentsByRacetrack(racetrack);
        const hint = document.getElementById('racetrackHint');

        if (racetrack === 'POL') {
            hint.textContent = '破浪赛道可选：办公、权益、学实';
        } else if (racetrack === 'ZHU') {
            hint.textContent = '逐浪赛道可选：信传、文艺、体育';
        } else {
            hint.textContent = '请选择赛道以限制志愿部门范围';
        }

        selects.forEach(select => {
            const currentVal = select.value;
            const emptyOption = select.querySelector('option[value=""]');
            select.innerHTML = '';
            if (emptyOption) {
                select.appendChild(emptyOption.cloneNode());
            } else {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = '请选择部门';
                select.appendChild(opt);
            }

            departmentChoices.forEach(dept => {
                if (allowedDepts.includes(dept.value)) {
                    const option = document.createElement('option');
                    option.value = dept.value;
                    option.textContent = dept.label;
                    if (currentVal === dept.value) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                }
            });

            if (currentVal && !allowedDepts.includes(currentVal)) {
                select.value = '';
            }

            updateSelectOptions();
        });
    }

    // ===== 调剂提示 =====
    function setupAdjustableListener() {
        const adjustableSelect = document.getElementById('adjustable');
        const hint = document.getElementById('adjustableHint');

        if (adjustableSelect) {
            adjustableSelect.addEventListener('change', function() {
                if (this.value === 'Y') {
                    hint.textContent = '选择"是"将可能被调剂到其他部门或赛道';
                } else {
                    hint.textContent = this.value === 'N' ? '不服从调剂' : '请选择';
                }
            });
        }
    }

    // ===== 志愿编辑 =====
    function isVolunteerEditable(vol) {
        if (!canEdit) return false;
        if (!vol || !vol.id) return true;
        if (vol.is_in_queue) return false;
        if (vol.status && vol.status !== 'FILLED' && vol.status !== 'WAITING') return false;
        if (vol.status === 'WAITING' && !vol.is_in_queue) return true;
        return true;
    }

    function isVolunteerDeletable(vol) {
        if (!canEdit) return false;
        if (!vol || !vol.id) return false;
        if (vol.is_in_queue) return false;
        if (vol.status && vol.status !== 'FILLED') return false;
        return true;
    }

    function renderVolunteerEditor(volunteers, departments) {
        const container = document.getElementById('volunteerEditor');
        if (!container) return;

        const priorityLabels = ['第一志愿', '第二志愿', '第三志愿'];
        const allowedDepts = getDepartmentsByRacetrack(currentRacetrack);

        let html = '';

        volunteers.forEach((vol, index) => {
            const priorityLabel = priorityLabels[index] || `第${index+1}志愿`;
            const isEditable = isVolunteerEditable(vol);
            const isDeletable = isVolunteerDeletable(vol);
            const currentDept = vol.department || '';
            const hasId = vol.id !== null && vol.id !== undefined;

            html += `
                <div class="volunteer-editor-item" data-priority="${vol.priority}" data-volunteer-id="${vol.id || ''}">
                    <div class="volunteer-editor-info">
                        <span class="volunteer-editor-priority">${priorityLabel}</span>
                        <select class="volunteer-dept-select" data-priority="${vol.priority}"
                                ${!isEditable ? 'disabled' : ''}>
                            <option value="">请选择部门</option>
                    `;

            const deptsToShow = departments.filter(d => allowedDepts.includes(d.value));
            deptsToShow.forEach(dept => {
                const selected = dept.value === currentDept ? 'selected' : '';
                html += `<option value="${dept.value}" ${selected}>${dept.label}</option>`;
            });

            html += `
                        </select>
                        ${!isEditable && hasId ? `<span class="volunteer-locked" title="该志愿不可修改">🔒</span>` : ''}
                    </div>
                    <div class="volunteer-editor-status">
            `;

            if (hasId) {
                const statusDisplay = vol.status_display || vol.status || '未设置';
                const statusClass = vol.status ? vol.status.toLowerCase() : 'empty';
                html += `
                    <span class="volunteer-status ${statusClass}">${statusDisplay}</span>
                `;
                if (vol.is_in_queue && vol.queue_start_time) {
                    const queueTime = new Date(vol.queue_start_time).toLocaleString('zh-CN');
                    html += `
                        <span class="volunteer-queue-time">⏱ 排队中: ${queueTime}</span>
                    `;
                }
            } else {
                html += `<span class="volunteer-status empty">未填报</span>`;
            }

            html += `
                    </div>
                    <div class="volunteer-editor-actions">
            `;

            if (hasId && canEdit) {
                if (vol.is_in_queue) {
                    html += `
                        <button class="btn btn-sm btn-danger volunteer-action-btn"
                                data-volunteer-id="${vol.id}"
                                data-action="cancel_queue">取消排队</button>
                        <button class="btn btn-sm btn-warning volunteer-action-btn"
                                data-volunteer-id="${vol.id}"
                                data-action="requeue">重新排队</button>
                    `;
                } else if (vol.status === 'FILLED' || vol.status === 'WAITING') {
                    html += `
                        <button class="btn btn-sm btn-success volunteer-action-btn"
                                data-volunteer-id="${vol.id}"
                                data-action="start_queue">开始排队</button>
                    `;
                } else {
                    html += `<span class="volunteer-status-text">${vol.status_display || vol.status}</span>`;
                }

                if (isDeletable) {
                    html += `
                        <button class="btn btn-sm btn-danger volunteer-delete-btn"
                                data-volunteer-id="${vol.id}">删除</button>
                    `;
                }
            } else if (hasId && !canEdit) {
                html += `<span class="volunteer-status-text">${vol.status_display || vol.status}</span>`;
            } else {
                html += `<span class="volunteer-status-text">-</span>`;
            }

            html += `
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // 绑定志愿操作事件
        document.querySelectorAll('.volunteer-action-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const volunteerId = this.dataset.volunteerId;
                const action = this.dataset.action;
                if (volunteerId && action) {
                    handleVolunteerAction(volunteerId, action);
                }
            });
        });

        // 绑定删除事件
        document.querySelectorAll('.volunteer-delete-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const volunteerId = this.dataset.volunteerId;
                if (volunteerId) {
                    handleDeleteVolunteer(volunteerId);
                }
            });
        });

        // 部门选择变更时更新禁用状态
        document.querySelectorAll('.volunteer-dept-select').forEach(select => {
            select.addEventListener('change', function() {
                updateSelectOptions();
            });
        });

        updateSelectOptions();
    }

    function updateSelectOptions() {
        const container = document.getElementById('volunteerEditor');
        if (!container) return;

        const selects = container.querySelectorAll('.volunteer-dept-select');
        const selectedValues = [];
        selects.forEach(sel => {
            if (sel.value && !sel.disabled) {
                selectedValues.push(sel.value);
            }
        });

        selects.forEach(sel => {
            if (sel.disabled) return;
            const currentVal = sel.value;
            const options = sel.querySelectorAll('option');
            options.forEach(opt => {
                if (opt.value && opt.value !== currentVal) {
                    const count = selectedValues.filter(v => v === opt.value).length;
                    opt.disabled = count > 0;
                }
            });
        });
    }

    // ===== 删除志愿 =====
    function handleDeleteVolunteer(volunteerId) {
        const vol = currentVolunteers.find(v => v.id === parseInt(volunteerId));
        if (!vol) {
            showMessage('error', '志愿不存在');
            return;
        }

        if (!isVolunteerDeletable(vol)) {
            showMessage('error', '该志愿不可删除');
            return;
        }

        if (!confirm(`确定要删除 "${vol.department_display || '此志愿'}" 吗？`)) {
            return;
        }

        const select = document.querySelector(`.volunteer-dept-select[data-priority="${vol.priority}"]`);
        if (select) {
            select.value = '';
            select.dispatchEvent(new Event('change'));
            const target = currentVolunteers.find(v => v.priority === vol.priority);
            if (target) {
                target.department = null;
                target.department_display = null;
                target.status = null;
                target.status_display = null;
                target.id = null;
                target.is_in_queue = false;
                target.queue_start_time = null;
            }
            renderVolunteerEditor(currentVolunteers, departmentChoices);
            showMessage('success', `已删除 "${vol.department_display}"，保存个人信息后生效`);
        }
    }

    // ===== 处理志愿排队操作 =====
    async function handleVolunteerAction(volunteerId, action) {
        const actionMap = {
            'start_queue': '开始排队',
            'cancel_queue': '取消排队',
            'requeue': '重新排队'
        };
        const actionLabel = actionMap[action] || action;

        if (!confirm(`确定要${actionLabel}吗？`)) {
            return;
        }

        try {
            const response = await fetch('/api/profile/volunteer/action/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCSRFToken(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    volunteer_id: volunteerId,
                    action: action
                })
            });

            const result = await response.json();
            if (result.success) {
                showMessage('success', result.message || `${actionLabel}成功`);
                await loadProfile();
            } else {
                showMessage('error', result.message || `${actionLabel}失败`);
            }
        } catch (error) {
            console.error('志愿操作失败:', error);
            showMessage('error', '操作失败，请重试');
        }
    }

    // ===== 收集志愿表单数据 =====
    function collectVolunteerData() {
        const selects = document.querySelectorAll('.volunteer-dept-select');
        const volunteers = [];

        selects.forEach(select => {
            const priority = parseInt(select.dataset.priority);
            const department = select.value || null;
            const existing = currentVolunteers.find(v => v.priority === priority);
            volunteers.push({
                id: existing && existing.id ? existing.id : null,
                priority: priority,
                department: department,
            });
        });

        return volunteers;
    }

    // ===== 加载个人资料 =====
    async function loadProfile() {
        const editorContainer = document.getElementById('volunteerEditor');
        if (editorContainer) {
            editorContainer.innerHTML = '<div class="volunteer-loading">⏳ 加载中...</div>';
        }

        try {
            const response = await fetch('/api/profile/');
            const result = await response.json();

            if (result.success) {
                const data = result.data;
                departmentChoices = data.department_choices || [];
                canEdit = data.can_edit !== undefined ? data.can_edit : true;
                currentRacetrack = data.racetrack || 'UNK';

                document.getElementById('username').value = data.username;
                document.getElementById('student_number').value = data.student_number;
                document.getElementById('name').value = data.name || '';
                document.getElementById('gender').value = data.gender || 'M';
                document.getElementById('political_status').value = data.political_status || '';
                document.getElementById('school').value = data.school || 'UN';
                document.getElementById('homeroom').value = data.homeroom || '';
                document.getElementById('telephone').value = data.telephone || '';
                document.getElementById('qq_id').value = data.qq_id || '';
                document.getElementById('wx_id').value = data.wx_id || '';
                document.getElementById('email').value = data.email || '';
                document.getElementById('character').value = data.character || '';
                document.getElementById('introduction').value = data.introduction || '';
                document.getElementById('experience').value = data.experience || '';
                document.getElementById('honor').value = data.honor || '';

                // 加载头像
                if (data.avatar_thumbnail_url) {
                    currentAvatarUrl = data.avatar_thumbnail_url;
                } else if (data.avatar_url) {
                    currentAvatarUrl = data.avatar_url;
                } else {
                    currentAvatarUrl = null;
                }
                updateAvatarPreview(null);

                // 赛道和调剂
                document.getElementById('racetrack').value = data.racetrack || 'UNK';
                document.getElementById('adjustable').value = data.adjustable || 'O';

                const adjustableSelect = document.getElementById('adjustable');
                if (adjustableSelect) {
                    adjustableSelect.dispatchEvent(new Event('change'));
                }

                updateDepartmentOptions(data.racetrack || 'UNK');
                currentVolunteers = data.volunteers || [];

                const statusDisplay = document.getElementById('candidateStatusDisplay');
                if (statusDisplay) {
                    statusDisplay.textContent = data.status_display || '未完善';
                    statusDisplay.className = `status-badge ${data.status ? data.status.toLowerCase() : 'incomplete'}`;
                }

                updateWordCount('character', 500, 'characterCount');
                updateWordCount('introduction', 150, 'introductionCount');
                updateWordCount('experience', 500, 'experienceCount');
                updateWordCount('honor', 500, 'honorCount');

                toggleFormEditable(canEdit);
                renderVolunteerEditor(currentVolunteers, departmentChoices);
            } else {
                showMessage('error', result.message || '加载个人信息失败');
                if (editorContainer) {
                    editorContainer.innerHTML = '<div class="volunteer-error">❌ 加载失败，请刷新重试</div>';
                }
            }
        } catch (error) {
            console.error('加载个人信息失败:', error);
            showMessage('error', '加载个人信息失败，请刷新页面重试');
            if (editorContainer) {
                editorContainer.innerHTML = '<div class="volunteer-error">❌ 加载失败，请刷新重试</div>';
            }
        }
    }

    function toggleFormEditable(editable) {
        const inputs = profileForm.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
        inputs.forEach(input => {
            if (input.id === 'username' || input.id === 'student_number') return;
            if (editable) {
                input.removeAttribute('disabled');
                input.style.opacity = '1';
            } else {
                input.setAttribute('disabled', 'disabled');
                input.style.opacity = '0.6';
            }
        });

        if (submitBtn) {
            if (editable) {
                submitBtn.removeAttribute('disabled');
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
            } else {
                submitBtn.setAttribute('disabled', 'disabled');
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
            }
        }

        if (resetBtn) {
            if (editable) {
                resetBtn.removeAttribute('disabled');
                resetBtn.style.opacity = '1';
                resetBtn.style.cursor = 'pointer';
            } else {
                resetBtn.setAttribute('disabled', 'disabled');
                resetBtn.style.opacity = '0.5';
                resetBtn.style.cursor = 'not-allowed';
            }
        }

        if (avatarInput) {
            avatarInput.disabled = !editable;
        }
        if (removeAvatarBtn) {
            removeAvatarBtn.disabled = !editable;
        }
    }

    function updateWordCount(textareaId, maxLength, countDisplayId) {
        const textarea = document.getElementById(textareaId);
        const countDisplay = document.getElementById(countDisplayId);
        if (textarea && countDisplay) {
            const length = textarea.value.length;
            const remaining = maxLength - length;
            countDisplay.textContent = `剩余 ${Math.max(0, remaining)} 字`;
            countDisplay.style.color = remaining < 50 ? '#e53e3e' : '#a0aec0';
        }
    }

    // ===== 赛道选择变更 =====
    document.getElementById('racetrack').addEventListener('change', function() {
        currentRacetrack = this.value;
        updateDepartmentOptions(this.value);
        renderVolunteerEditor(currentVolunteers, departmentChoices);
    });

    // ===== 提交表单 =====
    profileForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideMessages();

        if (!canEdit) {
            showMessage('error', '当前状态不可修改个人信息');
            return;
        }

        const name = document.getElementById('name').value.trim();
        const political_status = document.getElementById('political_status').value.trim();
        const school = document.getElementById('school').value;
        const homeroom = document.getElementById('homeroom').value.trim();
        const telephone = document.getElementById('telephone').value.trim();
        const racetrack = document.getElementById('racetrack').value;
        const adjustable = document.getElementById('adjustable').value;

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
        if (school === 'UN') {
            showMessage('error', '请选择学院');
            document.getElementById('school').focus();
            return;
        }
        if (!homeroom) {
            showMessage('error', '请输入班级');
            document.getElementById('homeroom').focus();
            return;
        }
        if (!telephone) {
            showMessage('error', '请输入手机号');
            document.getElementById('telephone').focus();
            return;
        }
        if (racetrack === 'UNK') {
            showMessage('error', '请选择赛道');
            document.getElementById('racetrack').focus();
            return;
        }

        const phonePattern = /^1[3-9]\d{9}$/;
        if (!phonePattern.test(telephone)) {
            showMessage('error', '请输入有效的手机号（11位，以13-19开头）');
            document.getElementById('telephone').focus();
            return;
        }

        const hasAvatar = currentAvatarUrl !== null || avatarFile !== null ||
                          (avatarInput && avatarInput.files && avatarInput.files[0]);

        if (!hasAvatar) {
            showMessage('error', '请上传个人证件照');
            const avatarSection = document.querySelector('.avatar-section');
            if (avatarSection) {
                avatarSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                avatarSection.style.borderColor = '#e53e3e';
                setTimeout(() => {
                    avatarSection.style.borderColor = '';
                }, 3000);
            }
            return;
        }

        const volunteers = collectVolunteerData();
        const depts = volunteers.filter(v => v.department).map(v => v.department);
        if (depts.length !== new Set(depts).size) {
            showMessage('error', '志愿部门不能重复，请检查');
            return;
        }

        if (depts.length === 0) {
            showMessage('error', '请至少填报一个志愿');
            return;
        }

        const allowedDepts = getDepartmentsByRacetrack(racetrack);
        for (const dept of depts) {
            if (!allowedDepts.includes(dept)) {
                const deptDisplay = departmentChoices.find(d => d.value === dept)?.label || dept;
                showMessage('error', `当前赛道不允许选择 "${deptDisplay}" 部门，请调整赛道或志愿`);
                return;
            }
        }

        const formData = new FormData();
        formData.append('name', name);
        formData.append('gender', document.getElementById('gender').value);
        formData.append('political_status', political_status);
        formData.append('school', school);
        formData.append('homeroom', homeroom);
        formData.append('telephone', telephone);
        formData.append('qq_id', document.getElementById('qq_id').value.trim());
        formData.append('wx_id', document.getElementById('wx_id').value.trim());
        formData.append('email', document.getElementById('email').value.trim());
        formData.append('character', document.getElementById('character').value);
        formData.append('introduction', document.getElementById('introduction').value);
        formData.append('experience', document.getElementById('experience').value);
        formData.append('honor', document.getElementById('honor').value);
        formData.append('racetrack', racetrack);
        formData.append('adjustable', adjustable);
        formData.append('volunteers', JSON.stringify(volunteers));

        if (avatarFile) {
            formData.append('avatar', avatarFile);
        } else if (avatarInput && avatarInput.files && avatarInput.files[0]) {
            formData.append('avatar', avatarInput.files[0]);
        }

        try {
            const response = await fetch('/api/profile/update/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCSRFToken(),
                },
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                showMessage('success', '✅ 个人信息保存成功！');
                avatarFile = null;
                await loadProfile();
            } else {
                showMessage('error', result.message || '保存失败');
            }
        } catch (error) {
            console.error('保存个人信息失败:', error);
            showMessage('error', '保存失败，请检查网络连接后重试');
        }
    });

    // ===== 重置按钮 =====
    resetBtn.addEventListener('click', function() {
        if (!canEdit) {
            showMessage('error', '当前状态不可重置');
            return;
        }
        if (confirm('确定要重置所有修改吗？')) {
            avatarFile = null;
            if (avatarInput) avatarInput.value = '';
            loadProfile();
            hideMessages();
            showMessage('success', '已重置为保存的数据');
        }
    });

    // ===== 初始化 =====
    setupAdjustableListener();
    loadProfile();
});