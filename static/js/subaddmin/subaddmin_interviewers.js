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

    // 获取当前部门
    const userDepartment = window.userDepartment || '';

    // ========== 面试官分组管理 ==========
    class SubGroupManager {
        constructor() {
            this.apiUrl = '/api/subaddmin/interviewer-groups/';
            this.tableBody = document.getElementById('tableBody');
            this.searchInput = document.getElementById('searchInput');
            this.statusFilter = document.getElementById('statusFilter');
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

            this.departmentOptions = [];
            this.statusOptions = [];
            this.interviewerOptions = [];
            this.allInterviewers = [];

            this.selectedIds = new Set();
            this.isEditMode = false;
            this.currentGroupId = null;
            this.state = {
                page: 1,
                pageSize: 10,
                search: '',
                status: 'ONUSE',
                sort: 'id',
                order: 'asc',
                total: 0,
                totalPages: 0
            };

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
                const response = await fetch(`/api/subaddmin/interviewer-groups/options/`);
                const result = await response.json();

                if (result.success) {
                    this.departmentOptions = result.departments || [];
                    this.statusOptions = result.statuses || [];
                    this.interviewerOptions = result.interviewers || [];
                    this.allInterviewers = result.interviewers || [];

                    this.renderSelectOptions('editDepartment', this.departmentOptions);
                    this.renderSelectOptions('editStatus', this.statusOptions);
                } else {
                    console.error('加载选项失败:', result.message);
                }
            } catch (error) {
                console.error('加载选项失败:', error);
            }
        }

        // ========== 渲染下拉选项 ==========
        renderSelectOptions(selectId, options) {
            const select = document.getElementById(selectId);
            if (!select) return;

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
        }

        // ========== 绑定事件 ==========
        bindEvents() {
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

            if (this.statusFilter) {
                this.statusFilter.value = 'ONUSE';
                this.statusFilter.addEventListener('change', () => {
                    this.state.status = this.statusFilter.value;
                    this.state.page = 1;
                    this.loadData();
                });
            }

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

            if (this.addBtn) {
                this.addBtn.addEventListener('click', () => {
                    this.openAddModal();
                });
            }

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

            const deptSelect = document.getElementById('editDepartment');
            if (deptSelect) {
                deptSelect.addEventListener('change', () => {
                    this.updateMemberSelect();
                    this.updateChiefSelect();
                });
            }

            const addMemberBtn = document.getElementById('addMemberBtn');
            if (addMemberBtn) {
                addMemberBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleAddMember(e);
                });
            }
        }

        // ========== 加载数据 ==========
        async loadData() {
            const params = new URLSearchParams({
                page: this.state.page,
                page_size: this.state.pageSize,
                search: this.state.search,
                status: this.state.status,
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
                this.tableBody.innerHTML = '<tr><td colspan="9" class="loading-text">暂无数据</td></tr>';
                return;
            }

            let html = '';
            data.forEach(item => {
                const isSelected = this.selectedIds.has(item.id);
                const statusClass = this.getStatusClass(item.status_code);
                const isOnuse = item.status_code === 'ONUSE';
                const isWorking = item.status_code === 'WORKING';
                const canEdit = !isWorking;
                const canDestroy = isOnuse;

                html += `
                    <tr style="cursor: pointer;" data-id="${item.id}">
                        <td><input type="checkbox" class="row-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''} ${isWorking ? 'disabled' : ''}></td>
                        <td>${item.id}</td>
                        <td>${item.name}</td>
                        <td><span class="department-tag">${item.department}</span></td>
                        <td><strong>${item.chief}</strong></td>
                        <td>${item.member_names || '无'}</td>
                        <td><span class="status-tag ${statusClass}">${item.status}</span></td>
                        <td>${item.member_count || 0}</td>
                        <td>
                            ${canEdit ? `<button class="btn btn-primary btn-sm edit-btn" data-id="${item.id}">编辑</button>` : `<button class="btn btn-secondary btn-sm" disabled>工作中</button>`}
                            ${canDestroy ? `<button class="btn btn-warning btn-sm destroy-btn" data-id="${item.id}">销毁</button>` : ''}
                        </td>
                    </tr>
                `;
            });

            this.tableBody.innerHTML = html;

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

            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    this.openEditModal(id);
                });
            });

            document.querySelectorAll('.destroy-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    this.handleSingleDestroy(id);
                });
            });

            document.querySelectorAll('#tableBody tr').forEach(row => {
                row.addEventListener('click', function(e) {
                    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
                    const id = parseInt(this.dataset.id);
                    if (id) {
                        const editBtn = this.querySelector('.edit-btn');
                        if (editBtn && !editBtn.disabled) {
                            editBtn.click();
                        } else {
                            const statusTag = this.querySelector('.status-tag');
                            if (statusTag && statusTag.textContent.includes('工作中')) {
                                alert('该分组处于工作中状态，不可编辑');
                            }
                        }
                    }
                });
            });

            this.updateSelectAllState();
        }

        getStatusClass(status) {
            const map = {
                'ONUSE': 'status-onuse',
                'WORKING': 'status-working',
                'ENDED': 'status-ended'
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
            const checkboxes = document.querySelectorAll('.row-checkbox:not([disabled])');
            const checked = document.querySelectorAll('.row-checkbox:checked:not([disabled])');

            if (this.checkAll) {
                this.checkAll.checked = checkboxes.length > 0 && checked.length === checkboxes.length;
                this.checkAll.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
            }
        }

        // ========== 打开新增弹窗 ==========
        openAddModal() {
            this.isEditMode = false;
            this.currentGroupId = null;
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) modalTitle.textContent = '新增分组';

            this.clearEditForm();

            document.getElementById('editCreatedAt').value = '';

            const statusSelect = document.getElementById('editStatus');
            if (statusSelect) {
                for (let opt of statusSelect.options) {
                    if (opt.value === 'ONUSE') {
                        opt.selected = true;
                        break;
                    }
                }
            }

            const deptSelect = document.getElementById('editDepartment');
            if (deptSelect && userDepartment) {
                deptSelect.value = userDepartment;
                deptSelect.disabled = true;
            }

            document.getElementById('membersList').innerHTML = '<div class="empty-hint">暂无成员</div>';
            document.getElementById('memberSelect').innerHTML = '<option value="">-- 选择面试官 --</option>';
            document.getElementById('editChief').innerHTML = '<option value="">-- 选择主面试官 --</option>';

            this.updateMemberSelect();

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
            this.currentGroupId = id;
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) modalTitle.textContent = '编辑分组信息';

            try {
                const response = await fetch(`/api/subaddmin/interviewer-groups/${id}/`);
                const result = await response.json();

                if (result.success) {
                    if (result.data.status_code === 'WORKING') {
                        alert('该分组处于工作中状态，不可编辑');
                        return;
                    }

                    this.fillEditForm(result.data);
                    this.editModal.classList.add('active');

                    await this.renderMembers(result.data.members || []);
                    this.updateMemberSelect();
                    this.updateChiefSelect();

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
            document.getElementById('editId').value = data.id || '';
            document.getElementById('editName').value = data.name || '';
            document.getElementById('editCreatedAt').value = data.created_at || '';

            const deptSelect = document.getElementById('editDepartment');
            if (deptSelect && data.department_code) {
                deptSelect.value = data.department_code;
                deptSelect.disabled = true;
            }

            const statusSelect = document.getElementById('editStatus');
            if (statusSelect && data.status_code) {
                for (let opt of statusSelect.options) {
                    if (opt.value === data.status_code) {
                        opt.selected = true;
                        break;
                    }
                }
            }
        }

        // ========== 清空表单 ==========
        clearEditForm() {
            document.getElementById('editId').value = '';
            document.getElementById('editName').value = '';
            document.getElementById('editCreatedAt').value = '';

            const deptSelect = document.getElementById('editDepartment');
            if (deptSelect && userDepartment) {
                deptSelect.value = userDepartment;
            }
        }

        // ========== 收集表单数据 ==========
        collectEditForm() {
            const memberItems = document.querySelectorAll('#membersList .member-item');
            const selectedMembers = [];
            memberItems.forEach(item => {
                const id = parseInt(item.dataset.id);
                if (id) {
                    selectedMembers.push(id);
                }
            });

            const deptSelect = document.getElementById('editDepartment');
            const department = userDepartment || (deptSelect ? deptSelect.value : '');

            return {
                name: document.getElementById('editName').value.trim(),
                department: department,
                status: document.getElementById('editStatus').value,
                chief_id: parseInt(document.getElementById('editChief').value) || null,
                member_ids: selectedMembers,
            };
        }

        // ========== 保存 ==========
        async handleSave(id) {
            const formData = this.collectEditForm();
            const memberItems = document.querySelectorAll('#membersList .member-item');
            const status = document.getElementById('editStatus').value;

            if (status === 'ONUSE' && memberItems.length === 0) {
                alert('启用中的分组至少需要一名成员');
                return;
            }

            if (status === 'ONUSE' && memberItems.length > 0) {
                const chiefId = formData.chief_id;
                if (!chiefId) {
                    alert('请指定主面试官');
                    return;
                }
            }

            if (formData.chief_id && !formData.member_ids.includes(formData.chief_id)) {
                alert('主面试官必须是成员之一，请先将该面试官添加为成员');
                return;
            }

            const url = id ? `/api/subaddmin/interviewer-groups/${id}/` : '/api/subaddmin/interviewer-groups/create/';
            const method = 'POST';

            if (!formData.department) {
                alert('请选择部门');
                return;
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

        // ========== 单个销毁 ==========
        async handleSingleDestroy(id) {
            if (!(await Modal.confirm('确定要销毁这个分组吗？销毁后状态将变为"已销毁"。'))) return;

            try {
                const response = await fetch(`/api/subaddmin/interviewer-groups/${id}/delete/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.getCSRFToken(),
                        'Content-Type': 'application/json',
                    }
                });

                const result = await response.json();
                if (result.success) {
                    this.loadData();
                    alert('销毁成功');
                } else {
                    alert(result.message || '销毁失败');
                }
            } catch (error) {
                console.error('销毁失败:', error);
                alert('销毁失败，请重试');
            }
        }

        // ========== 获取CSRF Token ==========
        getCSRFToken() {
            const token = document.querySelector('[name=csrfmiddlewaretoken]');
            return token ? token.value : '';
        }

        // ========== 更新成员下拉列表（按部门筛选） ==========
        updateMemberSelect() {
            const deptSelect = document.getElementById('editDepartment');
            const selectedDept = userDepartment || (deptSelect ? deptSelect.value : '');
            const memberSelect = document.getElementById('memberSelect');
            const memberItems = document.querySelectorAll('#membersList .member-item');
            const existingIds = new Set();
            memberItems.forEach(item => {
                existingIds.add(parseInt(item.dataset.id));
            });

            if (!memberSelect) return;
            memberSelect.innerHTML = '<option value="">-- 选择面试官 --</option>';

            let hasAvailable = false;
            this.interviewerOptions.forEach(interviewer => {
                if (!selectedDept || interviewer.department === selectedDept) {
                    // 如果已分配（is_busy为true）且不在当前成员列表中，仍然显示但标记为已分配
                    if (!existingIds.has(interviewer.value)) {
                        const option = document.createElement('option');
                        option.value = interviewer.value;
                        const label = interviewer.label || interviewer.name || '';
                        option.textContent = label;
                        // 如果面试官已分配到其他组，禁用该选项
                        if (interviewer.is_busy) {
                            option.disabled = true;
                            option.textContent = label + ' (已分配到其他组)';
                        }
                        memberSelect.appendChild(option);
                        hasAvailable = true;
                    }
                }
            });

            if (!hasAvailable) {
                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = '无可用的面试官';
                memberSelect.appendChild(emptyOption);
            }
        }

        // ========== 更新主面试官下拉列表（只从成员中选择） ==========
        updateChiefSelect() {
            const chiefSelect = document.getElementById('editChief');
            const memberItems = document.querySelectorAll('#membersList .member-item');

            if (!chiefSelect) return;
            const currentChiefId = parseInt(chiefSelect.value) || null;
            chiefSelect.innerHTML = '<option value="">-- 选择主面试官 --</option>';

            memberItems.forEach(item => {
                const id = parseInt(item.dataset.id);
                const name = item.dataset.name || '';
                const department = item.dataset.department || '';
                const option = document.createElement('option');
                option.value = id;
                option.textContent = `${department} - ${name}`;
                if (id === currentChiefId) {
                    option.selected = true;
                }
                chiefSelect.appendChild(option);
            });
        }

        // ========== 渲染成员列表 ==========
        renderMembers(members) {
            const container = document.getElementById('membersList');
            if (!container) return;

            if (!members || members.length === 0) {
                container.innerHTML = '<div class="empty-hint">暂无成员</div>';
                return;
            }

            let html = '';
            members.forEach(member => {
                const isChief = member.is_chief || false;
                html += `
                    <div class="member-item" data-id="${member.id}" data-name="${member.name}" data-department="${member.department}" data-is-chief="${isChief}">
                        <div class="member-info">
                            <span class="member-name ${isChief ? 'chief' : ''}">${member.name}</span>
                            <span class="member-detail">${member.department}</span>
                            ${isChief ? '<span class="chief-badge">主面试官</span>' : ''}
                        </div>
                        ${!isChief ? `<button type="button" class="remove-btn" data-id="${member.id}" title="移除">×</button>` : ''}
                    </div>
                `;
            });

            container.innerHTML = html;

            container.querySelectorAll('.remove-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    this.handleRemoveMemberFromUI(id);
                });
            });
        }

        // ========== 处理添加成员 ==========
        handleAddMember(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            const select = document.getElementById('memberSelect');
            const selectedOption = select.options[select.selectedIndex];
            const interviewerId = select.value;

            if (!interviewerId) {
                alert('请选择面试官');
                return;
            }

            const interviewer = this.interviewerOptions.find(i => i.value === parseInt(interviewerId));
            if (!interviewer) {
                alert('面试官信息不存在');
                return;
            }

            const existingItems = document.querySelectorAll('#membersList .member-item');
            let exists = false;
            existingItems.forEach(item => {
                if (parseInt(item.dataset.id) === parseInt(interviewerId)) {
                    exists = true;
                }
            });

            if (exists) {
                alert('该面试官已是此分组');
                return;
            }

            const container = document.getElementById('membersList');
            const emptyHint = container.querySelector('.empty-hint');
            if (emptyHint) {
                container.innerHTML = '';
            }

            const deptDisplay = interviewer.label ? interviewer.label.split(' - ')[0] || interviewer.department || '' : '';
            const nameDisplay = interviewer.label ? interviewer.label.split(' - ')[1] || '' : interviewer.name || '';

            const itemHtml = `
                <div class="member-item" data-id="${interviewerId}" data-name="${nameDisplay}" data-department="${deptDisplay}" data-is-chief="false">
                    <div class="member-info">
                        <span class="member-name">${interviewer.label || nameDisplay}</span>
                    </div>
                    <button type="button" class="remove-btn" data-id="${interviewerId}" title="移除">×</button>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', itemHtml);

            const newItem = container.querySelector(`.member-item[data-id="${interviewerId}"]`);
            if (newItem) {
                const removeBtn = newItem.querySelector('.remove-btn');
                removeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleRemoveMemberFromUI(removeBtn.dataset.id);
                });
            }

            this.updateMemberSelect();
            this.updateChiefSelect();
        }

        // ========== 处理移除成员 ==========
        handleRemoveMemberFromUI(memberId) {
            const container = document.getElementById('membersList');
            const item = container.querySelector(`.member-item[data-id="${memberId}"]`);
            if (item) {
                if (item.dataset.isChief === 'true') {
                    alert('不能移除主面试官，请先在主面试官下拉列表中取消选择');
                    return;
                }
                item.remove();
            }

            if (container.children.length === 0) {
                container.innerHTML = '<div class="empty-hint">暂无成员</div>';
            }

            this.updateMemberSelect();
            this.updateChiefSelect();
        }
    }

    // 初始化面试官分组管理
    if (document.getElementById('interviewerTable')) {
        new SubGroupManager();
    }
});