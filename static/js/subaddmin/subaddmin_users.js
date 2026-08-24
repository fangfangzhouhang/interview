// static/js/subadmin_users.js

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

    // ========== 部门用户管理 ==========
    class SubadminUserManager {
        constructor() {
            this.apiUrl = '/api/subaddmin/users/';
            this.department = window.userDepartment || '';
            this.currentUserId = window.currentUserId || null;

            this.tableBody = document.getElementById('tableBody');
            this.searchInput = document.getElementById('searchInput');
            this.clearSearchBtn = document.getElementById('clearSearchBtn');
            this.roleFilter = document.getElementById('roleFilter');
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
            this.selectedIds = new Set();
            this.currentEditData = null;

            this.state = {
                page: 1,
                pageSize: 10,
                search: '',
                role: '',
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
                const response = await fetch('/api/subaddmin/users/options/');
                const result = await response.json();

                if (result.success) {
                    this.roleOptions = result.roles || [];

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
            // 搜索
            if (this.searchInput) {
                let timer;
                this.searchInput.addEventListener('input', () => {
                    clearTimeout(timer);
                    timer = setTimeout(() => {
                        this.state.search = this.searchInput.value;
                        this.state.page = 1;
                        this.loadData();
                        this.toggleClearBtn();
                    }, 500);
                });
            }

            // 清除搜索
            if (this.clearSearchBtn) {
                this.clearSearchBtn.addEventListener('click', () => {
                    if (this.searchInput) {
                        this.searchInput.value = '';
                        this.state.search = '';
                        this.state.page = 1;
                        this.loadData();
                        this.clearSearchBtn.style.display = 'none';
                    }
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

            // 取消全选
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

            // 弹窗关闭
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

        // ========== 切换清除按钮 ==========
        toggleClearBtn() {
            if (this.clearSearchBtn) {
                if (this.searchInput && this.searchInput.value.length > 0) {
                    this.clearSearchBtn.style.display = 'block';
                } else {
                    this.clearSearchBtn.style.display = 'none';
                }
            }
        }

        // ========== 加载数据 ==========
        async loadData() {
            const params = new URLSearchParams({
                page: this.state.page,
                page_size: this.state.pageSize,
                search: this.state.search,
                role: this.state.role,
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
                    if (this.checkAll) this.checkAll.checked = false;
                } else {
                    this.tableBody.innerHTML = '<tr><td colspan="9" class="loading-text">加载失败：' + (result.message || '未知错误') + '</td></tr>';
                }
            } catch (error) {
                console.error('加载数据失败:', error);
                this.tableBody.innerHTML = '<tr><td colspan="9" class="loading-text">加载失败，请刷新重试</td></tr>';
            }
        }

        // ========== 渲染表格 ==========
        renderTable(data) {
            if (!data || data.length === 0) {
                this.tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="loading-text">暂无数据</td>
                    </tr>
                `;
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

            // 绑定复选框事件
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

            // 绑定编辑按钮
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    this.openEditModal(id);
                });
            });

            // 行点击事件
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

        // ========== HTML转义 ==========
        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // ========== 更新分页 ==========
        updatePagination() {
            const total = this.state.total;
            const page = this.state.page;
            const pageSize = this.state.pageSize;

            const start = total > 0 ? (page - 1) * pageSize + 1 : 0;
            const end = Math.min(page * pageSize, total);

            if (this.pageStart) this.pageStart.textContent = total > 0 ? start : 0;
            if (this.pageEnd) this.pageEnd.textContent = end;
            if (this.pageTotal) this.pageTotal.textContent = total;
            if (this.totalCount) this.totalCount.textContent = total;
            if (this.currentPage) this.currentPage.textContent = page;
            if (this.totalPages) this.totalPages.textContent = this.state.totalPages || 1;

            if (this.prevPage) this.prevPage.disabled = page <= 1;
            if (this.nextPage) this.nextPage.disabled = page >= (this.state.totalPages || 1);
        }

        // ========== 更新全选状态 ==========
        updateSelectAllState() {
            const checkboxes = document.querySelectorAll('.row-checkbox');
            const checked = document.querySelectorAll('.row-checkbox:checked');

            if (this.checkAll) {
                this.checkAll.checked = checkboxes.length > 0 && checked.length === checkboxes.length;
                this.checkAll.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
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
                'inqueue':'inqueue',
                'interviewing': 'interviewing',
                'completed': 'completed',
                'rejected': 'rejected',
                'accepted': 'accepted'
            };
            statusClass = statusMap[statusClass] || 'empty';

            // 根据志愿状态生成操作按钮
            let actionsHtml = '';
            // 部门管理员只能操作本部门志愿
            const canManage = this.department && volunteer.department === this.department;

            if (canManage) {
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

        // ========== 打开编辑弹窗 ==========
        async openEditModal(id) {
            if (!this.editModal) return;

            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) modalTitle.textContent = '编辑用户信息';

            // 显示加载状态
            const modalBody = this.editModal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = '<div class="loading-text">加载中...</div>';
            }
            this.editModal.classList.add('active');

            try {
                const response = await fetch(`/api/subaddmin/users/${id}/`);
                const result = await response.json();

                if (result.success) {
                    this.currentEditData = result.data;
                    this.renderEditForm(result.data);
                    this.editModal.classList.add('active');
                } else {
                    alert(result.message || '加载详情失败');
                    this.editModal.classList.remove('active');
                }
            } catch (error) {
                console.error('加载详情失败:', error);
                alert('加载详情失败，请重试');
                this.editModal.classList.remove('active');
            }
        }

        // ========== 渲染编辑表单 ==========
        renderEditForm(data) {
            const modalBody = this.editModal.querySelector('.modal-body');
            if (!modalBody) return;

            const candidate = data.candidate || {};
            const interviewer = data.interviewer || {};
            const isCandidate = data.role === 'candidate' || !!candidate.id;

            // 构建志愿信息HTML
            const volunteerHtml = `
                <div class="volunteer-item-row">
                    <div class="volunteer-item-label">第一志愿</div>
                    <div class="volunteer-item-content" id="volunteer1">-</div>
                </div>
                <div class="volunteer-item-row">
                    <div class="volunteer-item-label">第二志愿</div>
                    <div class="volunteer-item-content" id="volunteer2">-</div>
                </div>
                <div class="volunteer-item-row">
                    <div class="volunteer-item-label">第三志愿</div>
                    <div class="volunteer-item-content" id="volunteer3">-</div>
                </div>
            `;

            const statusDisplay = data.status || '/';

            modalBody.innerHTML = `
                <form id="editForm">
                    <input type="hidden" id="editId" value="${data.id || ''}">

                    <!-- 用户基本信息 -->
                    <div class="user-info-section">
                        <h4>📋 基本信息</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label>用户名</label>
                                <input type="text" id="editUsername" value="${this.escapeHtml(data.username || '')}" readonly>
                            </div>
                            <div class="form-group">
                                <label>姓名</label>
                                <input type="text" id="editDisplayName" value="${this.escapeHtml(data.display_name || data.username || '')}" readonly>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>性别</label>
                                <input type="text" id="editGender" value="${this.escapeHtml(candidate.gender || interviewer.gender || '-')}" readonly>
                            </div>
                            <div class="form-group">
                                <label>学号</label>
                                <input type="text" id="editStudentNumber" value="${this.escapeHtml(candidate.student_number || interviewer.student_number || '-')}" readonly>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>学院/部门</label>
                                <input type="text" id="editSchool" value="${this.escapeHtml(candidate.school || interviewer.department || '-')}" readonly>
                            </div>
                            <div class="form-group">
                                <label>班级/组别</label>
                                <input type="text" id="editHomeroom" value="${this.escapeHtml(candidate.homeroom || interviewer.homeroom || '-')}" readonly>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>政治面貌</label>
                                <input type="text" id="editPoliticalStatus" value="${this.escapeHtml(candidate.political_status || interviewer.political_status || '-')}" readonly>
                            </div>
                            <div class="form-group">
                                <label>手机号</label>
                                <input type="text" id="editTelephone" value="${this.escapeHtml(candidate.telephone || interviewer.telephone || '-')}" readonly>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>面试状态</label>
                                <input type="text" id="editStatusDisplay" value="${this.escapeHtml(statusDisplay)}" readonly>
                            </div>
                        </div>
                    </div>

                    <!-- 志愿信息 -->
                    <div class="user-info-section" id="volunteerSection" ${!isCandidate ? 'style="display:none;"' : ''}>
                        <h4>🎯 志愿信息</h4>
                        <div class="volunteers-list">
                            ${volunteerHtml}
                        </div>
                        <div class="volunteer-hint">
                            <span class="hint-text">💡 只有本部门的志愿可以进行排队操作</span>
                        </div>
                    </div>

                    <hr>

                    <!-- 权限设置 -->
                    <div class="form-group">
                        <label>权限等级 <span class="required">*</span></label>
                        <select id="editRole">
                            <option value="">请选择权限</option>
                        </select>
                        <span class="role-hint">部门管理员只能设置普通用户权限（面试官、面试者、访客）</span>
                    </div>
                </form>
            `;

            // 重新渲染下拉选项
            this.renderSelectOptions('editRole', this.roleOptions);

            // 设置角色选中值
            this.setRoleSelectValue(data.role);

            // 控制志愿区域显示
            this.toggleCandidateFields(isCandidate);

            // 渲染志愿信息
            if (isCandidate) {
                this.renderVolunteerItem('volunteer1', candidate.volunteer_1);
                this.renderVolunteerItem('volunteer2', candidate.volunteer_2);
                this.renderVolunteerItem('volunteer3', candidate.volunteer_3);
            }
        }

        // ========== 设置权限下拉选中值 ==========
        setRoleSelectValue(role) {
            const roleSelect = document.getElementById('editRole');
            if (!roleSelect) return;

            if (roleSelect.options.length <= 1) {
                this.renderSelectOptions('editRole', this.roleOptions);
            }

            // 检查当前用户是否在编辑自己
            const editId = document.getElementById('editId');
            if (editId && parseInt(editId.value) === this.currentUserId) {
                roleSelect.disabled = true;
                for (let opt of roleSelect.options) {
                    if (opt.value === role) {
                        opt.selected = true;
                        break;
                    }
                }
                const hint = document.querySelector('.role-hint');
                if (hint) hint.textContent = '⚠️ 不能修改自己的权限等级';
                return;
            }

            roleSelect.disabled = false;
            const hint = document.querySelector('.role-hint');
            if (hint) hint.textContent = '部门管理员只能设置普通用户权限（面试官、面试者、访客）';

            // 设置选中值
            let found = false;
            for (let opt of roleSelect.options) {
                if (opt.value === role) {
                    opt.selected = true;
                    found = true;
                    break;
                }
            }

            if (!found) {
                roleSelect.value = '';
            }

            // 如果是部门管理员角色，禁用该选项
            for (let opt of roleSelect.options) {
                if (opt.value === 'subadmin') {
                    opt.disabled = true;
                    opt.textContent = '部门管理员（不可选）';
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

            // 防呆：空 id 直接提示，不发请求避免 404 HTML 导致 response.json() 抛错
            const invalidId =
                volunteerId === undefined || volunteerId === null ||
                volunteerId === '' || String(volunteerId) === 'null' ||
                String(volunteerId) === 'undefined' ||
                (typeof volunteerId === 'number' && isNaN(volunteerId));
            if (invalidId) {
                alert(`无法${actionLabel}：该志愿尚未保存，请先让面试者在「个人中心」保存志愿信息后再操作。`);
                return;
            }

            if (!(await Modal.confirm(`确定要${actionLabel}吗？`))) {
                return;
            }

            try {
                const response = await fetch(`/api/subaddmin/volunteer/${volunteerId}/action/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.getCSRFToken(),
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({
                        volunteer_id: volunteerId,
                        action: action
                    })
                });

                const result = await response.json();
                if (result.success) {
                    alert(result.message || `${actionLabel}成功`);

                    // 更新弹窗中的志愿数据
                    if (result.data && this.currentEditData) {
                        const updatedVol = result.data;
                        const candidate = this.currentEditData.candidate || {};

                        // 查找并更新对应的志愿
                        ['volunteer_1', 'volunteer_2', 'volunteer_3'].forEach(key => {
                            const vol = candidate[key];
                            if (vol && vol.id === updatedVol.id) {
                                candidate[key] = {
                                    ...vol,
                                    status: updatedVol.status,
                                    status_display: updatedVol.status_display,
                                    queue_start_time: updatedVol.queue_start_time,
                                    is_in_queue: updatedVol.is_in_queue,
                                };
                            }
                        });

                        // 重新渲染三个志愿
                        this.renderVolunteerItem('volunteer1', candidate.volunteer_1);
                        this.renderVolunteerItem('volunteer2', candidate.volunteer_2);
                        this.renderVolunteerItem('volunteer3', candidate.volunteer_3);

                        // 更新面试状态显示
                        if (updatedVol.candidate_status) {
                            const statusDisplay = document.getElementById('editStatusDisplay');
                            if (statusDisplay) {
                                statusDisplay.value = updatedVol.candidate_status;
                            }
                        }
                    }

                    // 后台静默刷新表格数据
                    this.loadData();
                } else {
                    alert(result.message || `${actionLabel}失败`);
                }
            } catch (error) {
                console.error('志愿操作失败:', error);
                alert('操作失败，请稍后刷新重试');
            }
        }

        // ========== 收集表单数据 ==========
        collectEditForm() {
            return {
                role: document.getElementById('editRole').value,
            };
        }

        // ========== 保存 ==========
        async handleSave(id) {
            const formData = this.collectEditForm();

            if (!formData.role) {
                alert('请选择权限等级');
                return;
            }

            try {
                const response = await fetch(`/api/subaddmin/users/${id}/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.getCSRFToken(),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();
                if (result.success) {
                    this.editModal.classList.remove('active');
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

        // ========== 获取CSRF Token ==========
        getCSRFToken() {
            const token = document.querySelector('[name=csrfmiddlewaretoken]');
            return token ? token.value : '';
        }
    }

    // 初始化
    if (document.getElementById('userTable')) {
        window.subadminUserManager = new SubadminUserManager();
    }
});