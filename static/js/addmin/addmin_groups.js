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

    // ========== 面试场次管理 ==========
    class GroupManager {
        constructor() {
            this.apiUrl = '/api/addmin/groups/';
            this.tableBody = document.getElementById('tableBody');
            this.searchInput = document.getElementById('searchInput');
            this.departmentFilter = document.getElementById('departmentFilter');
            this.checkAll = document.getElementById('checkAll');
            this.selectAllBtn = document.getElementById('selectAllBtn');
            this.deselectAllBtn = document.getElementById('deselectAllBtn');
            this.addBtn = document.getElementById('addBtn');
            this.totalCount = document.getElementById('totalCount');
            this.pageStart = document.getElementById('pageStart');
            this.pageEnd = document.getElementById('pageEnd');
            this.pageTotal = document.getElementById('pageTotal');
            this.currentPage = document.getElementById('currentPage');
            this.totalPages = document.getElementById('totalPages');
            this.prevPage = document.getElementById('prevPage');
            this.nextPage = document.getElementById('nextPage');
            this.editModal = document.getElementById('editModal');

            // 缓存选项数据
            this.departmentOptions = [];
            this.statusOptions = [];
            this.interviewerOptions = [];

            this.selectedIds = new Set();
            this.isEditMode = false;
            this.state = {
                page: 1,
                pageSize: 10,
                search: '',
                department: '',
                sort: 'id',
                order: 'asc',
                total: 0,
                totalPages: 0
            };

            this.init();
        }

        async init() {
            // 先加载选项数据
            await this.loadOptions();
            // 再加载表格数据
            this.loadData();
            this.bindEvents();
        }

        // ========== 加载选项数据 ==========
        async loadOptions() {
            try {
                const response = await fetch('/api/addmin/groups/options/');
                const result = await response.json();

                if (result.success) {
                    this.departmentOptions = result.departments || [];
                    this.statusOptions = result.statuses || [];
                    this.interviewerOptions = result.interviewers || [];

                    // 渲染下拉选项
                    this.renderSelectOptions('editDepartment', this.departmentOptions);
                    this.renderSelectOptions('editStatus', this.statusOptions);
                    this.renderSelectOptions('editInterviewers', this.interviewerOptions, true);
                } else {
                    console.error('加载选项失败:', result.message);
                }
            } catch (error) {
                console.error('加载选项失败:', error);
            }
        }

        // ========== 渲染下拉选项 ==========
        renderSelectOptions(selectId, options, isMultiple = false) {
            const select = document.getElementById(selectId);
            if (!select) return;

            // 清空现有选项（保留可能的默认提示）
            select.innerHTML = '';

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

            // 如果是多选，设置大小
            if (isMultiple) {
                select.size = Math.min(options.length, 6);
                select.style.height = 'auto';
            }
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
                    }, 500);
                });
            }

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

            // 新增
            if (this.addBtn) {
                this.addBtn.addEventListener('click', () => {
                    this.openAddModal();
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

            // 添加面试官按钮（UI操作）
            const addInterviewerBtn = document.getElementById('addInterviewerBtn');
            if (addInterviewerBtn) {
                addInterviewerBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleAddInterviewer(e);
                });
            }

            // 添加面试者按钮（UI操作）
            const addCandidateBtn = document.getElementById('addCandidateBtn');
            if (addCandidateBtn) {
                addCandidateBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleAddCandidate(e);
                });
            }

            // ====== 部门变更时刷新面试者列表 ======
            const departmentSelect = document.getElementById('editDepartment');
            if (departmentSelect) {
                departmentSelect.addEventListener('change', () => {
                    this.loadAvailableCandidates();
                });
            }
        }

        // ========== 加载数据 ==========
        async loadData() {
            const params = new URLSearchParams({
                page: this.state.page,
                page_size: this.state.pageSize,
                search: this.state.search,
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
                    this.tableBody.innerHTML = '<tr><td colspan="10" class="loading-text">加载失败：' + (result.message || '未知错误') + '</td></tr>';
                }
            } catch (error) {
                console.error('加载数据失败:', error);
                this.tableBody.innerHTML = '<tr><td colspan="10" class="loading-text">加载失败，请刷新重试</td></tr>';
            }
        }

        // ========== 渲染表格 ==========
        renderTable(data) {
            if (!data || data.length === 0) {
                this.tableBody.innerHTML = '<tr><td colspan="10" class="loading-text">暂无数据</td></tr>';
                return;
            }

            let html = '';
            data.forEach(item => {
                const isSelected = this.selectedIds.has(item.id);
                const statusClass = this.getStatusClass(item.status_code);
                const interviewerNames = item.interviewers ? item.interviewers.map(i => i.name).join(', ') : '';
                const candidateNames = item.candidates ? item.candidates.map(c => c.name).join(', ') : '';
                const groupDisplay = item.group_id && item.group_id !== '未设置'
                    ? item.group_id
                    : `${item.department_code || 'UNK'}${item.id}`;
                html += `
                    <tr style="cursor: pointer;" data-id="${item.id}">
                        <td><input type="checkbox" class="row-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''}></td>
                        <td>${item.id}</td>
                        <td>${groupDisplay}</td>
                        <td><span class="department-tag">${item.department}</span></td>
                        <td>${candidateNames || '无'}</td>
                        <td><span class="status-tag ${statusClass}">${item.status}</span></td>
                        <td>${interviewerNames || '无'}</td>
                        <td>${item.interviewer_count || 0}</td>
                        <td>${item.candidate_count || 0}</td>
                        <td>
                            <button class="btn btn-primary btn-sm edit-btn" data-id="${item.id}">编辑</button>
                            <button class="btn btn-danger btn-sm delete-btn" data-id="${item.id}">取消</button>
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

            // 绑定编辑按钮
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = parseInt(btn.dataset.id);
                    this.openEditModal(id);
                });
            });

            // 绑定单个删除按钮
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = parseInt(btn.dataset.id);
                    this.handleSingleDelete(id);
                });
            });

            this.updateSelectAllState();
        }

        getStatusClass(status) {
            const map = {
                'PENDING': 'status-pending',
                'ONGOING': 'status-ongoing',
                'PAUSE': 'status-pause',
                'ENDED': 'status-ended',
                'CANCELLED': 'status-cancelled'
            };
            return map[status] || '';
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

        // ========== 打开新增弹窗 ==========
        openAddModal() {
            this.isEditMode = false;
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) modalTitle.textContent = '新增场次';

            this.clearEditForm();

            // 设置默认状态为待开始
            const statusSelect = document.getElementById('editStatus');
            if (statusSelect) {
                for (let opt of statusSelect.options) {
                    if (opt.value === 'PENDING') {
                        opt.selected = true;
                        break;
                    }
                }
            }

            // 设置面试时间为当前时间
            const dateInput = document.getElementById('editInterviewDate');
            if (dateInput) {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                dateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
            }

            // 清空面试者列表
            const candidatesList = document.getElementById('candidatesList');
            if (candidatesList) {
                candidatesList.innerHTML = '<div class="empty-hint">暂无关联面试者</div>';
            }

            // 清空面试官列表
            const interviewersList = document.getElementById('interviewersList');
            if (interviewersList) {
                interviewersList.innerHTML = '<div class="empty-hint">暂无关联面试官</div>';
            }

            // 加载可用面试者和面试官
            this.loadAvailableCandidates();
            this.loadAllInterviewers();

            this.editModal.classList.add('active');

            const saveBtn = this.editModal.querySelector('#modalSave');
            if (saveBtn) {
                saveBtn.onclick = () => this.handleSave();
            }
        }

        // ========== 打开编辑弹窗 ==========
        async openEditModal(id) {
            if (!this.editModal) return;
            this.isEditMode = true;
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) modalTitle.textContent = '编辑场次信息';

            try {
                const response = await fetch(`/api/addmin/groups/${id}/`);
                const result = await response.json();

                if (result.success) {
                    this.fillEditForm(result.data);
                    this.editModal.classList.add('active');

                    // 加载面试者列表
                    await this.loadGroupCandidates(id);
                    await this.loadAvailableCandidates();
                    // 加载面试官列表
                    await this.loadGroupInterviewers(id);
                    await this.loadAllInterviewers();

                    const saveBtn = this.editModal.querySelector('#modalSave');
                    if (saveBtn) {
                        saveBtn.onclick = () => this.handleSave(id);
                    }
                } else {
                    alert(result.message || '加载详情失败');
                }
            } catch (error) {
                console.error('加载详情失败:', error);
                alert('加载详情失败，请重试');
            }
        }

        // ========== 填充编辑表单 ==========
        fillEditForm(data) {
            // 确保先设置 id 到隐藏域
            document.getElementById('editId').value = data.id || '';
            document.getElementById('editGroupId').value = data.group_id || '';

            // 设置部门
            const deptSelect = document.getElementById('editDepartment');
            if (deptSelect && data.department_code) {
                for (let opt of deptSelect.options) {
                    if (opt.value === data.department_code) {
                        opt.selected = true;
                        break;
                    }
                }
            }

            // 设置状态
            const statusSelect = document.getElementById('editStatus');
            if (statusSelect && data.status_code) {
                for (let opt of statusSelect.options) {
                    if (opt.value === data.status_code) {
                        opt.selected = true;
                        break;
                    }
                }
            }

            // 设置关联面试官（多选）
            const interviewerSelect = document.getElementById('editInterviewers');
            if (interviewerSelect && data.interviewer_ids) {
                const selectedIds = data.interviewer_ids || [];
                for (let opt of interviewerSelect.options) {
                    opt.selected = selectedIds.includes(parseInt(opt.value));
                }
            }

            // 设置面试时间
            const dateInput = document.getElementById('editInterviewDate');
            if (dateInput && data.interview_date) {
                dateInput.value = data.interview_date.replace(' ', 'T');
            }

            // 隐藏字段不需要填充（基本题1、基本题2、抢答题）

            // 加载面试者列表（根据当前部门）
            this.loadAvailableCandidates();
        }

        // ========== 清空表单 ==========
        clearEditForm() {
            document.getElementById('editId').value = '';
            document.getElementById('editGroupId').value = '';

            // 清空多选
            const interviewerSelect = document.getElementById('editInterviewers');
            if (interviewerSelect) {
                for (let opt of interviewerSelect.options) {
                    opt.selected = false;
                }
            }

            // 清空日期
            document.getElementById('editInterviewDate').value = '';

            // 隐藏字段不处理
        }

        // ========== 收集表单数据 ==========
        collectEditForm() {
            // 从已关联的面试官列表中获取面试官ID
            const interviewerItems = document.querySelectorAll('#interviewersList .interviewer-item');
            const selectedInterviewers = [];
            interviewerItems.forEach(item => {
                const id = parseInt(item.dataset.id);
                if (id) {
                    selectedInterviewers.push(id);
                }
            });

            // 从已关联的面试者列表中获取面试者数据
            const candidateItems = document.querySelectorAll('#candidatesList .candidate-item');
            const candidates = [];
            candidateItems.forEach(item => {
                const candidateId = parseInt(item.dataset.candidateId);
                const orderSelect = item.querySelector('.order-select');
                const order = orderSelect ? parseInt(orderSelect.value) : 0;
                if (candidateId && order) {
                    candidates.push({
                        candidate_id: candidateId,
                        order: order
                    });
                }
            });

            return {
                group_id: document.getElementById('editGroupId').value,
                department: document.getElementById('editDepartment').value,
                status: document.getElementById('editStatus').value,
                interview_date: document.getElementById('editInterviewDate').value,
                interviewer_ids: selectedInterviewers,
                candidates: candidates,
                basic_question1: '',
                basic_question2: '',
                rush_question: ''
            };
        }

        // ========== 保存 ==========
        async handleSave(id) {
            const formData = this.collectEditForm();
            const url = id ? `/api/addmin/groups/${id}/` : '/api/addmin/groups/create/';
            const method = 'POST';

            // 验证部门
            if (!formData.department) {
                alert('请选择部门');
                return;
            }

            // 验证面试官
            if (formData.interviewer_ids.length === 0) {
                alert('请至少选择一个面试官');
                return;
            }

            // 如果组别为空，自动生成
            if (!formData.group_id || !formData.group_id.trim()) {
                const deptCode = formData.department || 'UNK';
                if (id) {
                    formData.group_id = `${deptCode}${id}`;
                } else {
                    formData.group_id = '';
                }
            }

            try {
                const response = await fetch(url, {
                    method: method,
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
                    alert(result.message || (id ? '更新成功' : '创建成功'));
                } else {
                    alert(result.message || '操作失败');
                }
            } catch (error) {
                console.error('保存失败:', error);
                alert('保存失败，请重试');
            }
        }

        // ========== 单个删除 ==========
        async handleSingleDelete(id) {
            if (!confirm('确定要取消这个场次吗？')) return;

            try {
                const response = await fetch(`/api/addmin/groups/${id}/delete/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.getCSRFToken(),
                        'Content-Type': 'application/json',
                    }
                });

                const result = await response.json();
                if (result.success) {
                    this.loadData();
                    alert('取消成功');
                } else {
                    alert(result.message || '取消失败');
                }
            } catch (error) {
                console.error('取消失败:', error);
                alert('取消失败，请重试');
            }
        }

        // ========== 获取CSRF Token ==========
        getCSRFToken() {
            const token = document.querySelector('[name=csrfmiddlewaretoken]');
            return token ? token.value : '';
        }

        // ========== 加载可用的面试者列表 ==========
        async loadAvailableCandidates() {
            try {
                // 获取当前选中的部门
                const departmentSelect = document.getElementById('editDepartment');
                const department = departmentSelect ? departmentSelect.value : '';

                if (!department) {
                    // 如果没有选择部门，清空下拉列表并提示
                    const select = document.getElementById('candidateSelect');
                    if (select) {
                        select.innerHTML = '<option value="">-- 请先选择部门 --</option>';
                    }
                    return;
                }

                const response = await fetch(`/api/addmin/candidates/all/?department=${department}`);
                const result = await response.json();

                if (result.success) {
                    const select = document.getElementById('candidateSelect');
                    if (!select) return;

                    // 获取当前已关联的面试者ID
                    const existingItems = document.querySelectorAll('#candidatesList .candidate-item');
                    const existingIds = new Set();
                    existingItems.forEach(item => {
                        let id = item.dataset.candidateId;
                        if (!id) {
                            id = item.dataset.id;
                        }
                        if (id) {
                            existingIds.add(parseInt(id));
                        }
                    });

                    // 清空下拉列表，保留第一个空选项
                    select.innerHTML = '<option value="">-- 选择面试者 --</option>';

                    // 只添加未关联的面试者
                    result.data.forEach(candidate => {
                        if (!existingIds.has(candidate.id)) {
                            const option = document.createElement('option');
                            option.value = candidate.id;
                            const depts = candidate.volunteer_departments || [];
                            const deptStr = depts.length > 0 ? depts.join(', ') : '';
                            option.textContent = `${candidate.name} (${candidate.student_number}) - ${candidate.school} [志愿: ${deptStr}]`;
                            select.appendChild(option);
                        }
                    });

                    // 如果没有可用的面试者，显示提示
                    if (select.options.length === 1) {
                        const emptyOption = document.createElement('option');
                        emptyOption.value = '';
                        emptyOption.textContent = '该部门暂无可用面试者';
                        select.appendChild(emptyOption);
                    }
                }
            } catch (error) {
                console.error('加载面试者列表失败:', error);
            }
        }

        // ========== 加载场次关联的面试者 ==========
        async loadGroupCandidates(groupId) {
            if (!groupId) {
                groupId = document.getElementById('editId').value;
            }

            if (!groupId) {
                console.warn('没有找到场次ID，无法加载面试者列表');
                return;
            }

            try {
                const response = await fetch(`/api/addmin/groups/${groupId}/candidates/`);
                const result = await response.json();

                if (result.success) {
                    this.renderCandidates(result.data);
                } else {
                    console.error('加载场次面试者失败:', result.message);
                }
            } catch (error) {
                console.error('加载场次面试者失败:', error);
            }
        }

        // ========== 渲染面试者列表 ==========
        renderCandidates(candidates) {
            const container = document.getElementById('candidatesList');
            if (!container) return;

            if (!candidates || candidates.length === 0) {
                container.innerHTML = '<div class="empty-hint">暂无关联面试者</div>';
                this.loadAvailableCandidates();
                return;
            }

            // 按顺序排序
            candidates.sort((a, b) => a.order - b.order);

            let html = '';
            candidates.forEach(cig => {
                let orderOptions = '';
                for (let i = 1; i <= 6; i++) {
                    const selected = i === cig.order ? 'selected' : '';
                    orderOptions += `<option value="${i}" ${selected}>${i}</option>`;
                }

                html += `
                    <div class="candidate-item" data-id="${cig.id}" data-candidate-id="${cig.candidate_id}" data-order="${cig.order}">
                        <div class="candidate-info">
                            <div class="candidate-order">
                                序号：
                                <select class="order-select" data-id="${cig.id}">
                                    ${orderOptions}
                                </select>
                            </div>
                            <span class="candidate-name">${cig.name}</span>
                            <span class="candidate-detail">${cig.student_number}</span>
                            <span class="candidate-detail">${cig.school}</span>
                        </div>
                        <button type="button" class="remove-btn" data-id="${cig.id}" data-candidate-id="${cig.candidate_id}" title="移除">×</button>
                    </div>
                `;
            });

            container.innerHTML = html;

            // 绑定序号变更事件
            container.querySelectorAll('.order-select').forEach((select) => {
                select.addEventListener('change', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleOrderChangeInUI(select);
                });
            });

            // 绑定移除事件
            container.querySelectorAll('.remove-btn').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const candidateId = parseInt(btn.dataset.candidateId);
                    this.handleRemoveCandidateFromUI(candidateId);
                });
            });

            // 刷新下拉列表
            this.loadAvailableCandidates();
        }

        // ========== 处理序号变更（仅UI操作） ==========
        handleOrderChangeInUI(select) {
            const candidateId = select.dataset.id;
            const newOrder = parseInt(select.value);
            const container = document.getElementById('candidatesList');
            const items = container.querySelectorAll('.candidate-item');

            // 查找占用该序号的项
            let occupiedItem = null;
            items.forEach(item => {
                const itemCandidateId = item.dataset.candidateId;
                const orderSelect = item.querySelector('.order-select');
                if (itemCandidateId !== candidateId && parseInt(orderSelect.value) === newOrder) {
                    occupiedItem = item;
                }
            });

            if (occupiedItem) {
                const currentItem = container.querySelector(`.candidate-item[data-id="${candidateId}"]`);
                const oldOrder = currentItem ? parseInt(currentItem.dataset.order) || 1 : 1;
                const occupiedSelect = occupiedItem.querySelector('.order-select');
                occupiedSelect.value = oldOrder;
                occupiedItem.dataset.order = oldOrder;
                if (currentItem) {
                    currentItem.dataset.order = newOrder;
                }
            } else {
                const currentItem = container.querySelector(`.candidate-item[data-id="${candidateId}"]`);
                if (currentItem) {
                    currentItem.dataset.order = newOrder;
                }
            }
        }

        // ========== 处理移除面试者（仅UI操作） ==========
        handleRemoveCandidateFromUI(candidateId) {
            const container = document.getElementById('candidatesList');
            if (!container) {
                console.error('candidatesList 不存在');
                return;
            }

            const item = container.querySelector(`.candidate-item[data-candidate-id="${candidateId}"]`);
            if (!item) {
                console.warn('未找到要移除的面试者元素');
                return;
            }

            // 获取面试者显示名称
            const nameSpan = item.querySelector('.candidate-name');
            const detailSpan = item.querySelector('.candidate-detail');
            const candidateName = nameSpan ? nameSpan.textContent : '';
            const studentNumber = detailSpan ? detailSpan.textContent : '';
            const school = item.querySelectorAll('.candidate-detail')[1] ? item.querySelectorAll('.candidate-detail')[1].textContent : '';

            // 从列表中移除
            item.remove();

            // 重新调整序号
            const items = container.querySelectorAll('.candidate-item');
            items.forEach((item, index) => {
                const orderSelect = item.querySelector('.order-select');
                if (orderSelect) {
                    orderSelect.value = index + 1;
                    item.dataset.order = index + 1;
                }
            });

            // 如果列表为空，显示提示
            if (container.children.length === 0) {
                container.innerHTML = '<div class="empty-hint">暂无关联面试者</div>';
            }

            // 将删除的面试者加回下拉列表
            const select = document.getElementById('candidateSelect');
            if (select) {
                if (select.options.length === 1 && select.options[0].value === '' && select.options[0].textContent === '所有面试者已添加') {
                    select.options[0].remove();
                }

                let exists = false;
                for (let i = 0; i < select.options.length; i++) {
                    if (parseInt(select.options[i].value) === parseInt(candidateId)) {
                        exists = true;
                        break;
                    }
                }

                if (!exists) {
                    const displayText = `${candidateName} (${studentNumber}) - ${school}`;
                    const option = document.createElement('option');
                    option.value = candidateId;
                    option.textContent = displayText;
                    select.appendChild(option);
                }
            }
        }

        // ========== 处理添加面试者（仅UI操作） ==========
        handleAddCandidate(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            const select = document.getElementById('candidateSelect');
            const selectedOption = select.options[select.selectedIndex];
            const candidateId = select.value;
            const candidateText = selectedOption ? selectedOption.text : '';

            if (!candidateId) {
                alert('请选择面试者');
                return;
            }

            // 检查是否已添加
            const existingItems = document.querySelectorAll('#candidatesList .candidate-item');
            let exists = false;
            existingItems.forEach(item => {
                const itemCandidateId = parseInt(item.dataset.candidateId);
                if (itemCandidateId === parseInt(candidateId)) {
                    exists = true;
                }
            });

            if (exists) {
                alert('该面试者已添加');
                return;
            }

            // 检查是否已满
            if (existingItems.length >= 6) {
                alert('最多添加6名面试者');
                return;
            }

            // 获取当前最大序号
            let maxOrder = 0;
            existingItems.forEach(item => {
                const orderSelect = item.querySelector('.order-select');
                if (orderSelect) {
                    const order = parseInt(orderSelect.value);
                    if (order > maxOrder) maxOrder = order;
                }
            });
            const newOrder = maxOrder + 1;

            // 添加到UI列表
            const container = document.getElementById('candidatesList');
            const emptyHint = container.querySelector('.empty-hint');
            if (emptyHint) {
                container.innerHTML = '';
            }

            let orderOptions = '';
            for (let i = 1; i <= 6; i++) {
                const selected = i === newOrder ? 'selected' : '';
                orderOptions += `<option value="${i}" ${selected}>${i}</option>`;
            }

            const itemHtml = `
                <div class="candidate-item" data-id="${candidateId}" data-candidate-id="${candidateId}" data-order="${newOrder}">
                    <div class="candidate-info">
                        <div class="candidate-order">
                            序号：
                            <select class="order-select" data-id="${candidateId}">
                                ${orderOptions}
                            </select>
                        </div>
                        <span class="candidate-name">${candidateText}</span>
                    </div>
                    <button type="button" class="remove-btn" data-id="${candidateId}" data-candidate-id="${candidateId}" title="移除">×</button>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', itemHtml);

            // 绑定事件
            const newItem = container.querySelector(`.candidate-item[data-candidate-id="${candidateId}"]`);
            if (newItem) {
                const orderSelect = newItem.querySelector('.order-select');
                orderSelect.addEventListener('change', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleOrderChangeInUI(orderSelect);
                });

                const removeBtn = newItem.querySelector('.remove-btn');
                removeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleRemoveCandidateFromUI(candidateId);
                });
            }

            // 从下拉列表中移除已选的
            this.loadAvailableCandidates();
        }

        // ========== 加载所有面试官列表 ==========
        async loadAllInterviewers() {
            try {
                const response = await fetch('/api/addmin/interviewers/all/');
                const result = await response.json();

                if (result.success) {
                    const select = document.getElementById('interviewerSelect');
                    if (!select) return;

                    // 获取当前已关联的面试官ID
                    const existingItems = document.querySelectorAll('#interviewersList .interviewer-item');
                    const existingIds = new Set();
                    existingItems.forEach(item => {
                        existingIds.add(parseInt(item.dataset.id));
                    });

                    select.innerHTML = '<option value="">-- 选择面试官 --</option>';

                    // 只添加未关联的面试官
                    result.data.forEach(interviewer => {
                        if (!existingIds.has(interviewer.id)) {
                            const option = document.createElement('option');
                            option.value = interviewer.id;
                            option.textContent = `${interviewer.department} - ${interviewer.name}`;
                            select.appendChild(option);
                        }
                    });

                    // 如果没有可用的面试官，显示提示
                    if (select.options.length === 1) {
                        const emptyOption = document.createElement('option');
                        emptyOption.value = '';
                        emptyOption.textContent = '所有面试官已添加';
                        select.appendChild(emptyOption);
                    }
                }
            } catch (error) {
                console.error('加载面试官列表失败:', error);
            }
        }

        // ========== 加载场次关联的面试官 ==========
        async loadGroupInterviewers(groupId) {
            if (!groupId) {
                groupId = document.getElementById('editId').value;
            }

            if (!groupId) {
                console.warn('没有找到场次ID，无法加载面试官列表');
                return;
            }

            try {
                const response = await fetch(`/api/addmin/groups/${groupId}/interviewers/`);
                const result = await response.json();

                if (result.success) {
                    this.renderInterviewers(result.data);
                } else {
                    console.error('加载场次面试官失败:', result.message);
                }
            } catch (error) {
                console.error('加载场次面试官失败:', error);
            }
        }

        // ========== 渲染面试官列表 ==========
        renderInterviewers(interviewers) {
            const container = document.getElementById('interviewersList');
            if (!container) return;

            if (!interviewers || interviewers.length === 0) {
                container.innerHTML = '<div class="empty-hint">暂无关联面试官</div>';
                return;
            }

            let html = '';
            interviewers.forEach(interviewer => {
                html += `
                    <div class="interviewer-item" data-id="${interviewer.id}">
                        <div class="interviewer-info">
                            <span class="interviewer-name">${interviewer.name}</span>
                            <span class="interviewer-detail">${interviewer.department}</span>
                        </div>
                        <button type="button" class="remove-btn" data-id="${interviewer.id}" title="移除">×</button>
                    </div>
                `;
            });

            container.innerHTML = html;

            container.querySelectorAll('.remove-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    this.handleRemoveInterviewerFromUI(id);
                });
            });
        }

        // ========== 处理添加面试官（仅UI操作） ==========
        handleAddInterviewer(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            const select = document.getElementById('interviewerSelect');
            const selectedOption = select.options[select.selectedIndex];
            const interviewerId = select.value;
            const interviewerName = selectedOption ? selectedOption.text : '';

            if (!interviewerId) {
                alert('请选择面试官');
                return;
            }

            const existingItems = document.querySelectorAll('#interviewersList .interviewer-item');
            let exists = false;
            existingItems.forEach(item => {
                if (parseInt(item.dataset.id) === parseInt(interviewerId)) {
                    exists = true;
                }
            });

            if (exists) {
                alert('该面试官已添加');
                return;
            }

            const container = document.getElementById('interviewersList');
            const emptyHint = container.querySelector('.empty-hint');
            if (emptyHint) {
                container.innerHTML = '';
            }

            const itemHtml = `
                <div class="interviewer-item" data-id="${interviewerId}">
                    <div class="interviewer-info">
                        <span class="interviewer-name">${interviewerName}</span>
                    </div>
                    <button type="button" class="remove-btn" data-id="${interviewerId}" title="移除">×</button>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', itemHtml);

            const newItem = container.querySelector(`.interviewer-item[data-id="${interviewerId}"]`);
            if (newItem) {
                const removeBtn = newItem.querySelector('.remove-btn');
                removeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleRemoveInterviewerFromUI(removeBtn.dataset.id);
                });
            }

            this.loadAllInterviewers();
        }

        // ========== 处理移除面试官（仅UI操作） ==========
        handleRemoveInterviewerFromUI(interviewerId) {
            const container = document.getElementById('interviewersList');
            const item = container.querySelector(`.interviewer-item[data-id="${interviewerId}"]`);
            if (item) {
                item.remove();
            }

            if (container.children.length === 0) {
                container.innerHTML = '<div class="empty-hint">暂无关联面试官</div>';
            }

            this.loadAllInterviewers();
        }
    }

    // 初始化面试场次管理
    if (document.getElementById('groupTable')) {
        new GroupManager();
    }
});