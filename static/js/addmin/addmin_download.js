// addmin_download.js
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

    // ========== 下载管理 ==========
    class DownloadManager {
        constructor() {
            this.apiUrl = '/api/addmin/download/candidates/';
            this.exportUrl = '/api/addmin/download/export/';
            this.tableBody = document.getElementById('tableBody');
            this.tableWrapper = document.getElementById('tableWrapper');
            this.searchInput = document.getElementById('searchInput');
            this.departmentFilter = document.getElementById('departmentFilter');
            this.checkAll = document.getElementById('checkAll');
            this.selectAllBtn = document.getElementById('selectAllBtn');
            this.deselectAllBtn = document.getElementById('deselectAllBtn');
            this.totalCount = document.getElementById('totalCount');
            this.selectedCount = document.getElementById('selectedCount');
            this.batchDownloadBtn = document.getElementById('batchDownloadBtn');
            this.downloadModal = document.getElementById('downloadModal');
            this.loadMoreIndicator = document.getElementById('loadMoreIndicator');
            this.noMoreData = document.getElementById('noMoreData');

            this.allData = [];
            this.selectedIds = new Set();
            this.isLoading = false;
            this.hasMore = true;
            this.page = 1;
            this.pageSize = 50;
            this.state = {
                search: '',
                department: '',
                sort: 'avg_score',
                order: 'desc',
                total: 0
            };

            this.init();
        }

        async init() {
            await this.loadData(true);
            this.bindEvents();
            this.setupInfiniteScroll();
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

            // 部门筛选
            if (this.departmentFilter) {
                this.departmentFilter.addEventListener('change', () => {
                    this.state.department = this.departmentFilter.value;
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

            // 批量下载按钮
            if (this.batchDownloadBtn) {
                this.batchDownloadBtn.addEventListener('click', () => {
                    if (this.selectedIds.size === 0) {
                        alert('请至少选择一位面试者');
                        return;
                    }
                    this.openDownloadModal();
                });
            }

            // 弹窗关闭
            if (this.downloadModal) {
                const closeBtn = this.downloadModal.querySelector('.modal-close');
                const cancelBtn = document.getElementById('downloadCancel');
                const overlay = this.downloadModal.querySelector('.modal-overlay');

                const closeModal = () => {
                    this.downloadModal.classList.remove('active');
                };

                if (closeBtn) closeBtn.addEventListener('click', closeModal);
                if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
                if (overlay) overlay.addEventListener('click', closeModal);

                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && this.downloadModal.classList.contains('active')) {
                        closeModal();
                    }
                });
            }

            // 下载确认
            const downloadConfirm = document.getElementById('downloadConfirm');
            if (downloadConfirm) {
                downloadConfirm.addEventListener('click', () => {
                    this.handleDownload();
                });
            }

            // 选项卡片复选框变化时同步视觉状态
            if (this.downloadModal) {
                this.downloadModal.addEventListener('change', (e) => {
                    if (e.target.matches('.include-field, .export-format')) {
                        this.updateOptionCards();
                    }
                });
                // 点击卡片区域也触发状态更新（点击label时change可能先于视觉更新）
                this.downloadModal.addEventListener('click', (e) => {
                    const card = e.target.closest('.option-card');
                    if (card) {
                        // 延迟一帧等待checkbox状态更新
                        requestAnimationFrame(() => {
                            this.updateOptionCards();
                        });
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
                // 距离底部200px时触发加载
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
            this.loadData();
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
                sort: this.state.sort,
                order: this.state.order
            });

            try {
                const response = await fetch(`${this.apiUrl}?${params}`);
                const result = await response.json();

                if (result.success) {
                    if (reset) {
                        this.allData = result.data;
                        this.state.total = result.total;
                        this.selectedIds.clear();
                    } else {
                        this.allData = [...this.allData, ...result.data];
                    }

                    // 检查是否还有更多数据
                    this.hasMore = this.allData.length < result.total;

                    if (!this.hasMore) {
                        this.noMoreData.style.display = 'block';
                    } else {
                        this.noMoreData.style.display = 'none';
                    }

                    this.renderTable();
                    this.updateUI();
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
            this.allData.forEach((item, index) => {
                const isSelected = this.selectedIds.has(item.id);
                const serialNum = index + 1;

                // 志愿显示
                let volunteersHtml = '-';
                if (item.volunteers && item.volunteers.length > 0) {
                    const volLabels = item.volunteers
                        .sort((a, b) => a.priority - b.priority)
                        .map(v => v.department_display || v.department);
                    volunteersHtml = volLabels.map(v =>
                        `<span class="volunteer-dept-tag">${this.escapeHtml(v)}</span>`
                    ).join(' ');
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

                html += `
                    <tr data-id="${item.id}">
                        <td style="text-align:center;"><input type="checkbox" class="row-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''}></td>
                        <td style="text-align:center;">${serialNum}</td>
                        <td><strong>${this.escapeHtml(item.name)}</strong><br><small style="color:var(--color-text-muted);font-size:12px;">${this.escapeHtml(item.student_number)}</small></td>
                        <td>${this.escapeHtml(item.school)}</td>
                        <td>${statusHtml}</td>
                        <td>${volunteersHtml}</td>
                        <td>${scoreHtml}</td>
                        <td style="text-align:center;color:var(--color-text-muted);font-size:12px;">-</td>
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

            // 行点击选中
            document.querySelectorAll('#tableBody tr').forEach(row => {
                row.addEventListener('click', function(e) {
                    if (e.target.closest('input')) return;
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

            // 更新全选状态
            const checkboxes = document.querySelectorAll('.row-checkbox');
            const checked = document.querySelectorAll('.row-checkbox:checked');

            if (this.checkAll) {
                this.checkAll.checked = checkboxes.length > 0 && checked.length === checkboxes.length;
                this.checkAll.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
            }
        }

        // ========== 更新部门显示 ==========
        updateDepartmentDisplay() {
            const displayEl = document.getElementById('currentDepartmentDisplay');
            if (displayEl) {
                const filter = this.departmentFilter;
                if (filter) {
                    const selectedOption = filter.options[filter.selectedIndex];
                    displayEl.textContent = selectedOption ? selectedOption.text : '全部';
                }
            }
        }

        // ========== 打开下载弹窗 ==========
        openDownloadModal() {
            if (this.downloadModal) {
                // 更新统计信息
                const countEl = document.getElementById('selectedCountDisplay');
                if (countEl) countEl.textContent = this.selectedIds.size;
                this.updateDepartmentDisplay();

                // 重置选择
                document.querySelectorAll('.include-field').forEach(cb => cb.checked = false);
                document.querySelectorAll('.export-format').forEach(cb => {
                    cb.checked = cb.value === 'standard_data';
                });

                // 更新卡片选中状态
                this.updateOptionCards();

                this.downloadModal.classList.add('active');
            }
        }

        // ========== 更新选项卡片状态 ==========
        updateOptionCards() {
            document.querySelectorAll('.option-card').forEach(card => {
                const checkbox = card.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    card.classList.toggle('active', checkbox.checked);
                }
            });
        }

        // ========== 处理下载 ==========
        async handleDownload() {
            const includeFields = [];
            document.querySelectorAll('.include-field:checked').forEach(cb => {
                includeFields.push(cb.value);
            });

            const exportFormats = [];
            document.querySelectorAll('.export-format:checked').forEach(cb => {
                exportFormats.push(cb.value);
            });

            if (exportFormats.length === 0) {
                alert('请至少选择一种下载格式');
                return;
            }

            const candidateIds = Array.from(this.selectedIds);
            const department = this.state.department;

            try {
                const response = await fetch(this.exportUrl, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.getCSRFToken(),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        candidate_ids: candidateIds,
                        include_fields: includeFields,
                        export_format: exportFormats,
                        department: department
                    })
                });

                const result = await response.json();

                if (result.success) {
                    if (this.downloadModal) {
                        this.downloadModal.classList.remove('active');
                    }

                    const filename = result.filename || `数据导出_面试者_${new Date().toISOString().slice(0,10)}.json`;

                    if (exportFormats.includes('standard_data') || exportFormats.includes('pdf')) {
                        this.downloadJSON(result.data, filename);
                    }

                    if (exportFormats.includes('pdf') && !exportFormats.includes('standard_data')) {
                        alert('PDF文件生成功能即将支持，已导出标准化数据（JSON格式）');
                    }

                    // 清除选中状态
                    this.selectedIds.clear();
                    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = false);
                    this.updateUI();

                } else {
                    alert(result.message || '导出失败');
                }
            } catch (error) {
                console.error('导出失败:', error);
                alert('导出失败，请重试');
            }
        }

        // ========== 下载JSON数据 ==========
        downloadJSON(data, filename) {
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || `数据导出_面试者_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // ========== 获取CSRF Token ==========
        getCSRFToken() {
            const token = document.querySelector('[name=csrfmiddlewaretoken]');
            return token ? token.value : '';
        }
    }

    if (document.getElementById('downloadTable')) {
        window.downloadManager = new DownloadManager();
    }
});