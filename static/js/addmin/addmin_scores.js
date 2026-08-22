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

    // ========== 评价信息管理 ==========
    class ScoreManager {
        constructor() {
            this.apiUrl = '/api/addmin/scores/';
            this.tableBody = document.getElementById('tableBody');
            this.searchInput = document.getElementById('searchInput');
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

            this.selectedIds = new Set();
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
            await this.loadOptions();
            this.loadData();
            this.bindEvents();
        }

        // ========== 加载选项数据 ==========
        async loadOptions() {
            try {
                const response = await fetch('/api/addmin/scores/options/');
                const result = await response.json();

                if (result.success) {
                    this.departmentOptions = result.departments || [];
                    this.statusOptions = result.statuses || [];
                } else {
                    console.error('加载选项失败:', result.message);
                }
            } catch (error) {
                console.error('加载选项失败:', error);
            }
        }

        // ========== 绑定事件 ==========
        bindEvents() {
            if (this.searchInput) {
                let timer;
                this.searchInput.addEventListener('input', function() {
                    clearTimeout(timer);
                    timer = setTimeout(function() {
                        this.state.search = this.searchInput.value;
                        this.state.page = 1;
                        this.loadData();
                    }.bind(this), 500);
                }.bind(this));
            }

            if (this.departmentFilter) {
                this.departmentFilter.addEventListener('change', function() {
                    this.state.department = this.departmentFilter.value;
                    this.state.page = 1;
                    this.loadData();
                }.bind(this));
            }

            if (this.checkAll) {
                this.checkAll.addEventListener('change', function() {
                    var checked = this.checkAll.checked;
                    document.querySelectorAll('.row-checkbox').forEach(function(cb) {
                        cb.checked = checked;
                        if (checked) {
                            this.selectedIds.add(parseInt(cb.dataset.id));
                        } else {
                            this.selectedIds.delete(parseInt(cb.dataset.id));
                        }
                    }.bind(this));
                    this.updateSelectAllState();
                }.bind(this));
            }

            if (this.selectAllBtn) {
                this.selectAllBtn.addEventListener('click', function() {
                    document.querySelectorAll('.row-checkbox').forEach(function(cb) {
                        cb.checked = true;
                        this.selectedIds.add(parseInt(cb.dataset.id));
                    }.bind(this));
                    if (this.checkAll) this.checkAll.checked = true;
                    this.updateSelectAllState();
                }.bind(this));
            }

            if (this.deselectAllBtn) {
                this.deselectAllBtn.addEventListener('click', function() {
                    document.querySelectorAll('.row-checkbox').forEach(function(cb) {
                        cb.checked = false;
                        this.selectedIds.delete(parseInt(cb.dataset.id));
                    }.bind(this));
                    if (this.checkAll) this.checkAll.checked = false;
                    this.updateSelectAllState();
                }.bind(this));
            }

            document.querySelectorAll('[data-sort]').forEach(function(th) {
                th.addEventListener('click', function() {
                    var field = th.dataset.sort;
                    if (this.state.sort === field) {
                        this.state.order = this.state.order === 'asc' ? 'desc' : 'asc';
                    } else {
                        this.state.sort = field;
                        this.state.order = 'asc';
                    }
                    this.loadData();
                }.bind(this));
            }.bind(this));

            if (this.prevPage) {
                this.prevPage.addEventListener('click', function() {
                    if (this.state.page > 1) {
                        this.state.page--;
                        this.loadData();
                    }
                }.bind(this));
            }

            if (this.nextPage) {
                this.nextPage.addEventListener('click', function() {
                    if (this.state.page < this.state.totalPages) {
                        this.state.page++;
                        this.loadData();
                    }
                }.bind(this));
            }

            this.bindModalEvents('detailModal', '#detailModalClose', '#detailModalCancel');
        }

        // ========== 绑定弹窗事件 ==========
        bindModalEvents(modalId, closeSelector, cancelSelector) {
            var modal = document.getElementById(modalId);
            if (!modal) return;
            var closeBtn = modal.querySelector(closeSelector);
            var cancelBtn = modal.querySelector(cancelSelector);
            var overlay = modal.querySelector('.modal-overlay');
            var closeModal = function() { modal.classList.remove('active'); };
            if (closeBtn) closeBtn.addEventListener('click', closeModal);
            if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
            if (overlay) overlay.addEventListener('click', closeModal);
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && modal.classList.contains('active')) {
                    closeModal();
                }
            });
        }

        // ========== 加载数据 ==========
        async loadData() {
            var params = new URLSearchParams({
                page: this.state.page,
                page_size: this.state.pageSize,
                search: this.state.search,
                department: this.state.department,
                sort: this.state.sort,
                order: this.state.order
            });
            try {
                var response = await fetch(this.apiUrl + '?' + params.toString());
                var result = await response.json();
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
                this.tableBody.innerHTML = '<tr><td colspan="9" class="loading-text">暂无评价数据</td></tr>';
                return;
            }

            var html = '';
            data.forEach(function(item) {
                var isSelected = this.selectedIds.has(item.id);
                var statusClass = this.getStatusClass(item.group_status_code);
                var scoreClass = this.getScoreClass(item.score);

                html += `
                    <tr data-id="${item.id}">
                        <td><input type="checkbox" class="row-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''}></td>
                        <td>${item.id}</td>
                        <td><span class="department-tag">${item.department}</span></td>
                        <td>${item.interviewer_name}</td>
                        <td>${item.candidate_name}<br><span style="font-size:12px;color:#999;">${item.candidate_student_number}</span></td>
                        <td><span class="score-tag ${scoreClass}">${item.score} 分</span></td>
                        <td>${item.group_name}</td>
                        <td><span class="status-tag ${statusClass}">${item.group_status}</span></td>
                        <td>
                            <button class="btn btn-primary btn-sm view-btn" data-group-id="${item.group_id}">查看场次</button>
                        </td>
                    </tr>
                `;
            }.bind(this));

            this.tableBody.innerHTML = html;

            document.querySelectorAll('.row-checkbox').forEach(function(cb) {
                cb.addEventListener('change', function() {
                    var id = parseInt(cb.dataset.id);
                    if (cb.checked) {
                        this.selectedIds.add(id);
                    } else {
                        this.selectedIds.delete(id);
                    }
                    this.updateSelectAllState();
                }.bind(this));
            }.bind(this));

            document.querySelectorAll('.view-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var groupId = parseInt(btn.dataset.groupId);
                    this.openDetailModal(groupId);
                }.bind(this));
            }.bind(this));

            this.updateSelectAllState();
        }

        getStatusClass(status) {
            var map = {
                'PENDING': 'status-pending',
                'ONGOING': 'status-ongoing',
                'PAUSE': 'status-pause',
                'ENDED': 'status-ended',
                'CANCELLED': 'status-cancelled'
            };
            return map[status] || '';
        }

        getScoreClass(score) {
            var numScore = parseFloat(score) || 0;
            if (numScore >= 80) return 'score-high';
            if (numScore >= 60) return 'score-medium';
            if (numScore >= 40) return 'score-low';
            if (numScore > 0) return 'score-very-low';
            return 'score-zero';
        }

        updatePagination() {
            var total = this.state.total;
            var page = this.state.page;
            var pageSize = this.state.pageSize;
            var start = (page - 1) * pageSize + 1;
            var end = Math.min(page * pageSize, total);

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
            var checkboxes = document.querySelectorAll('.row-checkbox');
            var checked = document.querySelectorAll('.row-checkbox:checked');
            if (this.checkAll) {
                this.checkAll.checked = checkboxes.length > 0 && checked.length === checkboxes.length;
                this.checkAll.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
            }
        }

        // ========== 打开详情弹窗 ==========
        async openDetailModal(groupId) {
            var modal = document.getElementById('detailModal');
            if (!modal) return;
            try {
                var response = await fetch('/api/addmin/groups/' + groupId + '/scores/');
                var result = await response.json();
                if (result.success) {
                    this.renderDetail(result.data);
                    modal.classList.add('active');
                } else {
                    alert(result.message || '加载详情失败');
                }
            } catch (error) {
                console.error('加载详情失败:', error);
                alert('加载详情失败，请重试');
            }
        }

        // ========== 渲染详情 ==========
        renderDetail(data) {
            var container = document.getElementById('detailContent');
            if (!container) return;
            if (!data || data.length === 0) {
                container.innerHTML = '<div class="empty-hint">暂无评价数据</div>';
                return;
            }

            var html = '<div class="detail-scores">';
            data.forEach(function(candidate) {
                html += `
                    <div class="detail-candidate">
                        <div class="detail-candidate-header">
                            <span class="detail-candidate-name">${candidate.candidate_name}</span>
                            <span class="detail-candidate-info">${candidate.student_number} | 序号 ${candidate.order} | 平均分: <strong>${candidate.avg_score || 0}</strong></span>
                        </div>
                        <div class="detail-scores-list">
                `;

                if (candidate.scores && candidate.scores.length > 0) {
                    candidate.scores.forEach(function(score) {
                        var scoreNum = parseFloat(score.score) || 0;
                        var scoreDisplay = scoreNum > 0 ? scoreNum + ' / 100 分' : '未评分';
                        var scoreClass = this.getScoreClass(scoreNum);

                        var selfIntro = score.self_intro || '';
                        var comment = score.comment || '';
                        var hasSelfIntro = selfIntro.trim().length > 0;
                        var hasComment = comment.trim().length > 0;
                        var dimDetails = score.dimension_details || [];
                        var hasDimensions = dimDetails.length > 0;

                        html += `
                            <div class="detail-score-item">
                                <div class="detail-score-header">
                                    <span class="detail-score-interviewer">${score.interviewer_name}</span>
                                    <span class="detail-score-total ${scoreClass}">${scoreDisplay}</span>
                                </div>
                        `;

                        if (hasDimensions) {
                            html += '<div class="detail-score-dimensions"><div class="dimensions-title">评分维度详情</div><div class="dimensions-grid">';
                            dimDetails.forEach(function(dim) {
                                var dimScore = parseFloat(dim.score) || 0;
                                var dimPct = parseFloat(dim.percentage) || 0;
                                var dimClass = dimScore >= dim.max_score * 0.8 ? 'dim-high' : (dimScore >= dim.max_score * 0.6 ? 'dim-medium' : 'dim-low');
                                html += `
                                    <div class="dim-item">
                                        <div class="dim-item-header">
                                            <span class="dim-name">${dim.name}</span>
                                            <span class="dim-score ${dimClass}">${dimScore}/${dim.max_score}</span>
                                        </div>
                                        <div class="dim-bar">
                                            <div class="dim-bar-fill" style="width:${dimPct}%"></div>
                                        </div>
                                    </div>
                                `;
                            });
                            html += '</div></div>';
                        }

                        html += `
                                <div class="detail-score-body">
                                    <div class="detail-score-field">
                                        <span class="detail-score-label">自我介绍记录：</span>
                                        <span class="detail-score-text ${hasSelfIntro ? '' : 'empty-text'}">${hasSelfIntro ? selfIntro : '（暂未填写）'}</span>
                                    </div>
                                    <div class="detail-score-field">
                                        <span class="detail-score-label">评语：</span>
                                        <span class="detail-score-text ${hasComment ? '' : 'empty-text'}">${hasComment ? comment : '（暂未填写）'}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }.bind(this));
                } else {
                    html += '<div class="empty-hint">暂无评分</div>';
                }

                html += `
                        </div>
                    </div>
                `;
            }.bind(this));
            html += '</div>';
            container.innerHTML = html;
        }
    }

    // 初始化评价管理
    if (document.getElementById('scoreTable')) {
        new ScoreManager();
    }
});