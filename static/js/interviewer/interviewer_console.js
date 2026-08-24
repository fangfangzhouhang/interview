document.addEventListener('DOMContentLoaded', function() {
    // ========== 侧边栏切换 ==========
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            this.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
        });
    }

    // ========== 面试官组管理 ==========
    class PanelGroupManager {
        constructor() {
            this.apiUrl = '/api/interviewer/console/';
            this.tableBody = document.getElementById('tableBody');
            this.searchInput = document.getElementById('searchInput');
            this.statusFilter = document.getElementById('statusFilter');
            this.totalCount = document.getElementById('totalCount');
            this.pageStart = document.getElementById('pageStart');
            this.pageEnd = document.getElementById('pageEnd');
            this.pageTotal = document.getElementById('pageTotal');
            this.currentPage = document.getElementById('currentPage');
            this.totalPages = document.getElementById('totalPages');
            this.prevPage = document.getElementById('prevPage');
            this.nextPage = document.getElementById('nextPage');
            this.transferModal = document.getElementById('transferModal');

            this.state = {
                page: 1,
                pageSize: 10,
                search: '',
                status: 'ONUSE',  // 默认启用中
                total: 0,
                totalPages: 0
            };

            this.currentGroupId = null;
            this.currentChiefName = '';

            this.init();
        }

        async init() {
            this.loadData();
            this.bindEvents();
        }

        // ========== 绑定事件 ==========
        bindEvents() {
            // 搜索（防抖）
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

                // 回车触发搜索
                this.searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        clearTimeout(timer);
                        this.state.search = this.searchInput.value;
                        this.state.page = 1;
                        this.loadData();
                    }
                });
            }

            // 状态筛选
            if (this.statusFilter) {
                this.statusFilter.addEventListener('change', () => {
                    this.state.status = this.statusFilter.value;
                    this.state.page = 1;
                    this.loadData();
                });
            }

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
            if (this.transferModal) {
                const closeBtn = this.transferModal.querySelector('.modal-close');
                const cancelBtn = this.transferModal.querySelector('#modalCancel');
                const overlay = this.transferModal.querySelector('.modal-overlay');

                const closeModal = () => {
                    this.transferModal.classList.remove('active');
                };

                if (closeBtn) closeBtn.addEventListener('click', closeModal);
                if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
                if (overlay) overlay.addEventListener('click', closeModal);

                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && this.transferModal.classList.contains('active')) {
                        closeModal();
                    }
                });

                // 确认移交
                const confirmBtn = this.transferModal.querySelector('#modalConfirm');
                if (confirmBtn) {
                    confirmBtn.addEventListener('click', () => {
                        this.handleTransferConfirm();
                    });
                }
            }
        }

        // ========== 加载数据 ==========
        async loadData() {
            const params = new URLSearchParams({
                page: this.state.page,
                page_size: this.state.pageSize,
                search: this.state.search,
                status: this.state.status
            });

            try {
                const response = await fetch(`${this.apiUrl}?${params}`);
                const result = await response.json();

                if (result.success) {
                    this.state.total = result.pagination.total_count;
                    this.state.totalPages = result.pagination.total_pages;
                    this.currentData = result.data;

                    this.renderTable(result.data);
                    this.updatePagination(result.pagination);
                } else {
                    this.tableBody.innerHTML = `<tr><td colspan="8" class="loading-text">${result.message || '加载失败'}</td></tr>`;
                }
            } catch (error) {
                console.error('加载数据失败:', error);
                this.tableBody.innerHTML = '<tr><td colspan="8" class="loading-text">加载失败，请刷新重试</td></tr>';
            }
        }

        // ========== 渲染表格 ==========
        renderTable(data) {
            if (!data || data.length === 0) {
                this.tableBody.innerHTML = '<tr><td colspan="8" class="loading-text">暂无您管理的小组</td></tr>';
                return;
            }

            let html = '';
            data.forEach(item => {
                const statusClass = this.getStatusClass(item.status_code);
                // 只有启用中状态才能移交权限
                const canTransfer = item.status_code === 'ONUSE' && item.member_count > 1;

                html += `
                    <tr data-id="${item.id}">
                        <td>${item.index}</td>
                        <td><strong>${item.name}</strong></td>
                        <td><span class="department-tag">${item.department}</span></td>
                        <td><span class="status-tag ${statusClass}">${item.status}</span></td>
                        <td><strong>${item.chief}</strong></td>
                        <td>${item.members}</td>
                        <td>${item.member_count}</td>
                        <td>
                            ${canTransfer ? `<button class="btn-transfer transfer-btn" data-id="${item.id}" data-name="${item.name}" data-chief="${item.chief}">移交权限</button>` :
                            `<button class="btn-transfer" disabled ${item.status_code === 'WORKING' ? 'title="工作中状态不能移交权限"' : item.status_code === 'ENDED' ? 'title="已销毁的分组不能操作"' : 'title="只有一名成员，无法移交"'} >移交权限</button>`}
                        </td>
                    </tr>
                `;
            });

            this.tableBody.innerHTML = html;

            // 绑定移交按钮事件
            document.querySelectorAll('.transfer-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    const name = btn.dataset.name;
                    const chief = btn.dataset.chief;
                    this.openTransferModal(id, name, chief);
                });
            });
        }

        getStatusClass(status) {
            const map = {
                'ONUSE': 'status-onuse',
                'WORKING': 'status-working',
                'ENDED': 'status-ended'
            };
            return map[status] || '';
        }

        // ========== 更新分页 ==========
        updatePagination(pagination) {
            const { current_page, total_pages, total_count, page_size, start, end } = pagination;

            this.currentPage.textContent = current_page;
            this.totalPages.textContent = total_pages;
            this.pageStart.textContent = start;
            this.pageEnd.textContent = end;
            this.pageTotal.textContent = total_count;
            this.totalCount.textContent = total_count;

            this.prevPage.disabled = current_page <= 1;
            this.nextPage.disabled = current_page >= total_pages;
        }

        // ========== 打开移交弹窗 ==========
        async openTransferModal(groupId, groupName, chiefName) {
            this.currentGroupId = groupId;
            this.currentChiefName = chiefName;

            // 设置当前主面试官显示
            const display = document.getElementById('currentChiefDisplay');
            if (display) {
                display.innerHTML = `<span class="chief-name">${chiefName}</span>`;
            }

            // 加载组成员
            try {
                const response = await fetch(`/api/interviewer/console/${groupId}/`);
                const result = await response.json();

                if (result.success) {
                    const members = result.data.members || [];
                    const chiefId = result.data.chief_id;

                    const select = document.getElementById('newChiefSelect');
                    select.innerHTML = '<option value="">-- 请选择 --</option>';

                    let hasOtherMembers = false;
                    members.forEach(member => {
                        // 排除当前主面试官自己
                        if (member.id !== chiefId) {
                            const option = document.createElement('option');
                            option.value = member.id;
                            option.textContent = `${member.department} - ${member.name}`;
                            select.appendChild(option);
                            hasOtherMembers = true;
                        }
                    });

                    if (!hasOtherMembers) {
                        const option = document.createElement('option');
                        option.value = '';
                        option.textContent = '没有其他成员可移交';
                        option.disabled = true;
                        select.appendChild(option);
                    }

                    this.transferModal.classList.add('active');

                    // 保存当前组信息
                    this.transferModal.dataset.groupId = groupId;
                } else {
                    alert(result.message || '加载组信息失败');
                }
            } catch (error) {
                console.error('加载组信息失败:', error);
                alert('加载组信息失败，请重试');
            }
        }

        // ========== 确认移交 ==========
        async handleTransferConfirm() {
            const select = document.getElementById('newChiefSelect');
            const newChiefId = select.value;

            if (!newChiefId) {
                alert('请选择新的主面试官');
                return;
            }

            const groupId = this.transferModal.dataset.groupId;
            if (!groupId) {
                alert('数据错误，请重新打开');
                return;
            }

            if (!(await Modal.confirm(`确定要将主面试官权限移交给选中的面试官吗？\n\n移交后您将不再是该组的主面试官。`))) {
                return;
            }

            try {
                const response = await fetch(`/api/interviewer/console/${groupId}/transfer-chief/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.getCSRFToken(),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        chief_id: parseInt(newChiefId)
                    })
                });

                const result = await response.json();

                if (result.success) {
                    this.transferModal.classList.remove('active');
                    alert(result.message);
                    this.loadData(); // 刷新列表
                } else {
                    alert(result.message || '移交失败');
                }
            } catch (error) {
                console.error('移交失败:', error);
                alert('移交失败，请重试');
            }
        }

        // ========== 获取CSRF Token ==========
        getCSRFToken() {
            const token = document.querySelector('[name=csrfmiddlewaretoken]');
            return token ? token.value : '';
        }
    }

    // 初始化
    new PanelGroupManager();
});