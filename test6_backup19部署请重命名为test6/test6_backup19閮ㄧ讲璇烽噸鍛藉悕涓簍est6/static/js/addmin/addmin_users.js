document.addEventListener('DOMContentLoaded', function() {
    // ========== 侧边栏切换 ==========
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            const icon = this.querySelector('.toggle-icon');
            if (sidebar.classList.contains('collapsed')) {
                icon.textContent = '▶';
            } else {
                icon.textContent = '◀';
            }
        });
    }

    // ========== 用户管理 ==========
    class UserManager {
        constructor() {
            this.apiUrl = '/api/addmin/users/';
            this.tableBody = document.getElementById('tableBody');
            this.searchInput = document.getElementById('searchInput');
            this.roleFilter = document.getElementById('roleFilter');
            this.departmentFilter = document.getElementById('departmentFilter');
            this.checkAll = document.getElementById('checkAll');
            this.selectAllBtn = document.getElementById('selectAllBtn');
            this.deselectAllBtn = document.getElementById('deselectAllBtn');
            this.totalCount = document.getElementById('totalCount');
            this.pageStart = document.getElementById('pageStart');
            this.pageEnd = document.getElementById('pageEnd');
            this.pageTotal = document.getElementById('pageTotal');
            this.currentPage = document.getElementById('currentPage');
            this.totalPages = document.getElementById('totalPages');
            this.prevPage = document.getElementById('prevPage');
            this.nextPage = document.getElementById('nextPage');
            this.editModal = document.getElementById('editModal');

            this.roleOptions = [];
            this.departmentOptions = [];
            this.candidateStatusOptions = [];

            this.selectedIds = new Set();
            this.state = {
                page: 1,
                pageSize: 10,
                search: '',
                role: '',
                department: '',
                sort: 'id',
                order: 'asc',
                total: 0,
                totalPages: 0
            };

            // 绑定方法
            this.handleVolunteerAction = this.handleVolunteerAction.bind(this);

            this.init();
        }

        async init() {
            await this.loadOptions();
            this.loadData();
            this.bindEvents();
        }

        // ========== 加载选项数据 ==========
        async loadOptions() {
            try {
                const response = await fetch('/api/addmin/users/options/');
                const result = await response.json();

                if (result.success) {
                    this.roleOptions = result.roles || [];
                    this.departmentOptions = result.departments || [];
                    this.candidateStatusOptions = result.candidate_statuses || [];

                    // 渲染权限筛选下拉
                    const roleFilter = document.getElementById('roleFilter');
                    if (roleFilter) {
                        roleFilter.innerHTML = '<option value="">全部权限</option>';
                        this.roleOptions.forEach(opt => {
                            const option = document.createElement('option');
                            option.value = opt.value;
                            option.textContent = opt.label;
                            roleFilter.appendChild(option);
                        });
                    }

                    // 渲染部门筛选下拉
                    const departmentFilter = document.getElementById('departmentFilter');
                    if (departmentFilter) {
                        departmentFilter.innerHTML = '<option value="">全部部门</option>';
                        this.departmentOptions.forEach(opt => {
                            const option = document.createElement('option');
                            option.value = opt.value;
                            option.textContent = opt.label;
                            departmentFilter.appendChild(option);
                        });
                    }

                    // 渲染编辑弹窗中的权限下拉
                    this.renderSelectOptions('editRole', this.roleOptions);
                } else {
                    console.error('加载选项失败:', result.message);
                }
            } catch (error) {
                console.error('加载选项失败:', error);
            }
        }

        renderSelectOptions(selectId, options, placeholder) {
            const select = document.getElementById(selectId);
            if (!select) return;

            select.innerHTML = '';
            if (placeholder) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = placeholder;
                select.appendChild(opt);
            }

            if (!options || options.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = '暂无选项';
                select.appendChild(option);
                return;
            }

            options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                select.appendChild(option);
            });
        }

        // ========== 绑定事件 ==========
        bindEvents() {
            // 搜索输入
            if (this.searchInput) {
                let timer;
                this.searchInput.addEventListener('input', () => {
                    clearTimeout(timer);
                    timer = setTimeout(() => {
                        this.state.search = this.searchInput.value;
                        this.state.page = 1;
                        this.loadData();
                    }, 500);
                });
            }

            // 权限筛选
            if (this.roleFilter) {
                this.roleFilter.addEventListener('change', () => {
                    this.state.role = this.roleFilter.value;
                    this.state.page = 1;
                    this.loadData();
                });
            }

            // 部门筛选
            if (this.departmentFilter) {
                this.departmentFilter.addEventListener('change', () => {
                    this.state.department = this.departmentFilter.value;
                    this.state.page = 1;
                    this.loadData();
                });
            }

            // 全选
            if (this.checkAll) {
                this.checkAll.addEventListener('change', () => {
                    const checked = this.checkAll.checked;
                    document.querySelectorAll('.row-checkbox').forEach(cb => {
                        cb.checked = checked;
                        if (checked) {
                            this.selectedIds.add(parseInt(cb.dataset.id));
                        } else {
                            this.selectedIds.delete(parseInt(cb.dataset.id));
                        }
                    });
                    this.updateSelectAllState();
                });
            }

            // 全选按钮
            if (this.selectAllBtn) {
                this.selectAllBtn.addEventListener('click', () => {
                    document.querySelectorAll('.row-checkbox').forEach(cb => {
                        cb.checked = true;
                        this.selectedIds.add(parseInt(cb.dataset.id));
                    });
                    if (this.checkAll) this.checkAll.checked = true;
                    this.updateSelectAllState();
                });
            }

            // 取消全选按钮
            if (this.deselectAllBtn) {
                this.deselectAllBtn.addEventListener('click', () => {
                    document.querySelectorAll('.row-checkbox').forEach(cb => {
                        cb.checked = false;
                        this.selectedIds.delete(parseInt(cb.dataset.id));
                    });
                    if (this.checkAll) this.checkAll.checked = false;
                    this.updateSelectAllState();
                });
            }

            // 排序
            document.querySelectorAll('[data-sort]').forEach(th => {
                th.addEventListener('click', () => {
                    const field = th.dataset.sort;
                    if (this.state.sort === field) {
                        this.state.order = this.state.order === 'asc' ? 'desc' : 'asc';
                    } else {
                        this.state.sort = field;
                        this.state.order = 'asc';
                    }
                    this.loadData();
                });
            });

            // 分页
            if (this.prevPage) {
                this.prevPage.addEventListener('click', () => {
                    if (this.state.page > 1) {
                        this.state.page--;
                        this.loadData();
                    }
                });
            }

            if (this.nextPage) {
                this.nextPage.addEventListener('click', () => {
                    if (this.state.page < this.state.totalPages) {
                        this.state.page++;
                        this.loadData();
                    }
                });
            }

            // 弹窗关闭事件
            if (this.editModal) {
                const closeBtn = this.editModal.querySelector('.modal-close');
                const cancelBtn = this.editModal.querySelector('#modalCancel');
                const overlay = this.editModal.querySelector('.modal-overlay');

                const closeModal = () => {
                    this.editModal.classList.remove('active');
                };

                if (closeBtn) closeBtn.addEventListener('click', closeModal);
                if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
                if (overlay) overlay.addEventListener('click', closeModal);

                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && this.editModal.classList.contains('active')) {
                        closeModal();
                    }
                });
            }

            // 重置密码按钮事件
            const resetPwdBtn = document.getElementById('resetPwdBtn');
            if (resetPwdBtn) {
                resetPwdBtn.addEventListener('click', () => {
                    const editIdInput = document.getElementById('editId');
                    if (editIdInput && editIdInput.value) {
                        this.handleResetPassword(editIdInput.value);
                    }
                });
            }

            // 保存按钮事件
            const modalSave = document.getElementById('modalSave');
            if (modalSave) {
                modalSave.addEventListener('click', () => {
                    const editIdInput = document.getElementById('editId');
                    if (editIdInput && editIdInput.value) {
                        this.handleSave(editIdInput.value);
                    }
                });
            }

            // 权限变更时控制志愿显示
            const roleSelect = document.getElementById('editRole');
            if (roleSelect) {
                roleSelect.addEventListener('change', () => {
                    const isCandidate = roleSelect.value === 'candidate';
                    this.toggleCandidateFields(isCandidate);
                });
            }
        }

        // ========== 切换面试者相关字段显示 ==========
        toggleCandidateFields(show) {
            const volunteerSection = document.getElementById('volunteerSection');
            if (volunteerSection) {
                volunteerSection.style.display = show ? 'block' : 'none';
            }
        }

        // ========== 加载数据 ==========
        async loadData() {
            const params = new URLSearchParams({
                page: this.state.page,
                page_size: this.state.pageSize,
                search: this.state.search,
                role: this.state.role,
                department: this.state.department,
                sort: this.state.sort,
                order: this.state.order
            });
            try {
                const response = await fetch(`${this.apiUrl}?${params}`);
                const result = await response.json();

                if (result.success) {
                    this.currentData = result.data;
                    this.state.total = result.total;
                    this.state.totalPages = result.total_pages;

                    this.renderTable(result.data);
                    this.updatePagination();
                    this.selectedIds.clear();
                } else {
                    if (this.tableBody) {
                        this.tableBody.innerHTML = '<tr><td colspan="8" class="loading-text">加载失败：' + (result.message || '未知错误') + '</td></tr>';
                    }
                }
            } catch (error) {
                console.error('加载数据失败:', error);
                if (this.tableBody) {
                    this.tableBody.innerHTML = '<tr><td colspan="8" class="loading-text">加载失败，请刷新重试</td></tr>';
                }
            }
        }

        // ========== 渲染表格 ==========
        renderTable(data) {
            if (!this.tableBody) return;

            if (!data || data.length === 0) {
                this.tableBody.innerHTML = '<tr><td colspan="8" class="loading-text">暂无数据</td></tr>';
                return;
            }

            let html = '';
            const startIndex = (this.state.page - 1) * this.state.pageSize + 1;

            data.forEach((item, index) => {
                const isSelected = this.selectedIds.has(item.id);
                const serialNum = startIndex + index;

                let statusDisplay = '/';
                if (item.role === 'candidate' && item.status) {
                    statusDisplay = item.status;
                }

                // ===== 构建部门显示 =====
                let departmentHtml = '-';
                if (item.role === 'candidate' && item.candidate) {
                    // 面试者：显示志愿部门
                    const vols = [];
                    if (item.candidate.volunteer_1) {
                        vols.push(item.candidate.volunteer_1.department_display || item.candidate.volunteer_1.department);
                    }
                    if (item.candidate.volunteer_2) {
                        vols.push(item.candidate.volunteer_2.department_display || item.candidate.volunteer_2.department);
                    }
                    if (item.candidate.volunteer_3) {
                        vols.push(item.candidate.volunteer_3.department_display || item.candidate.volunteer_3.department);
                    }
                    if (vols.length > 0) {
                        departmentHtml = vols.map(v => `<span class="volunteer-dept-tag">${this.escapeHtml(v)}</span>`).join(' ');
                    } else {
                        departmentHtml = '-';
                    }
                } else if (item.role === 'interviewer' && item.department) {
                    // 面试官：显示面试官部门
                    departmentHtml = `<span class="volunteer-dept-tag">${this.escapeHtml(item.department)}</span>`;
                } else if (item.department && item.department !== '-') {
                    departmentHtml = this.escapeHtml(item.department);
                }

                html += `
                    <tr style="cursor: pointer;" data-id="${item.id}">
                        <td style="text-align:center;"><input type="checkbox" class="row-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''}></td>
                        <td style="text-align:center;">${serialNum}</td>
                        <td><strong>${this.escapeHtml(item.display_name || item.username)}</strong></td>
                        <td>${this.escapeHtml(item.username)}</td>
                        <td>${departmentHtml}</td>
                        <td><span class="role-tag ${item.role_color}">${this.escapeHtml(item.role_display)}</span></td>
                        <td>${this.escapeHtml(statusDisplay)}</td>
                        <td style="text-align:center;">
                            <button class="btn btn-primary btn-sm edit-btn" data-id="${item.id}">编辑</button>
                        </td>
                    </tr>
                `;
            });

            this.tableBody.innerHTML = html;

            // 绑定行复选框事件
            document.querySelectorAll('.row-checkbox').forEach(cb => {
                cb.addEventListener('change', () => {
                    const id = parseInt(cb.dataset.id);
                    if (cb.checked) {
                        this.selectedIds.add(id);
                    } else {
                        this.selectedIds.delete(id);
                    }
                    this.updateSelectAllState();
                });
            });

            // 绑定编辑按钮事件
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    this.openEditModal(id);
                });
            });

            // 行点击打开编辑
            document.querySelectorAll('#tableBody tr').forEach(row => {
                row.addEventListener('click', function(e) {
                    if (e.target.closest('input') || e.target.closest('button')) return;
                    const id = parseInt(this.dataset.id);
                    if (id) {
                        const editBtn = this.querySelector('.edit-btn');
                        if (editBtn) editBtn.click();
                    }
                });
            });

            this.updateSelectAllState();
        }

        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        updatePagination() {
            const total = this.state.total;
            const page = this.state.page;
            const pageSize = this.state.pageSize;

            const start = (page - 1) * pageSize + 1;
            const end = Math.min(page * pageSize, total);

            if (this.pageStart) this.pageStart.textContent = total > 0 ? start : 0;
            if (this.pageEnd) this.pageEnd.textContent = end;
            if (this.pageTotal) this.pageTotal.textContent = total;
            if (this.totalCount) this.totalCount.textContent = total;
            if (this.currentPage) this.currentPage.textContent = page;
            if (this.totalPages) this.totalPages.textContent = this.state.totalPages;

            if (this.prevPage) this.prevPage.disabled = page <= 1;
            if (this.nextPage) this.nextPage.disabled = page >= this.state.totalPages;
        }

        updateSelectAllState() {
            const checkboxes = document.querySelectorAll('.row-checkbox');
            const checked = document.querySelectorAll('.row-checkbox:checked');

            if (this.checkAll) {
                this.checkAll.checked = checkboxes.length > 0 && checked.length === checkboxes.length;
                this.checkAll.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
            }
        }

        // ========== 打开编辑弹窗 ==========
        async openEditModal(id) {
            if (!this.editModal) return;
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) modalTitle.textContent = '编辑用户';

            try {
                const response = await fetch(`/api/addmin/users/${id}/`);
                const result = await response.json();

                if (result.success) {
                    this.fillEditForm(result.data);
                    this.editModal.classList.add('active');
                } else {
                    alert(result.message || '加载详情失败');
                }
            } catch (error) {
                console.error('加载详情失败:', error);
                alert('加载详情失败，请重试');
            }
        }

        // ========== 渲染单个志愿信息 ==========
        renderVolunteerItem(containerId, volunteer) {
            const container = document.getElementById(containerId);
            if (!container) return;

            // 如果没有志愿信息，显示空状态
            if (!volunteer || !volunteer.department) {
                container.innerHTML = '<span class="volunteer-empty">-</span>';
                return;
            }

            const isInQueue = volunteer.is_in_queue || false;
            const statusDisplay = volunteer.status_display || volunteer.status || '-';
            const queueTime = volunteer.queue_start_time ?
                new Date(volunteer.queue_start_time).toLocaleString('zh-CN') :
                null;

            // 状态样式映射
            let statusClass = volunteer.status ? volunteer.status.toLowerCase() : 'empty';
            const statusMap = {
                'filled': 'filled',
                'waiting': 'waiting',
                'inqueue' : 'inqueue',
                'interviewing': 'interviewing',
                'completed': 'completed',
                'rejected': 'rejected',
                'accepted': 'accepted'
            };
            statusClass = statusMap[statusClass] || 'empty';

            // 根据志愿状态生成操作按钮
            let actionsHtml = '';
            if (volunteer.status === 'WAITING') {
                if (isInQueue) {
                    actionsHtml = `
                        <button class="btn btn-sm btn-danger volunteer-action-btn"
                                data-volunteer-id="${volunteer.id}"
                                data-action="cancel_queue">取消排队</button>
                        <button class="btn btn-sm btn-warning volunteer-action-btn"
                                data-volunteer-id="${volunteer.id}"
                                data-action="requeue">重新排队</button>
                    `;
                } else {
                    actionsHtml = `
                        <button class="btn btn-sm btn-success volunteer-action-btn"
                                data-volunteer-id="${volunteer.id}"
                                data-action="start_queue">开始排队</button>
                    `;
                }
            } else if (volunteer.status === 'FILLED') {
                actionsHtml = `
                    <button class="btn btn-sm btn-success volunteer-action-btn"
                            data-volunteer-id="${volunteer.id}"
                            data-action="start_queue">开始排队</button>
                `;
            } else {
                actionsHtml = `<span class="volunteer-status-text">${this.escapeHtml(statusDisplay)}</span>`;
            }

            container.innerHTML = `
                <div class="volunteer-info-left">
                    <span class="volunteer-dept">${this.escapeHtml(volunteer.department_display || volunteer.department || '-')}</span>
                    <span class="volunteer-status ${statusClass}">${this.escapeHtml(statusDisplay)}</span>
                    ${isInQueue && queueTime ? `<span class="volunteer-queue-time">⏱ 排队中: ${queueTime}</span>` : ''}
                </div>
                <div class="volunteer-actions">
                    ${actionsHtml}
                </div>
            `;

            // 重新绑定志愿操作按钮事件
            container.querySelectorAll('.volunteer-action-btn').forEach(btn => {
                // 移除旧事件避免重复绑定
                btn.removeEventListener('click', this._volunteerHandler);
                this._volunteerHandler = (e) => {
                    e.stopPropagation();
                    const volunteerId = btn.dataset.volunteerId;
                    const action = btn.dataset.action;
                    if (volunteerId && action) {
                        this.handleVolunteerAction(volunteerId, action);
                    }
                };
                btn.addEventListener('click', this._volunteerHandler);
            });
        }

        // ========== 填充编辑表单 ==========
        fillEditForm(data) {
            const editId = document.getElementById('editId');
            if (editId) editId.value = data.id || '';

            const candidate = data.candidate || {};
            const interviewer = data.interviewer || {};

            // 用户基本信息
            const editDisplayName = document.getElementById('editDisplayName');
            if (editDisplayName) editDisplayName.value = data.display_name || data.username || '';

            const editGender = document.getElementById('editGender');
            if (editGender) editGender.value = candidate.gender || interviewer.gender ||'-';

            const editStudentNumber = document.getElementById('editStudentNumber');
            if (editStudentNumber) editStudentNumber.value = candidate.student_number || interviewer.student_number || '-';

            const editSchool = document.getElementById('editSchool');
            if (editSchool) editSchool.value = candidate.school || interviewer.department || '-';

            const editHomeroom = document.getElementById('editHomeroom');
            if (editHomeroom) editHomeroom.value = candidate.homeroom || interviewer.homeroom ||'-';

            const editPoliticalStatus = document.getElementById('editPoliticalStatus');
            if (editPoliticalStatus) editPoliticalStatus.value = candidate.political_status || interviewer.political_status||'-';

            const editTelephone = document.getElementById('editTelephone');
            if (editTelephone) editTelephone.value = candidate.telephone || interviewer.telephone || '-';

            const editUsername = document.getElementById('editUsername');
            if (editUsername) editUsername.value = data.username || '';

            // 面试状态（只读显示）
            const editStatusDisplay = document.getElementById('editStatusDisplay');
            if (editStatusDisplay) {
                editStatusDisplay.value = data.status || '/';
            }

            // ===== 判断是否为面试者 =====
            const isCandidate = data.role === 'candidate' || !!candidate.id;

            // ===== 渲染志愿信息 =====
            this.renderVolunteerItem('volunteer1', candidate.volunteer_1);
            this.renderVolunteerItem('volunteer2', candidate.volunteer_2);
            this.renderVolunteerItem('volunteer3', candidate.volunteer_3);

            // ===== 控制面试者相关字段显示 =====
            this.toggleCandidateFields(isCandidate);

            // ===== 权限选择 =====
            const roleSelect = document.getElementById('editRole');
            if (roleSelect) {
                const isSuperuser = window.isSuperuser || false;
                const isAdmin = window.isAdmin || false;

                let availableRoles = [];
                if (isSuperuser) {
                    availableRoles = [
                        {value: 'super_admin', label: '超级管理员'},
                        {value: 'admin', label: '主管理员'},
                        {value: 'subadmin', label: '部门管理员'},
                        {value: 'interviewer', label: '面试官'},
                        {value: 'candidate', label: '面试者'},
                        {value: 'guest', label: '访客'},
                    ];
                } else if (isAdmin) {
                    availableRoles = [
                        {value: 'subadmin', label: '部门管理员'},
                        {value: 'interviewer', label: '面试官'},
                        {value: 'candidate', label: '面试者'},
                        {value: 'guest', label: '访客'},
                    ];
                } else {
                    availableRoles = [{value: data.role, label: data.role_display}];
                    roleSelect.disabled = true;
                }

                roleSelect.innerHTML = '';
                availableRoles.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.label;
                    if (opt.value === data.role) {
                        option.selected = true;
                    }
                    roleSelect.appendChild(option);
                });
                if (!roleSelect.disabled) {
                    roleSelect.disabled = false;
                }
            }

            // ===== 激活状态（仅超级管理员可见） =====
            const activeSection = document.getElementById('activeSection');
            if (activeSection) {
                const isSuperuser = window.isSuperuser || false;
                if (isSuperuser) {
                    activeSection.style.display = 'block';
                    const editIsActive = document.getElementById('editIsActive');
                    if (editIsActive) {
                        editIsActive.checked = data.is_active || false;
                        editIsActive.disabled = false;
                    }
                } else {
                    activeSection.style.display = 'none';
                }
            }

            // ===== 重置密码区域 =====
            const resetPwdSection = document.getElementById('resetPwdSection');
            if (resetPwdSection) {
                const canResetPwd = window.isSuperuser || window.isAdmin || false;
                if (canResetPwd) {
                    resetPwdSection.style.display = 'block';
                    const editNewPassword = document.getElementById('editNewPassword');
                    if (editNewPassword) {
                        editNewPassword.value = '';
                    }
                } else {
                    resetPwdSection.style.display = 'none';
                }
            }
        }

        // ========== 处理志愿操作 ==========
        async handleVolunteerAction(volunteerId, action) {
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
                const response = await fetch(`/api/addmin/volunteer/${volunteerId}/action/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.getCSRFToken(),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        volunteer_id: volunteerId,
                        action: action
                    })
                });

                const result = await response.json();
                if (result.success) {
                    alert(result.message || `${actionLabel}成功`);

                    // 只更新弹窗中的志愿数据，不重新加载整个弹窗
                    if (result.data) {
                        // 获取当前弹窗中的候选数据
                        const editIdInput = document.getElementById('editId');
                        if (editIdInput && editIdInput.value) {
                            // 从当前显示的弹窗中获取数据并更新
                            const currentCandidate = this.currentEditData?.candidate || {};
                            const updatedVol = result.data;

                            // 查找并更新对应的志愿
                            ['volunteer_1', 'volunteer_2', 'volunteer_3'].forEach(key => {
                                const vol = currentCandidate[key];
                                if (vol && vol.id === updatedVol.id) {
                                    currentCandidate[key] = {
                                        ...vol,
                                        status: updatedVol.status,
                                        status_display: updatedVol.status_display,
                                        queue_start_time: updatedVol.queue_start_time,
                                        is_in_queue: updatedVol.is_in_queue,
                                    };
                                }
                            });

                            // 重新渲染三个志愿
                            this.renderVolunteerItem('volunteer1', currentCandidate.volunteer_1);
                            this.renderVolunteerItem('volunteer2', currentCandidate.volunteer_2);
                            this.renderVolunteerItem('volunteer3', currentCandidate.volunteer_3);
                        }
                    }

                    // 后台静默刷新表格数据
                    this.loadData();
                } else {
                    alert(result.message || `${actionLabel}失败`);
                }
            } catch (error) {
                console.error('志愿操作失败:', error);
                alert('操作失败，请重试');
            }
        }

        // ========== 收集表单数据 ==========
        collectEditForm() {
            const formData = {
                role: document.getElementById('editRole').value,
                is_active: null,
            };

            const isSuperuser = window.isSuperuser || false;
            if (isSuperuser) {
                const editIsActive = document.getElementById('editIsActive');
                if (editIsActive) {
                    formData.is_active = editIsActive.checked;
                }
            }

            return formData;
        }

        // ========== 保存 ==========
        async handleSave(id) {
            const formData = this.collectEditForm();

            if (!formData.role) {
                alert('请选择权限等级');
                return;
            }

            try {
                const response = await fetch(`/api/addmin/users/${id}/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.getCSRFToken(),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();
                if (result.success) {
                    if (this.editModal) {
                        this.editModal.classList.remove('active');
                    }
                    this.loadData();
                    alert(result.message || '更新成功');
                } else {
                    alert(result.message || '操作失败');
                }
            } catch (error) {
                console.error('保存失败:', error);
                alert('保存失败，请重试');
            }
        }

        // ========== 重置密码 ==========
        async handleResetPassword(userId) {
            const newPassword = prompt('请输入新密码（至少6位）：');
            if (newPassword === null) return;
            if (newPassword.length < 6) {
                alert('密码长度至少6位');
                return;
            }

            try {
                const response = await fetch(`/api/addmin/users/${userId}/reset-password/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.getCSRFToken(),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ new_password: newPassword })
                });

                const result = await response.json();
                if (result.success) {
                    alert(result.message || '密码重置成功');
                } else {
                    alert(result.message || '重置失败');
                }
            } catch (error) {
                console.error('重置密码失败:', error);
                alert('重置失败，请重试');
            }
        }

        // ========== 获取CSRF Token ==========
        getCSRFToken() {
            const token = document.querySelector('[name=csrfmiddlewaretoken]');
            return token ? token.value : '';
        }
    }

    if (document.getElementById('userTable')) {
        window.userManager = new UserManager();
    }
});