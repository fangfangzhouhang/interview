// volunteer.js - 志愿管理页面
document.addEventListener('DOMContentLoaded', function() {
    const $ = (id) => document.getElementById(id);
    const editor = $('volunteerEditor');
    const racetrackRadios = document.querySelectorAll('input[name="racetrack"]');
    const racetrackHint = $('racetrackHint');
    const adjustableSelect = $('adjustable');
    const adjustableHint = $('adjustableHint');
    const candidateStatusEl = $('candidateStatusDisplay');
    const saveBtn = $('saveVolunteerBtn');
    const resetBtn = $('resetVolunteerBtn');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');

    let departmentChoices = [];
    let currentVolunteers = [];
    let currentRacetrack = 'UNK';
    let canEdit = true;

    const DEPARTMENT_MAP = {
        POL: [
            { value: 'BGS', label: '办公' },
            { value: 'QYB', label: '权益' },
            { value: 'XSB', label: '学实' }
        ],
        ZHU: [
            { value: 'XCB', label: '信传' },
            { value: 'WYB', label: '文艺' },
            { value: 'TYB', label: '体育' }
        ]
    };

    const PRIORITY_LABELS = ['第一志愿', '第二志愿', '第三志愿'];

    function getCSRFToken() {
        const el = document.querySelector('[name=csrfmiddlewaretoken]');
        return el ? el.value : '';
    }

    function showSuccess(msg) {
        successMessage.textContent = msg;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
        setTimeout(() => { successMessage.style.display = 'none'; }, 5000);
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function hideMessages() {
        successMessage.style.display = 'none';
        errorMessage.style.display = 'none';
    }

    function showLoading(msg) {
        editor.innerHTML = `<div class="volunteer-loading">⏳ ${msg || '加载中...'}</div>`;
    }

    function getDepartmentsByRacetrack(racetrack) {
        return DEPARTMENT_MAP[racetrack] || [];
    }

    // 赛道切换
    racetrackRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            currentRacetrack = this.value;
            updateRacetrackHint();
            renderVolunteerEditor();
        });
    });

    function updateRacetrackHint() {
        if (currentRacetrack === 'POL') {
            racetrackHint.textContent = '破浪赛道可选：办公、权益、学实';
        } else if (currentRacetrack === 'ZHU') {
            racetrackHint.textContent = '逐浪赛道可选：信传、文艺、体育';
        } else {
            racetrackHint.textContent = '请选择赛道以确定可选部门';
        }
    }

    adjustableSelect.addEventListener('change', function() {
        if (this.value === 'Y') {
            adjustableHint.textContent = '选择"是"将可能被调剂到其他部门或赛道';
        } else if (this.value === 'N') {
            adjustableHint.textContent = '不服从调剂';
        } else {
            adjustableHint.textContent = '请选择';
        }
    });

    // 渲染志愿编辑器
    function renderVolunteerEditor() {
        if (!canEdit) {
            editor.innerHTML = '<div class="volunteer-empty">当前状态不可修改志愿</div>';
            return;
        }

        const allowedDepts = getDepartmentsByRacetrack(currentRacetrack);
        if (allowedDepts.length === 0) {
            editor.innerHTML = '<div class="volunteer-empty">请先选择赛道</div>';
            return;
        }

        let html = '';
        for (let i = 0; i < 3; i++) {
            const priority = i + 1;
            const vol = currentVolunteers.find(v => v.priority === priority) || {};
            const dept = vol.department || '';
            const status = vol.status || '';
            const hasId = vol.id != null;
            const isInQueue = vol.is_in_queue;

            let statusText = '未填报';
            let statusClass = 'empty';
            if (hasId) {
                statusText = vol.status_display || '已填报';
                statusClass = (status || '').toLowerCase();
            }

            html += `
                <div class="volunteer-editor-item" data-priority="${priority}">
                    <div class="volunteer-editor-info">
                        <span class="volunteer-editor-priority">${PRIORITY_LABELS[i]}</span>
                        <select class="volunteer-dept-select" data-priority="${priority}" ${(!hasId || (!isInQueue && ['FILLED', 'WAITING'].includes(status))) ? '' : 'disabled'}>
                            <option value="">请选择部门</option>
            `;

            allowedDepts.forEach(d => {
                html += `<option value="${d.value}" ${dept === d.value ? 'selected' : ''}>${d.label}</option>`;
            });

            html += `
                        </select>
                    </div>
                    <div class="volunteer-editor-status">
                        <span class="volunteer-status ${statusClass}">${statusText}</span>
            `;

            if (isInQueue && vol.queue_start_time) {
                const queueTime = new Date(vol.queue_start_time).toLocaleString('zh-CN');
                html += `<span class="volunteer-queue-time">⏱ ${queueTime}</span>`;
            }

            html += `
                    </div>
                    <div class="volunteer-editor-actions">
            `;

            if (hasId && canEdit) {
                if (isInQueue) {
                    html += `
                        <button class="btn btn-sm btn-warning volunteer-action-btn" data-action="cancel_queue" data-id="${vol.id}">取消排队</button>
                        <button class="btn btn-sm btn-primary volunteer-action-btn" data-action="requeue" data-id="${vol.id}">重新排队</button>
                    `;
                } else if (status === 'FILLED' || status === 'WAITING') {
                    html += `<button class="btn btn-sm btn-success volunteer-action-btn" data-action="start_queue" data-id="${vol.id}">开始排队</button>`;
                    html += `<button class="btn btn-sm volunteer-delete-btn" data-id="${vol.id}">删除</button>`;
                }
            }

            html += `
                    </div>
                </div>
            `;
        }

        editor.innerHTML = html;

        // 绑定事件
        editor.querySelectorAll('.volunteer-dept-select').forEach(select => {
            select.addEventListener('change', function() {
                updateDeptAvailability();
            });
        });

        editor.querySelectorAll('.volunteer-action-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                const action = this.dataset.action;
                handleVolunteerAction(id, action);
            });
        });

        editor.querySelectorAll('.volunteer-delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                handleDeleteVolunteer(id);
            });
        });

        updateDeptAvailability();
    }

    function updateDeptAvailability() {
        const selects = editor.querySelectorAll('.volunteer-dept-select');
        const selectedValues = [];
        selects.forEach(s => {
            if (s.value && !s.disabled) selectedValues.push(s.value);
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

    async function handleVolunteerAction(id, action) {
        const actionMap = {
            start_queue: '开始排队',
            cancel_queue: '取消排队',
            requeue: '重新排队'
        };
        const label = actionMap[action] || action;

        if (!(await Modal.confirm(`确定要${label}吗？`))) return;

        try {
            const resp = await fetch('/api/profile/volunteer/action/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCSRFToken(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ volunteer_id: id, action })
            });
            const result = await resp.json();
            if (result.success) {
                showSuccess(result.message || `${label}成功`);
                await loadProfile();
            } else {
                showError(result.message || `${label}失败`);
            }
        } catch (err) {
            showError('操作失败，请重试');
        }
    }

    async function handleDeleteVolunteer(id) {
        const vol = currentVolunteers.find(v => v.id === parseInt(id));
        if (!vol) return;
        if (!(await Modal.confirm(`确定要删除"${vol.department_display || '此志愿'}"吗？`))) return;

        const priority = vol.priority;
        const select = editor.querySelector(`.volunteer-dept-select[data-priority="${priority}"]`);
        if (select) {
            select.value = '';
            const target = currentVolunteers.find(v => v.priority === priority);
            if (target) {
                target.department = null;
                target.id = null;
                target.status = null;
                target.status_display = null;
            }
            renderVolunteerEditor();
            showSuccess(`已删除志愿，保存后生效`);
        }
    }

    function collectVolunteerData() {
        const selects = editor.querySelectorAll('.volunteer-dept-select');
        const volunteers = [];
        selects.forEach(sel => {
            const priority = parseInt(sel.dataset.priority);
            const dept = sel.value || null;
            const existing = currentVolunteers.find(v => v.priority === priority);
            volunteers.push({
                id: existing && existing.id ? existing.id : null,
                priority,
                department: dept
            });
        });
        return volunteers;
    }

    // 保存按钮
    saveBtn.addEventListener('click', async function() {
        hideMessages();

        const depts = collectVolunteerData().filter(v => v.department).map(v => v.department);
        if (depts.length === 0) {
            showError('请至少选择一个志愿部门');
            return;
        }
        if (depts.length !== new Set(depts).size) {
            showError('志愿部门不能重复');
            return;
        }

        const allowedDepts = getDepartmentsByRacetrack(currentRacetrack);
        for (const d of depts) {
            if (!allowedDepts.some(x => x.value === d)) {
                const label = allowedDepts.find(x => x.value === d)?.label || d;
                showError(`当前赛道不允许选择"${label}"部门`);
                return;
            }
        }

        const btn = this;
        btn.disabled = true;
        btn.textContent = '保存中...';

        const formD = new FormData();
        formD.append('racetrack', currentRacetrack);
        formD.append('adjustable', adjustableSelect.value);
        formD.append('volunteers', JSON.stringify(collectVolunteerData()));

        try {
            const resp = await fetch('/api/profile/update/', {
                method: 'POST',
                headers: { 'X-CSRFToken': getCSRFToken() },
                body: formD
            });
            const result = await resp.json();
            if (result.success) {
                showSuccess('✅ 志愿设置保存成功！');
                await loadProfile();
            } else {
                showError(result.message || '保存失败');
            }
        } catch (err) {
            showError('保存失败，请检查网络连接');
        } finally {
            btn.disabled = false;
            btn.textContent = '💾 保存志愿设置';
        }
    });

    // 重置按钮
    resetBtn.addEventListener('click', async function() {
        if (!(await Modal.confirm('确定要撤销所有修改吗？'))) return;
        await loadProfile();
        showSuccess('已重置');
    });

    // 加载数据
    async function loadProfile() {
        showLoading('加载志愿数据...');
        try {
            const resp = await fetch('/api/profile/');
            const result = await resp.json();
            if (!result.success) {
                const msg = result.message || '';
                if (msg.indexOf('用户信息不存在') !== -1) {
                    editor.innerHTML = '<div class="volunteer-error">当前账号不是面试者，没有志愿信息。<br>如需体验请使用面试者账号登录。</div>';
                } else {
                    editor.innerHTML = `<div class="volunteer-error">${msg || '加载失败'}，请刷新重试</div>`;
                }
                return;
            }
            const d = result.data;
            canEdit = d.can_edit !== undefined ? d.can_edit : true;
            currentRacetrack = d.racetrack || 'UNK';
            currentVolunteers = d.volunteers || [];
            departmentChoices = d.department_choices || [];

            // 设置赛道
            const radio = document.querySelector(`input[name="racetrack"][value="${currentRacetrack}"]`);
            if (radio) radio.checked = true;
            updateRacetrackHint();

            // 设置调剂
            if (d.adjustable) {
                adjustableSelect.value = d.adjustable;
                adjustableSelect.dispatchEvent(new Event('change'));
            }

            // 状态显示
            if (candidateStatusEl) {
                candidateStatusEl.textContent = d.status_display || '未完善';
                candidateStatusEl.className = 'status-badge ' + (d.status ? d.status.toLowerCase() : 'incomplete');
            }

            // 按钮状态
            saveBtn.disabled = !canEdit;
            resetBtn.disabled = !canEdit;

            renderVolunteerEditor();
        } catch (err) {
            console.error('加载失败:', err);
            editor.innerHTML = '<div class="volunteer-error">加载失败，请刷新重试</div>';
        }
    }

    loadProfile();
});
