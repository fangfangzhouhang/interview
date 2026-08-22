/* ============================================================
   管理员控制台 - 叫号控制逻辑
   - 数据刷新：30秒轮询
   - 叫号操作：结束当前、叫下一位、开始面试
   - 教室设置：快速设置教室
   ============================================================ */
(function () {
    'use strict';

    var REFRESH_INTERVAL = 30000;
    var state = {
        data: [],
        csrfToken: null,
        refreshTimer: null,
    };

    // ---------- 初始化 ----------
    function init() {
        var csrfEl = document.getElementById('csrfToken');
        if (csrfEl) state.csrfToken = csrfEl.value;

        updateClock();
        setInterval(updateClock, 1000);

        fetchData();
        state.refreshTimer = setInterval(fetchData, REFRESH_INTERVAL);

        // 绑定全局刷新按钮
        var btnRefresh = document.getElementById('adminRefresh');
        var btnGlobalRefresh = document.getElementById('btnGlobalRefresh');
        if (btnRefresh) btnRefresh.addEventListener('click', fetchData);
        if (btnGlobalRefresh) btnGlobalRefresh.addEventListener('click', fetchData);
    }

    function updateClock() {
        var now = new Date();
        var hh = String(now.getHours()).padStart(2, '0');
        var mm = String(now.getMinutes()).padStart(2, '0');
        var ss = String(now.getSeconds()).padStart(2, '0');
        var el = document.getElementById('adminTime');
        if (el) el.textContent = hh + ':' + mm + ':' + ss;
    }

    // ---------- 提示 ----------
    function showToast(msg, type) {
        var container = document.getElementById('adminToastContainer');
        if (!container) return;
        var toast = document.createElement('div');
        toast.className = 'admin-toast ' + (type === 'error' ? 'error' : 'success');
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(function () {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(120%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(function () { toast.remove(); }, 300);
        }, 3000);
    }

    // ---------- 数据获取 ----------
    function fetchData() {
        fetch('/api/board/', { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res.success) {
                    state.data = res.data;
                    renderDeptGrid();
                }
            })
            .catch(function (e) {
                console.error('数据加载失败:', e);
            });
    }

    // ---------- 渲染部门卡片 ----------
    function renderDeptGrid() {
        var grid = document.getElementById('adminDeptGrid');
        if (!grid || !state.data || !state.data.length) return;

        var html = '';
        state.data.forEach(function (dept) {
            html += renderDeptCard(dept);
        });
        grid.innerHTML = html;

        // 绑定控制事件
        bindDeptEvents();
    }

    function renderDeptCard(dept) {
        var groups = dept.groups || [];
        var queue = dept.display_queue || [];
        var waitingTotal = dept.waiting_total || 0;

        var html = '<div class="admin-dept-card">';
        html += '<div class="admin-dept-name">' + escapeHtml(dept.department_name) + '部';
        html += ' <span style="font-size:13px; color:#64748b; font-weight:normal;">' + escapeHtml(dept.department) + '</span>';
        html += '</div>';

        html += '<div class="admin-dept-status">';
        html += '<span>状态：' + escapeHtml(dept.status) + '</span>';
        html += ' | 等待：' + waitingTotal + '人';
        html += ' | 教室：' + escapeHtml(dept.classroom || '待安排');
        html += '</div>';

        // 显示队列预览
        html += '<div class="admin-dept-queue">';
        if (queue.length > 0) {
            var displayQueue = queue.slice(0, 5);
            displayQueue.forEach(function (item) {
                var statusDot = getStatusDot(item.call_status);
                html += '<div class="admin-dept-queue-item">';
                html += '<span><span class="admin-status-dot ' + statusDot + '"></span>' + escapeHtml(item.name) + '</span>';
                html += '<span style="font-size:12px; color:#64748b;">' + escapeHtml(item.call_status_display || item.call_status) + '</span>';
                html += '</div>';
            });
            if (queue.length > 5) {
                html += '<div style="text-align:center; color:#94a3b8; font-size:12px; padding-top:4px;">还有 ' + (queue.length - 5) + ' 人...</div>';
            }
        } else {
            html += '<div style="color:#94a3b8; text-align:center;">暂无排队</div>';
        }
        html += '</div>';

        // 场次选择与控制
        if (groups.length > 0) {
            html += '<select class="admin-group-select" data-dept="' + escapeHtml(dept.department) + '">';
            groups.forEach(function (g, idx) {
                var label = g.group_code || ('场次 #' + g.group_id);
                var currentName = g.current ? g.current.name : '无';
                html += '<option value="' + g.group_id + '">' + label + ' · 当前：' + currentName + '</option>';
            });
            html += '</select>';

            html += '<div class="admin-dept-actions">';
            html += '<button class="admin-mini-btn admin-mini-btn-primary act-call-next" data-dept="' + escapeHtml(dept.department) + '">🎤 叫下一位</button>';
            html += '<button class="admin-mini-btn admin-mini-btn-success act-start" data-dept="' + escapeHtml(dept.department) + '">▶ 开始面试</button>';
            html += '<button class="admin-mini-btn admin-mini-btn-secondary act-end" data-dept="' + escapeHtml(dept.department) + '">⏹ 结束当前</button>';
            html += '<button class="admin-mini-btn admin-mini-btn-warning act-skip" data-dept="' + escapeHtml(dept.department) + '">⏭ 跳过</button>';
            html += '</div>';
        } else {
            html += '<div style="text-align:center; color:#94a3b8; padding:10px;">该部门暂无活跃场次</div>';
        }

        html += '</div>';
        return html;
    }

    function getStatusDot(status) {
        switch (status) {
            case 'INTERVIEWING': return 'interviewing';
            case 'CALLED': return 'called';
            case 'FINISHED': return 'finished';
            default: return 'waiting';
        }
    }

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ---------- 事件绑定 ----------
    function bindDeptEvents() {
        document.querySelectorAll('.act-call-next').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var dept = btn.dataset.dept;
                var groupId = getSelectedGroupId(dept);
                if (groupId) callAction(groupId, 'call_next');
            });
        });

        document.querySelectorAll('.act-start').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var dept = btn.dataset.dept;
                var groupId = getSelectedGroupId(dept);
                if (groupId) callAction(groupId, 'start_interview');
            });
        });

        document.querySelectorAll('.act-end').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var dept = btn.dataset.dept;
                var groupId = getSelectedGroupId(dept);
                if (groupId) {
                    if (confirm('确认结束当前面试？该操作将把当前面试者标记为完成。')) {
                        callAction(groupId, 'call_next');
                    }
                }
            });
        });

        document.querySelectorAll('.act-skip').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var dept = btn.dataset.dept;
                var groupId = getSelectedGroupId(dept);
                if (groupId) {
                    if (confirm('确认跳过当前面试者？该操作将跳过当前叫号直接叫下一位。')) {
                        callAction(groupId, 'skip');
                    }
                }
            });
        });
    }

    function getSelectedGroupId(dept) {
        var select = document.querySelector('.admin-group-select[data-dept="' + dept + '"]');
        if (!select) {
            showToast('未找到场次选择', 'error');
            return null;
        }
        return parseInt(select.value, 10);
    }

    // ---------- API 调用 ----------
    function callAction(groupId, action) {
        var body = { action: action };
        if (action === 'skip') {
            body = { action: 'call_next' };
        }

        fetch('/api/board/call-next/' + groupId + '/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': state.csrfToken || '',
            },
            credentials: 'same-origin',
            body: JSON.stringify(body),
        })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res.success) {
                    showToast(res.message || '操作成功', 'success');
                    fetchData();
                } else {
                    showToast(res.message || '操作失败', 'error');
                }
            })
            .catch(function (e) {
                console.error('操作失败:', e);
                showToast('网络错误，请重试', 'error');
            });
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
