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

    // ========== 面试场次管理 ==========
    class SubGroupManager {
        constructor() {
            this.apiUrl = '/api/subaddmin/groups/';
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

            this.selectedIds = new Set();
            this.isEditMode = false;
            this.state = {
                page: 1,
                pageSize: 10,
                search: '',
                status: '',
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
                const params = new URLSearchParams({
                    department: userDepartment
                });
                const response = await fetch('/api/subaddmin/groups/options/?' + params);
                const result = await response.json();

                if (result.success) {
                    this.departmentOptions = result.departments || [];
                    this.statusOptions = result.statuses || [];
                    this.interviewerOptions = result.interviewers || [];

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
        renderSelectOptions(selectId, options, isMultiple) {
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

            options.forEach(function(opt) {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                select.appendChild(option);
            });

            if (isMultiple) {
                select.size = Math.min(options.length, 6);
                select.style.height = 'auto';
            }
        }

        // ========== 绑定事件 ==========
        bindEvents() {
            const self = this;

            if (this.searchInput) {
                let timer;
                this.searchInput.addEventListener('input', function() {
                    clearTimeout(timer);
                    timer = setTimeout(function() {
                        self.state.search = self.searchInput.value;
                        self.state.page = 1;
                        self.loadData();
                    }, 500);
                });
            }

            if (this.statusFilter) {
                this.statusFilter.addEventListener('change', function() {
                    self.state.status = self.statusFilter.value;
                    self.state.page = 1;
                    self.loadData();
                });
            }

            if (this.checkAll) {
                this.checkAll.addEventListener('change', function() {
                    const checked = self.checkAll.checked;
                    document.querySelectorAll('.row-checkbox').forEach(function(cb) {
                        cb.checked = checked;
                        if (checked) {
                            self.selectedIds.add(parseInt(cb.dataset.id));
                        } else {
                            self.selectedIds.delete(parseInt(cb.dataset.id));
                        }
                    });
                    self.updateSelectAllState();
                });
            }

            if (this.selectAllBtn) {
                this.selectAllBtn.addEventListener('click', function() {
                    document.querySelectorAll('.row-checkbox').forEach(function(cb) {
                        cb.checked = true;
                        self.selectedIds.add(parseInt(cb.dataset.id));
                    });
                    if (self.checkAll) self.checkAll.checked = true;
                    self.updateSelectAllState();
                });
            }

            if (this.deselectAllBtn) {
                this.deselectAllBtn.addEventListener('click', function() {
                    document.querySelectorAll('.row-checkbox').forEach(function(cb) {
                        cb.checked = false;
                        self.selectedIds.delete(parseInt(cb.dataset.id));
                    });
                    if (self.checkAll) self.checkAll.checked = false;
                    self.updateSelectAllState();
                });
            }

            if (this.addBtn) {
                this.addBtn.addEventListener('click', function() {
                    self.openAddModal();
                });
            }

            if (this.prevPage) {
                this.prevPage.addEventListener('click', function() {
                    if (self.state.page > 1) {
                        self.state.page--;
                        self.loadData();
                    }
                });
            }

            if (this.nextPage) {
                this.nextPage.addEventListener('click', function() {
                    if (self.state.page < self.state.totalPages) {
                        self.state.page++;
                        self.loadData();
                    }
                });
            }

            if (this.editModal) {
                const closeBtn = this.editModal.querySelector('.modal-close');
                const cancelBtn = this.editModal.querySelector('#modalCancel');
                const overlay = this.editModal.querySelector('.modal-overlay');

                const closeModal = function() {
                    self.editModal.classList.remove('active');
                };

                if (closeBtn) closeBtn.addEventListener('click', closeModal);
                if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
                if (overlay) overlay.addEventListener('click', closeModal);

                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape' && self.editModal.classList.contains('active')) {
                        closeModal();
                    }
                });
            }

            const addInterviewerBtn = document.getElementById('addInterviewerBtn');
            if (addInterviewerBtn) {
                addInterviewerBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    self.handleAddInterviewer(e);
                });
            }

            const addCandidateBtn = document.getElementById('addCandidateBtn');
            if (addCandidateBtn) {
                addCandidateBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    self.handleAddCandidate(e);
                });
            }
        }

        // ========== 加载数据 ==========
        loadData() {
            const self = this;
            const params = new URLSearchParams({
                page: this.state.page,
                page_size: this.state.pageSize,
                search: this.state.search,
                department: userDepartment,
                status: this.state.status
            });
            fetch(this.apiUrl + '?' + params)
                .then(function(response) {
                    return response.json();
                })
                .then(function(result) {
                    if (result.success) {
                        self.currentData = result.data;
                        self.state.total = result.total;
                        self.state.totalPages = result.total_pages;

                        self.renderTable(result.data);
                        self.updatePagination();
                        self.selectedIds.clear();
                    } else {
                        self.tableBody.innerHTML = '<tr><td colspan="10" class="loading-text">加载失败：' + (result.message || '未知错误') + '</td></tr>';
                    }
                })
                .catch(function(error) {
                    console.error('加载数据失败:', error);
                    self.tableBody.innerHTML = '<tr><td colspan="10" class="loading-text">加载失败，请刷新重试</td></tr>';
                });
        }

        // ========== 渲染表格 ==========
        renderTable(data) {
            const self = this;
            if (!data || data.length === 0) {
                this.tableBody.innerHTML = '<tr><td colspan="10" class="loading-text">暂无数据</td></tr>';
                return;
            }

            let html = '';
            data.forEach(function(item) {
                const isSelected = self.selectedIds.has(item.id);
                const statusClass = self.getStatusClass(item.status_code);
                const interviewerNames = item.interviewers ? item.interviewers.map(function(i) { return i.name; }).join(', ') : '';
                const candidateNames = item.candidates ? item.candidates.map(function(c) { return c.name; }).join(', ') : '';
                const groupDisplay = (item.group_id && item.group_id !== '未设置') ? item.group_id : (item.department_code || 'UNK') + item.id;
                const isPending = item.status_code === 'PENDING';
                html += '<tr style="cursor: pointer;" data-id="' + item.id + '">' +
                    '<td><input type="checkbox" class="row-checkbox" data-id="' + item.id + '" ' + (isSelected ? 'checked' : '') + (isPending ? '' : ' disabled') + '></td>' +
                    '<td>' + item.id + '</td>' +
                    '<td>' + groupDisplay + '</td>' +
                    '<td><span class="department-tag">' + item.department + '</span></td>' +
                    '<td>' + (candidateNames || '无') + '</td>' +
                    '<td><span class="status-tag ' + statusClass + '">' + item.status + '</span></td>' +
                    '<td>' + (interviewerNames || '无') + '</td>' +
                    '<td>' + (item.interviewer_count || 0) + '</td>' +
                    '<td>' + (item.candidate_count || 0) + '</td>' +
                    '<td>' +
                    (isPending ? '<button class="btn btn-primary btn-sm edit-btn" data-id="' + item.id + '">编辑</button>' : '<button class="btn btn-secondary btn-sm" disabled>不可编辑</button>') +
                    (isPending ? '<button class="btn btn-warning btn-sm cancel-btn" data-id="' + item.id + '">取消</button>' : '') +
                    '</td></tr>';
            });

            this.tableBody.innerHTML = html;

            document.querySelectorAll('.row-checkbox').forEach(function(cb) {
                cb.addEventListener('change', function() {
                    const id = parseInt(this.dataset.id);
                    if (this.checked) {
                        self.selectedIds.add(id);
                    } else {
                        self.selectedIds.delete(id);
                    }
                    self.updateSelectAllState();
                });
            });

            document.querySelectorAll('.edit-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    const id = parseInt(this.dataset.id);
                    self.openEditModal(id);
                });
            });

            document.querySelectorAll('.cancel-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    const id = parseInt(this.dataset.id);
                    self.handleSingleCancel(id);
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
            const checkboxes = document.querySelectorAll('.row-checkbox:not([disabled])');
            const checked = document.querySelectorAll('.row-checkbox:checked:not([disabled])');

            if (this.checkAll) {
                this.checkAll.checked = checkboxes.length > 0 && checked.length === checkboxes.length;
                this.checkAll.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
            }
        }

        // ========== 打开新增弹窗 ==========
        openAddModal() {
            const self = this;
            this.isEditMode = false;
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) modalTitle.textContent = '新增场次';

            this.clearEditForm();

            const deptSelect = document.getElementById('editDepartment');
            if (deptSelect && userDepartment) {
                deptSelect.value = userDepartment;
                deptSelect.disabled = true;
            }

            const statusSelect = document.getElementById('editStatus');
            if (statusSelect) {
                for (let i = 0; i < statusSelect.options.length; i++) {
                    if (statusSelect.options[i].value === 'PENDING') {
                        statusSelect.options[i].selected = true;
                        break;
                    }
                }
            }

            const dateInput = document.getElementById('editInterviewDate');
            if (dateInput) {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                dateInput.value = year + '-' + month + '-' + day + 'T' + hours + ':' + minutes;
            }

            const candidatesList = document.getElementById('candidatesList');
            if (candidatesList) {
                candidatesList.innerHTML = '<div class="empty-hint">暂无关联面试者</div>';
            }

            const interviewersList = document.getElementById('interviewersList');
            if (interviewersList) {
                interviewersList.innerHTML = '<div class="empty-hint">暂无关联面试官</div>';
            }

            this.loadAvailableCandidates();
            this.loadAllInterviewers();

            this.editModal.classList.add('active');

            const saveBtn = this.editModal.querySelector('#modalSave');
            if (saveBtn) {
                saveBtn.onclick = function() {
                    self.handleSave();
                };
            }
        }

        // ========== 打开编辑弹窗 ==========
        openEditModal(id) {
            const self = this;
            if (!this.editModal) return;
            this.isEditMode = true;
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) modalTitle.textContent = '编辑场次信息';

            fetch('/api/subaddmin/groups/' + id + '/')
                .then(function(response) {
                    return response.json();
                })
                .then(function(result) {
                    if (result.success) {
                        self.fillEditForm(result.data);
                        self.editModal.classList.add('active');

                        self.loadGroupCandidates(id);
                        self.loadAvailableCandidates();
                        self.loadGroupInterviewers(id);
                        self.loadAllInterviewers();

                        const saveBtn = self.editModal.querySelector('#modalSave');
                        if (saveBtn) {
                            saveBtn.onclick = function() {
                                self.handleSave(id);
                            };
                        }
                    } else {
                        alert(result.message || '加载详情失败');
                    }
                })
                .catch(function(error) {
                    console.error('加载详情失败:', error);
                    alert('加载详情失败，请重试');
                });
        }

        // ========== 填充编辑表单 ==========
        fillEditForm(data) {
            document.getElementById('editId').value = data.id || '';
            document.getElementById('editGroupId').value = data.group_id || '';

            const deptSelect = document.getElementById('editDepartment');
            if (deptSelect && data.department_code) {
                deptSelect.value = data.department_code;
                deptSelect.disabled = true;
            }

            const statusSelect = document.getElementById('editStatus');
            if (statusSelect && data.status_code) {
                for (let i = 0; i < statusSelect.options.length; i++) {
                    if (statusSelect.options[i].value === data.status_code) {
                        statusSelect.options[i].selected = true;
                        break;
                    }
                }
            }

            const dateInput = document.getElementById('editInterviewDate');
            if (dateInput && data.interview_date) {
                dateInput.value = data.interview_date.replace(' ', 'T');
            }
        }

        // ========== 清空表单 ==========
        clearEditForm() {
            document.getElementById('editId').value = '';
            document.getElementById('editGroupId').value = '';

            const interviewerSelect = document.getElementById('editInterviewers');
            if (interviewerSelect) {
                for (let i = 0; i < interviewerSelect.options.length; i++) {
                    interviewerSelect.options[i].selected = false;
                }
            }

            document.getElementById('editInterviewDate').value = '';
        }

        // ========== 收集表单数据 ==========
        collectEditForm() {
            const interviewerItems = document.querySelectorAll('#interviewersList .interviewer-item');
            const selectedInterviewers = [];
            interviewerItems.forEach(function(item) {
                const id = parseInt(item.dataset.id);
                if (id) {
                    selectedInterviewers.push(id);
                }
            });

            const candidateItems = document.querySelectorAll('#candidatesList .candidate-item');
            const candidates = [];
            candidateItems.forEach(function(item) {
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

            const deptSelect = document.getElementById('editDepartment');
            const department = userDepartment || (deptSelect ? deptSelect.value : '');

            return {
                group_id: document.getElementById('editGroupId').value,
                department: department,
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
        handleSave(id) {
            const self = this;
            const formData = this.collectEditForm();

            if (!formData.department) {
                alert('请选择部门');
                return;
            }

            if (formData.interviewer_ids.length === 0) {
                alert('请至少选择一个面试官');
                return;
            }

            if (!formData.group_id || !formData.group_id.trim()) {
                const deptCode = formData.department || 'UNK';
                if (id) {
                    formData.group_id = deptCode + id;
                } else {
                    formData.group_id = '';
                }
            }

            const url = id ? '/api/subaddmin/groups/' + id + '/' : '/api/subaddmin/groups/create/';

            fetch(url, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.getCSRFToken(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            })
            .then(function(response) {
                return response.json();
            })
            .then(function(result) {
                if (result.success) {
                    self.editModal.classList.remove('active');
                    self.loadData();
                    alert(result.message || (id ? '更新成功' : '创建成功'));
                } else {
                    alert(result.message || '操作失败');
                }
            })
            .catch(function(error) {
                console.error('保存失败:', error);
                alert('保存失败，请重试');
            });
        }

        // ========== 单个取消 ==========
        async handleSingleCancel(id) {
            const self = this;
            if (!(await Modal.confirm('确定要取消这个场次吗？取消后状态将变为"已取消"。'))) return;

            fetch('/api/subaddmin/groups/' + id + '/cancel/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.getCSRFToken(),
                    'Content-Type': 'application/json',
                }
            })
            .then(function(response) {
                return response.json();
            })
            .then(function(result) {
                if (result.success) {
                    self.loadData();
                    alert('取消成功');
                } else {
                    alert(result.message || '取消失败');
                }
            })
            .catch(function(error) {
                console.error('取消失败:', error);
                alert('取消失败，请重试');
            });
        }

        // ========== 获取CSRF Token ==========
        getCSRFToken() {
            const token = document.querySelector('[name=csrfmiddlewaretoken]');
            return token ? token.value : '';
        }

        // ========== 加载可用的面试者列表 ==========
        loadAvailableCandidates() {
            const self = this;
            fetch('/api/subaddmin/candidates/all/?department=' + userDepartment)
                .then(function(response) {
                    return response.json();
                })
                .then(function(result) {
                    if (result.success) {
                        const select = document.getElementById('candidateSelect');
                        if (!select) return;

                        const existingItems = document.querySelectorAll('#candidatesList .candidate-item');
                        const existingIds = new Set();
                        existingItems.forEach(function(item) {
                            let id = item.dataset.candidateId;
                            if (!id) {
                                id = item.dataset.id;
                            }
                            if (id) {
                                existingIds.add(parseInt(id));
                            }
                        });

                        select.innerHTML = '<option value="">-- 选择面试者 --</option>';

                        result.data.forEach(function(candidate) {
                            if (!existingIds.has(candidate.id)) {
                                const option = document.createElement('option');
                                option.value = candidate.id;
                                option.textContent = candidate.name + ' (' + candidate.student_number + ') - ' + candidate.school;
                                select.appendChild(option);
                            }
                        });

                        if (select.options.length === 1) {
                            const emptyOption = document.createElement('option');
                            emptyOption.value = '';
                            emptyOption.textContent = '所有面试者已添加';
                            select.appendChild(emptyOption);
                        }
                    }
                })
                .catch(function(error) {
                    console.error('加载面试者列表失败:', error);
                });
        }

        // ========== 加载场次关联的面试者 ==========
        loadGroupCandidates(groupId) {
            const self = this;
            if (!groupId) {
                groupId = document.getElementById('editId').value;
            }

            if (!groupId) {
                console.warn('没有找到场次ID，无法加载面试者列表');
                return;
            }

            fetch('/api/subaddmin/groups/' + groupId + '/candidates/')
                .then(function(response) {
                    return response.json();
                })
                .then(function(result) {
                    if (result.success) {
                        self.renderCandidates(result.data);
                    } else {
                        console.error('加载场次面试者失败:', result.message);
                    }
                })
                .catch(function(error) {
                    console.error('加载场次面试者失败:', error);
                });
        }

        // ========== 渲染面试者列表 ==========
        renderCandidates(candidates) {
            const self = this;
            const container = document.getElementById('candidatesList');
            if (!container) return;

            if (!candidates || candidates.length === 0) {
                container.innerHTML = '<div class="empty-hint">暂无关联面试者</div>';
                this.loadAvailableCandidates();
                return;
            }

            candidates.sort(function(a, b) { return a.order - b.order; });

            let html = '';
            candidates.forEach(function(cig) {
                let orderOptions = '';
                for (let i = 1; i <= 6; i++) {
                    const selected = i === cig.order ? 'selected' : '';
                    orderOptions += '<option value="' + i + '" ' + selected + '>' + i + '</option>';
                }

                html += '<div class="candidate-item" data-id="' + cig.id + '" data-candidate-id="' + cig.candidate_id + '" data-order="' + cig.order + '">' +
                    '<div class="candidate-info">' +
                    '<div class="candidate-order">序号：<select class="order-select" data-id="' + cig.id + '">' + orderOptions + '</select></div>' +
                    '<span class="candidate-name">' + cig.name + '</span>' +
                    '<span class="candidate-detail">' + cig.student_number + '</span>' +
                    '<span class="candidate-detail">' + cig.school + '</span>' +
                    '</div>' +
                    '<button type="button" class="remove-btn" data-id="' + cig.id + '" data-candidate-id="' + cig.candidate_id + '" title="移除">×</button>' +
                    '</div>';
            });

            container.innerHTML = html;

            container.querySelectorAll('.order-select').forEach(function(select) {
                select.addEventListener('change', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.handleOrderChangeInUI(select);
                });
            });

            container.querySelectorAll('.remove-btn').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const candidateId = parseInt(this.dataset.candidateId);
                    self.handleRemoveCandidateFromUI(candidateId);
                });
            });

            this.loadAvailableCandidates();
        }

        // ========== 处理序号变更（仅UI操作） ==========
        handleOrderChangeInUI(select) {
            const candidateId = select.dataset.id;
            const newOrder = parseInt(select.value);
            const container = document.getElementById('candidatesList');
            const items = container.querySelectorAll('.candidate-item');

            let occupiedItem = null;
            items.forEach(function(item) {
                const itemCandidateId = item.dataset.candidateId;
                const orderSelect = item.querySelector('.order-select');
                if (itemCandidateId !== candidateId && parseInt(orderSelect.value) === newOrder) {
                    occupiedItem = item;
                }
            });

            if (occupiedItem) {
                const currentItem = container.querySelector('.candidate-item[data-id="' + candidateId + '"]');
                const oldOrder = currentItem ? parseInt(currentItem.dataset.order) || 1 : 1;
                const occupiedSelect = occupiedItem.querySelector('.order-select');
                occupiedSelect.value = oldOrder;
                occupiedItem.dataset.order = oldOrder;
                if (currentItem) {
                    currentItem.dataset.order = newOrder;
                }
            } else {
                const currentItem = container.querySelector('.candidate-item[data-id="' + candidateId + '"]');
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

            const item = container.querySelector('.candidate-item[data-candidate-id="' + candidateId + '"]');
            if (!item) {
                console.warn('未找到要移除的面试者元素');
                return;
            }

            const nameSpan = item.querySelector('.candidate-name');
            const detailSpan = item.querySelector('.candidate-detail');
            const candidateName = nameSpan ? nameSpan.textContent : '';
            const studentNumber = detailSpan ? detailSpan.textContent : '';
            const school = item.querySelectorAll('.candidate-detail')[1] ? item.querySelectorAll('.candidate-detail')[1].textContent : '';

            item.remove();

            const items = container.querySelectorAll('.candidate-item');
            items.forEach(function(item, index) {
                const orderSelect = item.querySelector('.order-select');
                if (orderSelect) {
                    orderSelect.value = index + 1;
                    item.dataset.order = index + 1;
                }
            });

            if (container.children.length === 0) {
                container.innerHTML = '<div class="empty-hint">暂无关联面试者</div>';
            }

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
                    const displayText = candidateName + ' (' + studentNumber + ') - ' + school;
                    const option = document.createElement('option');
                    option.value = candidateId;
                    option.textContent = displayText;
                    select.appendChild(option);
                }
            }
        }

        // ========== 处理添加面试者（仅UI操作） ==========
        handleAddCandidate(event) {
            const self = this;
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

            const existingItems = document.querySelectorAll('#candidatesList .candidate-item');
            let exists = false;
            existingItems.forEach(function(item) {
                const itemCandidateId = parseInt(item.dataset.candidateId);
                if (itemCandidateId === parseInt(candidateId)) {
                    exists = true;
                }
            });

            if (exists) {
                alert('该面试者已添加');
                return;
            }

            if (existingItems.length >= 6) {
                alert('最多添加6名面试者');
                return;
            }

            let maxOrder = 0;
            existingItems.forEach(function(item) {
                const orderSelect = item.querySelector('.order-select');
                if (orderSelect) {
                    const order = parseInt(orderSelect.value);
                    if (order > maxOrder) maxOrder = order;
                }
            });
            const newOrder = maxOrder + 1;

            const container = document.getElementById('candidatesList');
            const emptyHint = container.querySelector('.empty-hint');
            if (emptyHint) {
                container.innerHTML = '';
            }

            let orderOptions = '';
            for (let i = 1; i <= 6; i++) {
                const selected = i === newOrder ? 'selected' : '';
                orderOptions += '<option value="' + i + '" ' + selected + '>' + i + '</option>';
            }

            const itemHtml = '<div class="candidate-item" data-id="' + candidateId + '" data-candidate-id="' + candidateId + '" data-order="' + newOrder + '">' +
                '<div class="candidate-info">' +
                '<div class="candidate-order">序号：<select class="order-select" data-id="' + candidateId + '">' + orderOptions + '</select></div>' +
                '<span class="candidate-name">' + candidateText + '</span>' +
                '</div>' +
                '<button type="button" class="remove-btn" data-id="' + candidateId + '" data-candidate-id="' + candidateId + '" title="移除">×</button>' +
                '</div>';
            container.insertAdjacentHTML('beforeend', itemHtml);

            const newItem = container.querySelector('.candidate-item[data-candidate-id="' + candidateId + '"]');
            if (newItem) {
                const orderSelect = newItem.querySelector('.order-select');
                orderSelect.addEventListener('change', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.handleOrderChangeInUI(orderSelect);
                });

                const removeBtn = newItem.querySelector('.remove-btn');
                removeBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.handleRemoveCandidateFromUI(candidateId);
                });
            }

            this.loadAvailableCandidates();
        }

        // ========== 加载所有面试官列表 ==========
        loadAllInterviewers() {
            const self = this;
            fetch('/api/subaddmin/interviewers/all/?department=' + userDepartment)
                .then(function(response) {
                    return response.json();
                })
                .then(function(result) {
                    if (result.success) {
                        const select = document.getElementById('interviewerSelect');
                        if (!select) return;

                        const existingItems = document.querySelectorAll('#interviewersList .interviewer-item');
                        const existingIds = new Set();
                        existingItems.forEach(function(item) {
                            existingIds.add(parseInt(item.dataset.id));
                        });

                        select.innerHTML = '<option value="">-- 选择面试官 --</option>';

                        result.data.forEach(function(interviewer) {
                            if (!existingIds.has(interviewer.id)) {
                                const option = document.createElement('option');
                                option.value = interviewer.id;
                                option.textContent = interviewer.department + ' - ' + interviewer.name;
                                select.appendChild(option);
                            }
                        });

                        if (select.options.length === 1) {
                            const emptyOption = document.createElement('option');
                            emptyOption.value = '';
                            emptyOption.textContent = '所有面试官已添加';
                            select.appendChild(emptyOption);
                        }
                    }
                })
                .catch(function(error) {
                    console.error('加载面试官列表失败:', error);
                });
        }

        // ========== 加载场次关联的面试官 ==========
        loadGroupInterviewers(groupId) {
            const self = this;
            if (!groupId) {
                groupId = document.getElementById('editId').value;
            }

            if (!groupId) {
                console.warn('没有找到场次ID，无法加载面试官列表');
                return;
            }

            fetch('/api/subaddmin/groups/' + groupId + '/interviewers/')
                .then(function(response) {
                    return response.json();
                })
                .then(function(result) {
                    if (result.success) {
                        self.renderInterviewers(result.data);
                    } else {
                        console.error('加载场次面试官失败:', result.message);
                    }
                })
                .catch(function(error) {
                    console.error('加载场次面试官失败:', error);
                });
        }

        // ========== 渲染面试官列表 ==========
        renderInterviewers(interviewers) {
            const self = this;
            const container = document.getElementById('interviewersList');
            if (!container) return;

            if (!interviewers || interviewers.length === 0) {
                container.innerHTML = '<div class="empty-hint">暂无关联面试官</div>';
                return;
            }

            let html = '';
            interviewers.forEach(function(interviewer) {
                html += '<div class="interviewer-item" data-id="' + interviewer.id + '">' +
                    '<div class="interviewer-info">' +
                    '<span class="interviewer-name">' + interviewer.name + '</span>' +
                    '<span class="interviewer-detail">' + interviewer.department + '</span>' +
                    '</div>' +
                    '<button type="button" class="remove-btn" data-id="' + interviewer.id + '" title="移除">×</button>' +
                    '</div>';
            });

            container.innerHTML = html;

            container.querySelectorAll('.remove-btn').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = parseInt(this.dataset.id);
                    self.handleRemoveInterviewerFromUI(id);
                });
            });
        }

        // ========== 处理添加面试官（仅UI操作） ==========
        handleAddInterviewer(event) {
            const self = this;
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
            existingItems.forEach(function(item) {
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

            const itemHtml = '<div class="interviewer-item" data-id="' + interviewerId + '">' +
                '<div class="interviewer-info">' +
                '<span class="interviewer-name">' + interviewerName + '</span>' +
                '</div>' +
                '<button type="button" class="remove-btn" data-id="' + interviewerId + '" title="移除">×</button>' +
                '</div>';
            container.insertAdjacentHTML('beforeend', itemHtml);

            const newItem = container.querySelector('.interviewer-item[data-id="' + interviewerId + '"]');
            if (newItem) {
                const removeBtn = newItem.querySelector('.remove-btn');
                removeBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.handleRemoveInterviewerFromUI(removeBtn.dataset.id);
                });
            }

            this.loadAllInterviewers();
        }

        // ========== 处理移除面试官（仅UI操作） ==========
        handleRemoveInterviewerFromUI(interviewerId) {
            const container = document.getElementById('interviewersList');
            const item = container.querySelector('.interviewer-item[data-id="' + interviewerId + '"]');
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
        new SubGroupManager();
    }
});