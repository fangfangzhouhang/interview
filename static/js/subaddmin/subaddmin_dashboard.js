// subaddmin_dashboard.js
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

    // ========== 志愿管理 ==========
    class VolunteerManager {
        constructor() {
            this.apiUrl = '/api/subaddmin/candidates/';
            this.acceptUrl = '/api/subaddmin/volunteer/accept/';
            this.rejectUrl = '/api/subaddmin/volunteer/reject/';
            this.singleActionUrl = '/api/subaddmin/volunteer/';
            this.tableBody = document.getElementById('tableBody');
            this.tableWrapper = document.getElementById('tableWrapper');
            this.searchInput = document.getElementById('searchInput');
            this.departmentFilter = document.getElementById('departmentFilter');
            this.statusFilter = document.getElementById('statusFilter');
            this.checkAll = document.getElementById('checkAll');
            this.selectAllBtn = document.getElementById('selectAllBtn');
            this.deselectAllBtn = document.getElementById('deselectAllBtn');
            this.totalCount = document.getElementById('totalCount');
            this.selectedCount = document.getElementById('selectedCount');
            this.pageStart = document.getElementById('pageStart');
            this.pageEnd = document.getElementById('pageEnd');
            this.pageTotal = document.getElementById('pageTotal');
            this.currentPage = document.getElementById('currentPage');
            this.totalPages = document.getElementById('totalPages');
            this.prevPage = document.getElementById('prevPage');
            this.nextPage = document.getElementById('nextPage');
            this.batchAcceptBtn = document.getElementById('batchAcceptBtn');
            this.batchRejectBtn = document.getElementById('batchRejectBtn');
            this.loadMoreIndicator = document.getElementById('loadMoreIndicator');
            this.noMoreData = document.getElementById('noMoreData');
            this.resultModal = document.getElementById('resultModal');

            this.allData = [];
            this.selectedIds = new Set();
            this.isLoading = false;
            this.hasMore = true;
            this.page = 1;
            this.pageSize = 20;
            this.state = {
                search: '',
                department: '',
                status: '',
                total: 0,
                totalPages: 0
            };

            // 从模板获取用户部门信息
            this.userDepartment = window.userDepartment || '';
            this.isSubadmin = window.isSubadmin || false;
            this.csrfToken = window.csrfToken || '';

            this.init();
        }

        async init() {
            this.initDepartmentFilter();
            await this.loadData(true);
            this.bindEvents();
            this.setupInfiniteScroll();
        }

        // ========== 初始化部门筛选 ==========
        initDepartmentFilter() {
            if (!this.departmentFilter) return;

            // 部门管理员：只显示自己的部门，且禁用选择
            if (this.isSubadmin && this.userDepartment) {
                const deptMap = {
                    'BGS': '办公',
                    'XCB': '信传',
                    'QYB': '权益',
                    'XSB': '学实',
                    'WYB': '文艺',
                    'TYB': '体育'
                };
                const deptDisplay = deptMap[this.userDepartment] || this.userDepartment;
                this.departmentFilter.innerHTML = `<option value="${this.userDepartment}">${deptDisplay}</option>`;
                this.departmentFilter.disabled = true;
                this.state.department = this.userDepartment;
            } else {
                const departments = [
                    { value: 'BGS', label: '办公' },
                    { value: 'XCB', label: '信传' },
                    { value: 'QYB', label: '权益' },
                    { value: 'XSB', label: '学实' },
                    { value: 'WYB', label: '文艺' },
                    { value: 'TYB', label: '体育' }
                ];

                let html = '';
                departments.forEach(dept => {
                    const selected = dept.value === 'BGS' ? 'selected' : '';
                    html += `<option value="${dept.value}" ${selected}>${dept.label}</option>`;
                });
                this.departmentFilter.innerHTML = html;
                this.state.department = 'BGS';
            }
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
                        this.resetAndReload();
                    }, 500);
                });
            }

            // 部门筛选 - 只有管理员可以切换
            if (this.departmentFilter && !this.departmentFilter.disabled) {
                this.departmentFilter.addEventListener('change', () => {
                    this.state.department = this.departmentFilter.value;
                    this.resetAndReload();
                });
            }

            // 状态筛选
            if (this.statusFilter) {
                this.statusFilter.addEventListener('change', () => {
                    this.state.status = this.statusFilter.value;
                    this.resetAndReload();
                });
            }

            // 全选
            if (this.checkAll) {
                this.checkAll.addEventListener('change', () => {
                    const checked = this.checkAll.checked;
                    document.querySelectorAll('.row-checkbox').forEach(cb => {
                        cb.checked = checked;
                        const id = parseInt(cb.dataset.id);
                        if (checked) {
                            this.selectedIds.add(id);
                        } else {
                            this.selectedIds.delete(id);
                        }
                    });
                    this.updateUI();
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
                    this.updateUI();
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
                    this.updateUI();
                });
            }

            // 分页
            if (this.prevPage) {
                this.prevPage.addEventListener('click', () => {
                    if (this.page > 1) {
                        this.page--;
                        this.loadData(true);
                    }
                });
            }

            if (this.nextPage) {
                this.nextPage.addEventListener('click', () => {
                    if (this.page < this.state.totalPages) {
                        this.page++;
                        this.loadData(true);
                    }
                });
            }

            // 批量接受
            if (this.batchAcceptBtn) {
                this.batchAcceptBtn.addEventListener('click', () => {
                    if (this.selectedIds.size === 0) {
                        alert('请至少选择一位面试者');
                        return;
                    }
                    this.handleBatchAction('accept');
                });
            }

            // 批量拒绝
            if (this.batchRejectBtn) {
                this.batchRejectBtn.addEventListener('click', () => {
                    if (this.selectedIds.size === 0) {
                        alert('请至少选择一位面试者');
                        return;
                    }
                    this.handleBatchAction('reject');
                });
            }

            // 弹窗关闭
            if (this.resultModal) {
                const closeBtn = this.resultModal.querySelector('.modal-close');
                const closeConfirm = document.getElementById('resultModalClose');
                const overlay = this.resultModal.querySelector('.modal-overlay');

                const closeModal = () => {
                    this.resultModal.classList.remove('active');
                };

                if (closeBtn) closeBtn.addEventListener('click', closeModal);
                if (closeConfirm) closeConfirm.addEventListener('click', closeModal);
                if (overlay) overlay.addEventListener('click', closeModal);

                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && this.resultModal.classList.contains('active')) {
                        closeModal();
                    }
                });
            }
        }

        // ========== 设置无限滚动 ==========
        setupInfiniteScroll() {
            if (!this.tableWrapper) return;

            const scrollContainer = this.tableWrapper;

            scrollContainer.addEventListener('scroll', () => {
                if (this.isLoading || !this.hasMore) return;

                const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
                if (scrollTop + clientHeight >= scrollHeight - 200) {
                    this.loadMore();
                }
            });
        }

        // ========== 重置并重新加载 ==========
        resetAndReload() {
            this.allData = [];
            this.selectedIds.clear();
            this.page = 1;
            this.hasMore = true;
            this.tableBody.innerHTML = '<tr><td colspan="8" class="loading-text">加载中...</td></tr>';
            this.noMoreData.style.display = 'none';
            this.loadMoreIndicator.style.display = 'none';
            this.loadData(true);
        }

        // ========== 加载更多 ==========
        async loadMore() {
            if (this.isLoading || !this.hasMore) return;
            this.page++;
            await this.loadData(false);
        }

        // ========== 加载数据 ==========
        async loadData(reset = true) {
            if (this.isLoading) return;
            this.isLoading = true;
            this.loadMoreIndicator.style.display = 'block';

            const params = new URLSearchParams({
                page: this.page,
                page_size: this.pageSize,
                search: this.state.search,
                department: this.state.department,
                status: this.state.status
            });

            try {
                const response = await fetch(`${this.apiUrl}?${params}`);
                const result = await response.json();

                if (result.success) {
                    if (reset) {
                        this.allData = result.data;
                        this.state.total = result.total;
                        this.state.totalPages = result.total_pages;
                        this.selectedIds.clear();
                    } else {
                        this.allData = [...this.allData, ...result.data];
                    }

                    this.hasMore = this.allData.length < result.total;

                    if (!this.hasMore) {
                        this.noMoreData.style.display = 'block';
                    } else {
                        this.noMoreData.style.display = 'none';
                    }

                    this.renderTable();
                    this.updateUI();
                    this.updatePagination();
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
            } finally {
                this.isLoading = false;
                this.loadMoreIndicator.style.display = 'none';
            }
        }

        // ========== 渲染表格 ==========
        renderTable() {
            if (!this.tableBody) return;

            if (!this.allData || this.allData.length === 0) {
                this.tableBody.innerHTML = '<tr><td colspan="8" class="loading-text">暂无数据</td></tr>';
                return;
            }

            let html = '';
            const startIndex = (this.page - 1) * this.pageSize;

            this.allData.forEach((item, index) => {
                const isSelected = this.selectedIds.has(item.id);
                const serialNum = startIndex + index + 1;

                // 志愿显示 - 根据状态显示不同颜色
                let volunteersHtml = '-';
                if (item.volunteers && item.volunteers.length > 0) {
                    const volTags = item.volunteers
                        .sort((a, b) => a.priority - b.priority)
                        .map(v => {
                            const color = v.status_color || 'blue';
                            return `<span class="volunteer-dept-tag volunteer-${color}">${this.escapeHtml(v.department_display || v.department)}</span>`;
                        });
                    volunteersHtml = volTags.join(' ');
                }

                // 分数显示
                let scoreHtml = '-';
                const avgScore = item.avg_score;
                if (avgScore !== undefined && avgScore !== null && avgScore > 0) {
                    const scoreNum = typeof avgScore === 'number' ? avgScore : parseFloat(avgScore);
                    if (!isNaN(scoreNum) && scoreNum > 0) {
                        const scoreClass = scoreNum >= 8 ? 'score-high' :
                                           scoreNum >= 6 ? 'score-medium' :
                                           scoreNum >= 4 ? 'score-low' : 'score-very-low';
                        scoreHtml = `<span class="score-tag ${scoreClass}">${scoreNum.toFixed(2)}</span>`;
                    }
                }

                // 状态显示
                const statusClass = (item.status || 'incomplete').toLowerCase();
                let statusHtml = `<span class="status-tag status-${statusClass}">${this.escapeHtml(item.status_display || '未完善')}</span>`;

                // 操作按钮 - 保留按钮但根据状态禁用
                const volStatus = item.dept_volunteer_status || '';
                let actionHtml = '';

                // 判断是否可接受（已完成或拒绝状态）
                const canAccept = volStatus === 'COMPLETED' || volStatus === 'REJECTED';
                // 判断是否可拒绝（已完成或接受状态）
                const canReject = volStatus === 'COMPLETED' || volStatus === 'ACCEPTED';

                if (volStatus) {
                    actionHtml = `
                        <button class="btn btn-success btn-sm single-action-btn"
                                data-id="${item.id}"
                                data-action="accept"
                                ${!canAccept ? 'disabled' : ''}
                                title="${!canAccept ? '当前状态无法接受' : '接受该志愿'}">
                            接受
                        </button>
                        <button class="btn btn-danger btn-sm single-action-btn"
                                data-id="${item.id}"
                                data-action="reject"
                                ${!canReject ? 'disabled' : ''}
                                title="${!canReject ? '当前状态无法拒绝' : '拒绝该志愿'}">
                            拒绝
                        </button>
                    `;
                } else {
                    actionHtml = `<span class="text-muted" style="font-size:12px;">无志愿</span>`;
                }

                html += `
                    <tr data-id="${item.id}">
                        <td style="text-align:center;"><input type="checkbox" class="row-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''}></td>
                        <td style="text-align:center;">${serialNum}</td>
                        <td><strong>${this.escapeHtml(item.name)}</strong><br><small style="color:var(--color-text-muted);font-size:12px;">${this.escapeHtml(item.student_number)}</small></td>
                        <td>${this.escapeHtml(item.school)}</td>
                        <td>${statusHtml}</td>
                        <td>${volunteersHtml}</td>
                        <td>${scoreHtml}</td>
                        <td style="text-align:center;">${actionHtml}</td>
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
                    this.updateUI();
                });
            });

            // 绑定单个操作按钮事件（只有未禁用的按钮才绑定）
            document.querySelectorAll('.single-action-btn:not([disabled])').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    const action = btn.dataset.action;
                    if (id && action) {
                        this.handleSingleAction(id, action);
                    }
                });
            });

            // 行点击选中
            document.querySelectorAll('#tableBody tr').forEach(row => {
                row.addEventListener('click', function(e) {
                    if (e.target.closest('input') || e.target.closest('button')) return;
                    const cb = this.querySelector('.row-checkbox');
                    if (cb) {
                        cb.checked = !cb.checked;
                        cb.dispatchEvent(new Event('change'));
                    }
                });
            });

            this.updateUI();
        }

        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // ========== 更新UI ==========
        updateUI() {
            const total = this.state.total || this.allData.length;
            const selected = this.selectedIds.size;

            if (this.totalCount) this.totalCount.textContent = total;
            if (this.selectedCount) this.selectedCount.textContent = selected;

            const checkboxes = document.querySelectorAll('.row-checkbox');
            const checked = document.querySelectorAll('.row-checkbox:checked');

            if (this.checkAll) {
                this.checkAll.checked = checkboxes.length > 0 && checked.length === checkboxes.length;
                this.checkAll.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
            }
        }

        // ========== 更新分页 ==========
        updatePagination() {
            const total = this.state.total;
            const page = this.page;
            const pageSize = this.pageSize;

            const start = (page - 1) * pageSize + 1;
            const end = Math.min(page * pageSize, total);

            if (this.pageStart) this.pageStart.textContent = total > 0 ? start : 0;
            if (this.pageEnd) this.pageEnd.textContent = end;
            if (this.pageTotal) this.pageTotal.textContent = total;
            if (this.currentPage) this.currentPage.textContent = page;
            if (this.totalPages) this.totalPages.textContent = this.state.totalPages;

            if (this.prevPage) this.prevPage.disabled = page <= 1;
            if (this.nextPage) this.nextPage.disabled = page >= this.state.totalPages;
        }

        // ========== 处理单个操作 ==========
        async handleSingleAction(candidateId, action) {
            const actionLabel = action === 'accept' ? '接受' : '拒绝';
            if (!(await Modal.confirm(`确定要${actionLabel}该面试者的志愿吗？`))) {
                return;
            }

            try {
                const response = await fetch(`${this.singleActionUrl}${candidateId}/action/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.csrfToken,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: action,
                        department: this.state.department
                    })
                });

                const result = await response.json();

                if (result.success) {
                    this.resetAndReload();
                    this.showResultModal('操作成功', `已成功${actionLabel}该面试者的志愿`);
                } else {
                    alert(result.message || '操作失败');
                }
            } catch (error) {
                console.error('操作失败:', error);
                alert('操作失败，请重试');
            }
        }

        // ========== 处理批量操作 ==========
        async handleBatchAction(action) {
            const actionLabel = action === 'accept' ? '接受' : '拒绝';
            if (!(await Modal.confirm(`确定要${actionLabel}选中的 ${this.selectedIds.size} 位面试者的志愿吗？\n\n注意：只有状态为"已完成"或"拒绝"的志愿可以被接受\n      只有状态为"已完成"或"接受"的志愿可以被拒绝`))) {
                return;
            }

            const candidateIds = Array.from(this.selectedIds);
            const url = action === 'accept' ? this.acceptUrl : this.rejectUrl;

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.csrfToken,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        candidate_ids: candidateIds,
                        department: this.state.department
                    })
                });

                const result = await response.json();

                if (result.success) {
                    const data = result.data;
                    this.showBatchResultModal(action, data);
                    this.resetAndReload();
                } else {
                    alert(result.message || '操作失败');
                }
            } catch (error) {
                console.error('操作失败:', error);
                alert('操作失败，请重试');
            }
        }

        // ========== 显示结果弹窗 ==========
        showResultModal(title, message) {
            const titleEl = document.getElementById('resultModalTitle');
            const contentEl = document.getElementById('resultContent');

            if (titleEl) titleEl.textContent = title;
            if (contentEl) {
                contentEl.innerHTML = `
                    <div style="text-align:center;padding:20px 0;">
                        <div style="font-size:48px;margin-bottom:12px;">🆗</div>
                        <p style="font-size:16px;color:var(--color-text);">${this.escapeHtml(message)}</p>
                    </div>
                `;
            }

            if (this.resultModal) {
                this.resultModal.classList.add('active');
            }
        }

        // ========== 显示批量操作结果 ==========
        showBatchResultModal(action, data) {
            const titleEl = document.getElementById('resultModalTitle');
            const contentEl = document.getElementById('resultContent');

            const actionLabel = action === 'accept' ? '接受' : '拒绝';

            if (titleEl) titleEl.textContent = `批量${actionLabel}结果`;

            let resultsHtml = `
                <div style="margin-bottom:16px;padding:12px 16px;background:var(--color-surface);border-radius:var(--radius-sm);border:1px solid var(--color-border);">
                    <div style="display:flex;gap:24px;flex-wrap:wrap;">
                        <span>总计：<strong>${data.total}</strong> 人</span>
                        <span style="color:var(--color-success);">成功：<strong>${data.success_count}</strong> 人</span>
                        <span style="color:var(--color-danger);">失败：<strong>${data.fail_count}</strong> 人</span>
                    </div>
                </div>
                <div style="max-height:300px;overflow-y:auto;">
            `;

            if (data.results && data.results.length > 0) {
                data.results.forEach(item => {
                    const icon = item.success ? '✅' : '❌';
                    const color = item.success ? 'var(--color-success)' : 'var(--color-danger)';
                    const name = item.name || `ID: ${item.candidate_id}`;
                    resultsHtml += `
                        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--color-border);font-size:14px;">
                            <span style="color:${color};">${icon}</span>
                            <span><strong>${this.escapeHtml(name)}</strong></span>
                            <span style="color:var(--color-text-secondary);font-size:13px;">${this.escapeHtml(item.message)}</span>
                        </div>
                    `;
                });
            }

            resultsHtml += '</div>';

            if (contentEl) {
                contentEl.innerHTML = resultsHtml;
            }

            if (this.resultModal) {
                this.resultModal.classList.add('active');
            }
        }
    }

    if (document.getElementById('candidateTable')) {
        window.volunteerManager = new VolunteerManager();
    }
});