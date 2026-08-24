/* ============================================================
   管理员控制台 - 叫号控制逻辑（按人操作模式）
   - 数据刷新：30秒轮询
   - 每人独立操作：叫号/开始面试/完成
   - 支持同时管理多人面试
   - 统计卡片：总人数、已完成、等待中、叫号/面试中
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

        var btnRefresh = document.getElementById('adminRefresh');
        if (btnRefresh) btnRefresh.addEventListener('click', function () {
            btnRefresh.style.transform = 'rotate(360deg)';
            btnRefresh.style.transition = 'transform 0.6s ease';
            setTimeout(function () {
                btnRefresh.style.transform = '';
                btnRefresh.style.transition = '';
            }, 600);
            fetchData();
        });
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
        var grid = document.getElementById('adminDeptGrid');
        if (grid) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #94a3b8;"><div style="font-size: 40px; margin-bottom: 12px;">⏳</div><div>正在加载部门数据...</div></div>';
        }

        fetch('/api/board/', { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res.success) {
                    state.data = res.data;
                    updateStats();
                    renderDeptGrid();
                } else {
                    showToast(res.message || '数据加载失败', 'error');
                    if (grid) {
                        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #ef4444;"><div style="font-size: 40px; margin-bottom: 12px;">⚠️</div><div>' + escapeHtml(res.message || '数据加载失败') + '</div></div>';
                    }
                }
            })
            .catch(function (e) {
                console.error('数据加载失败:', e);
                if (grid) {
                    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #ef4444;"><div style="font-size: 40px; margin-bottom: 12px;">⚠️</div><div>网络错误，请刷新页面</div></div>';
                }
            });
    }

    // ---------- 更新统计卡片 ----------
    function updateStats() {
        var total = 0, finished = 0, waiting = 0, calling = 0;

        state.data.forEach(function (dept) {
            var queue = dept.display_queue || [];
            queue.forEach(function (item) {
                total++;
                var status = item.call_status || 'WAITING';
                if (status === 'FINISHED') finished++;
                else if (status === 'WAITING') waiting++;
                else if (status === 'CALLED' || status === 'INTERVIEWING') calling++;
            });
        });

        setStat('statTotal', total);
        setStat('statFinished', finished);
        setStat('statWaiting', waiting);
        setStat('statCalling', calling);
    }

    function setStat(id, value) {
        var el = document.getElementById(id);
        if (!el) return;
        el.textContent = value;
        el.parentElement.style.transition = 'transform 0.3s ease';
        el.parentElement.style.transform = 'scale(1.05)';
        setTimeout(function () {
            el.parentElement.style.transform = '';
        }, 300);
    }

    // ---------- 渲染部门卡片 ----------
    function renderDeptGrid() {
        var grid = document.getElementById('adminDeptGrid');
        if (!grid) return;

        if (!state.data || !state.data.length) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #94a3b8;"><div style="font-size: 40px; margin-bottom: 12px;">📭</div><div>暂无部门数据</div></div>';
            return;
        }

        var html = '';
        state.data.forEach(function (dept) {
            html += renderDeptCard(dept);
        });
        grid.innerHTML = html;

        bindPersonEvents();
    }

    function renderDeptCard(dept) {
        var groups = dept.groups || [];
        var queue = dept.display_queue || [];
        var waitingTotal = dept.waiting_total || 0;

        var html = '<div class="admin-dept-card">';

        // 部门标题
        html += '<div class="admin-dept-header">';
        html += '<div class="admin-dept-title-row">';
        html += '<div class="admin-dept-name">' + escapeHtml(dept.department_name) + '部';
        html += ' <span class="admin-dept-badge">' + escapeHtml(dept.department) + '</span>';
        html += '</div>';
        html += '</div>';
        html += '<div class="admin-dept-status">';
        html += '<span>📊 状态：' + escapeHtml(dept.status) + '</span>';
        html += '<span>⏳ 等待：' + waitingTotal + '人</span>';
        if (dept.classroom) {
            html += '<span>📍 ' + escapeHtml(dept.classroom) + '</span>';
        }
        html += '</div>';
        html += '</div>';

        // 场次选择（仅当有活跃场次时显示）
        if (groups.length > 0) {
            html += '<select class="admin-group-select" data-dept="' + escapeHtml(dept.department) + '">';
            groups.forEach(function (g) {
                var label = g.group_code || ('场次 #' + g.group_id);
                var waiting = g.waiting_count || 0;
                html += '<option value="' + g.group_id + '">' + label + ' · 等待' + waiting + '人</option>';
            });
            html += '</select>';

            // 面试官信息展示
            groups.forEach(function (g) {
                if (g.interviewers && g.interviewers.length > 0) {
                    html += '<div class="admin-dept-interviewers" title="本场次面试官">';
                    html += '<span style="font-size:12px; color:#64748b; margin-right:4px;">🎤 面试官：</span>';
                    g.interviewers.forEach(function (iv) {
                        html += '<span class="admin-dept-interviewer-tag">';
                        html += escapeHtml(iv.name);
                        html += '</span>';
                    });
                    html += '</div>';
                }
            });
        }

        // 队列详细列表（只要有排队数据就显示，包括候场志愿者）
        if (queue.length > 0) {
            html += '<div class="admin-dept-detail">';
            html += '<div style="font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">';
            html += '<span style="width: 3px; height: 14px; background: linear-gradient(180deg, #3b82f6, #1d4ed8); border-radius: 2px;"></span>';
            html += '📋 队列详情（共' + queue.length + '人）';
            html += '</div>';

            queue.forEach(function (item) {
                html += renderQueueRow(item, dept);
            });

            html += '</div>';
        } else {
            html += '<div style="text-align:center; color: #94a3b8; padding: 30px 20px; font-size: 13px;">';
            html += '<div style="font-size: 36px; margin-bottom: 8px;">📋</div>';
            html += '暂无排队人员';
            html += '</div>';
        }

        // 无活跃场次时显示"创建场次"入口
        if (groups.length === 0) {
            html += '<div class="admin-dept-create">';
            html += '<button class="admin-create-group-btn" data-dept="' + escapeHtml(dept.department) + '">➕ 创建场次</button>';
            html += '<span style="font-size:12px; color:#64748b; margin-left:8px;">创建后候场人员可"叫号进场"</span>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    function renderQueueRow(item, dept) {
        var status = item.call_status || 'WAITING';
        var statusDisplay = item.call_status_display || getStatusText(status);
        var rowClass = getRowClass(status);

        var html = '<div class="admin-queue-row ' + rowClass + '">';

        // 信息列
        html += '<div class="admin-queue-row-info">';
        html += '<span class="admin-queue-row-order">' + (item.order || item.seq || 1) + '</span>';
        html += '<span class="admin-queue-row-name">' + escapeHtml(item.name) + '</span>';
        if (item.is_lobby) {
            html += '<span class="admin-queue-row-lobby-badge">候场</span>';
        }
        html += '</div>';

        // 状态列
        html += '<span class="admin-queue-row-status ' + status.toLowerCase() + '">' + statusDisplay + '</span>';

        // 操作列
        html += '<div class="admin-queue-row-actions">';

        var groupId = item.group_id;
        var cigId = item.cig_id;

        if (item.is_lobby) {
            // 候场志愿者：部门有活跃场次且场次未满时可叫号进场
            var hasOpenGroup = (dept.groups || []).some(function (g) {
                return (g.total_count || 0) < 6;
            });
            if (hasOpenGroup && item.volunteer_id) {
                html += '<button class="admin-person-btn admin-person-btn-call" data-action="lobby-call" data-vol="' + item.volunteer_id + '" data-dept="' + escapeHtml(dept.department) + '">🎤 叫号进场</button>';
            } else {
                html += '<span style="font-size:12px; color:#94a3b8; padding: 6px 10px;">等待分配</span>';
            }
        } else if (status === 'WAITING' && groupId && cigId) {
            html += '<button class="admin-person-btn admin-person-btn-call" data-action="call" data-cig="' + cigId + '" data-group="' + groupId + '">🎤 叫号</button>';
        } else if (status === 'CALLED') {
            html += '<span style="font-size:12px; color:#b45309; padding:6px 10px; background:#fef3c7; border-radius:6px; font-weight:600;">⏳ 已叫号·等待进场</span>';
        } else if (status === 'INTERVIEWING') {
            html += '<span style="font-size:12px; color:#047857; padding:6px 10px; background:#d1fae5; border-radius:6px; font-weight:600;">💬 面试中</span>';
        } else if (status === 'FINISHED') {
            html += '<span style="font-size:12px; color:#94a3b8; padding: 6px 10px;">✓ 已完成</span>';
        } else {
            html += '<span style="font-size:12px; color:#94a3b8; padding: 6px 10px;">' + statusDisplay + '</span>';
        }

        html += '</div>';
        html += '</div>';
        return html;
    }

    function getRowClass(status) {
        switch (status) {
            case 'INTERVIEWING': return 'interviewing';
            case 'CALLED': return 'called';
            case 'FINISHED': return 'finished';
            default: return 'waiting';
        }
    }

    function getStatusText(status) {
        switch (status) {
            case 'INTERVIEWING': return '面试中';
            case 'CALLED': return '已叫号';
            case 'FINISHED': return '已完成';
            default: return '等待中';
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
    function bindPersonEvents() {
        document.querySelectorAll('.admin-person-btn').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var action = btn.dataset.action;
                var cigId = btn.dataset.cig;
                var groupId = btn.dataset.group;
                var rowName = btn.closest('.admin-queue-row').querySelector('.admin-queue-row-name').textContent;

                // 候场志愿者叫号进场
                if (action === 'lobby-call') {
                    var volId = btn.dataset.vol;
                    var dept = btn.dataset.dept;
                    if (!volId || !dept) {
                        showToast('缺少志愿信息', 'error');
                        return;
                    }
                    var okLobby = window.confirm('确认将候场的 ' + rowName + ' 叫号进场？\n（将自动分配到首个有空位的活跃场次）');
                    if (!okLobby) return;
                    callLobbyVolunteer(volId, dept);
                    return;
                }

                if (!groupId) {
                    showToast('未找到场次信息', 'error');
                    return;
                }

                var actionText = getActionText(action);
                var confirmed = window.confirm('确认对 ' + rowName + ' 执行"' + actionText + '"操作？');
                if (!confirmed) return;

                callPersonAction(groupId, action, cigId);
            });
        });

        // 场次切换
        document.querySelectorAll('.admin-group-select').forEach(function (sel) {
            sel.addEventListener('change', function () {
                fetchData();
            });
        });

        // 创建场次按钮 -> 打开弹窗
        document.querySelectorAll('.admin-create-group-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var deptCode = btn.dataset.dept;
                var card = btn.closest('.admin-dept-card');
                var nameEl = card ? card.querySelector('.admin-dept-name') : null;
                var deptName = nameEl ? nameEl.textContent.trim().replace(/部$/, '') : '';
                openCreateGroupModal(deptCode, deptName);
            });
        });

        // 弹窗提交
        var submitBtn = document.getElementById('cg_submit');
        if (submitBtn) {
            submitBtn.addEventListener('click', submitCreateGroup);
        }
    }

    // ---------- 创建场次弹窗 ----------
    var modalState = { deptCode: '', interviewers: [] };

    function openCreateGroupModal(deptCode, deptName) {
        modalState.deptCode = deptCode;
        modalState.interviewers = [];
        modalState.candidates = [];

        document.getElementById('cg_dept').value = deptName + '部 (' + deptCode + ')';
        document.getElementById('cg_group_id').value = '';
        document.getElementById('cg_classroom').value = '';

        // 加载面试官
        var listEl = document.getElementById('cg_interviewer_list');
        listEl.innerHTML = '<div style="color:#94a3b8; font-size:13px; padding:10px;">正在加载面试官...</div>';

        fetch('/api/board/interviewers/?dept=' + encodeURIComponent(deptCode), {
            credentials: 'same-origin',
        })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (!res.success) {
                    listEl.innerHTML = '<div class="cg-interviewer-empty">❌ ' + escapeHtml(res.message || '加载失败') + '</div>';
                    return;
                }
                var list = res.data || [];
                if (list.length === 0) {
                    listEl.innerHTML = '<div class="cg-interviewer-empty">⚠️ 该部门暂无面试官，请先在"面试官管理"中添加</div>';
                    return;
                }
                var html = '';
                list.forEach(function (iv) {
                    html += '<label class="cg-interviewer-item" data-id="' + iv.id + '">';
                    html += '<input type="checkbox" data-id="' + iv.id + '">';
                    html += '<span class="cg-iv-name">' + escapeHtml(iv.name) + '</span>';
                    html += '<span class="cg-iv-info">';
                    if (iv.homeroom) html += escapeHtml(iv.homeroom) + '组 · ';
                    html += escapeHtml(iv.gender === 'F' ? '♀' : '♂');
                    if (iv.phone) html += ' · ' + escapeHtml(iv.phone);
                    html += '</span>';
                    html += '</label>';
                });
                listEl.innerHTML = html;

                listEl.querySelectorAll('.cg-interviewer-item').forEach(function (item) {
                    var cb = item.querySelector('input[type="checkbox"]');
                    item.addEventListener('click', function (e) {
                        e.preventDefault();
                        cb.checked = !cb.checked;
                        item.classList.toggle('checked', cb.checked);
                        updateSubmitState();
                    });
                });
                updateSubmitState();
            })
            .catch(function () {
                listEl.innerHTML = '<div class="cg-interviewer-empty">❌ 网络错误，请刷新重试</div>';
            });

        // 加载候场候选人
        var candListEl = document.getElementById('cg_candidate_list');
        candListEl.innerHTML = '<div style="color:#94a3b8; font-size:13px; padding:10px;">正在加载候场人员...</div>';

        fetch('/api/board/', { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (!res.success) {
                    candListEl.innerHTML = '<div class="cg-interviewer-empty">❌ ' + escapeHtml(res.message || '加载失败') + '</div>';
                    return;
                }
                // 找到当前部门的候场人员
                var deptData = (res.data || []).find(function (d) { return d.department === deptCode; });
                var queue = deptData ? (deptData.display_queue || []) : [];
                var lobbyCandidates = queue.filter(function (q) { return q.is_lobby && q.volunteer_id; });

                if (lobbyCandidates.length === 0) {
                    candListEl.innerHTML = '<div class="cg-interviewer-empty">✅ 暂无候场人员</div>';
                    document.getElementById('cg_candidate_count').textContent = '已选 0 人';
                    return;
                }

                var candHtml = '';
                lobbyCandidates.forEach(function (c) {
                    var vid = c.volunteer_id || c.cig_id || '';
                    candHtml += '<label class="cg-interviewer-item cg-candidate-item" data-vid="' + vid + '">';
                    candHtml += '<input type="checkbox" data-vid="' + vid + '">';
                    candHtml += '<span class="cg-iv-name">' + escapeHtml(c.name) + '</span>';
                    candHtml += '<span class="cg-iv-info">' + escapeHtml((c.order || c.seq || '') + '号 · 候场中') + '</span>';
                    candHtml += '</label>';
                });
                candListEl.innerHTML = candHtml;
                document.getElementById('cg_candidate_count').textContent = '共 ' + lobbyCandidates.length + ' 人';

                // 候选人选择事件
                candListEl.querySelectorAll('.cg-candidate-item').forEach(function (item) {
                    var cb = item.querySelector('input[type="checkbox"]');
                    item.addEventListener('click', function (e) {
                        e.preventDefault();
                        cb.checked = !cb.checked;
                        item.classList.toggle('checked', cb.checked);
                        updateCandidateCount();
                    });
                });

                // 全选/清空
                var selectAllBtn = document.getElementById('cg_select_all_candidates');
                var clearBtn = document.getElementById('cg_clear_candidates');
                if (selectAllBtn) {
                    selectAllBtn.onclick = function () {
                        candListEl.querySelectorAll('.cg-candidate-item input[type="checkbox"]').forEach(function (cb) {
                            cb.checked = true;
                            cb.closest('.cg-candidate-item').classList.add('checked');
                        });
                        updateCandidateCount();
                    };
                }
                if (clearBtn) {
                    clearBtn.onclick = function () {
                        candListEl.querySelectorAll('.cg-candidate-item input[type="checkbox"]').forEach(function (cb) {
                            cb.checked = false;
                            cb.closest('.cg-candidate-item').classList.remove('checked');
                        });
                        updateCandidateCount();
                    };
                }
                updateCandidateCount();
            })
            .catch(function () {
                candListEl.innerHTML = '<div class="cg-interviewer-empty">❌ 网络错误</div>';
            });

        document.getElementById('createGroupModal').style.display = 'flex';
    }

    function updateCandidateCount() {
        var checked = document.querySelectorAll('#cg_candidate_list input[type="checkbox"]:checked');
        var total = document.querySelectorAll('#cg_candidate_list input[type="checkbox"]').length;
        document.getElementById('cg_candidate_count').textContent = '已选 ' + checked.length + ' / ' + total + ' 人';
    }

    function getSelectedCandidateIds() {
        var ids = [];
        document.querySelectorAll('#cg_candidate_list input[type="checkbox"]:checked').forEach(function (cb) {
            var vid = cb.dataset.vid;
            if (vid) ids.push(vid);
        });
        return ids;
    }

    function updateSubmitState() {
        var checked = document.querySelectorAll('#cg_interviewer_list input[type="checkbox"]:checked');
        var btn = document.getElementById('cg_submit');
        if (btn) btn.disabled = checked.length === 0;
    }

    window.createGroupModalClose = function () {
        var modal = document.getElementById('createGroupModal');
        if (modal) modal.style.display = 'none';
    };
    window.openCreateGroupModal = openCreateGroupModal;
    window.submitCreateGroup = submitCreateGroup;

    function submitCreateGroup() {
        var checked = document.querySelectorAll('#cg_interviewer_list input[type="checkbox"]:checked');
        var ids = [];
        checked.forEach(function (cb) {
            var id = parseInt(cb.dataset.id, 10);
            if (id) ids.push(id);
        });
        if (ids.length === 0) {
            showToast('请至少选择 1 位面试官', 'error');
            return;
        }
        var candidateIds = getSelectedCandidateIds();
        var groupId = document.getElementById('cg_group_id').value.trim();
        var classroom = document.getElementById('cg_classroom').value.trim();

        var submitBtn = document.getElementById('cg_submit');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '创建中...';
        }

        fetch('/api/board/create-group/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': state.csrfToken || '',
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                department: modalState.deptCode,
                interviewer_ids: ids,
                candidate_ids: candidateIds,
                group_id: groupId,
                classroom: classroom,
            }),
        })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res.success) {
                    showToast(res.message || '场次创建成功', 'success');
                    window.createGroupModalClose();
                    fetchData();
                } else {
                    showToast(res.message || '创建失败', 'error');
                }
            })
            .catch(function (e) {
                console.error('创建场次失败:', e);
                showToast('网络错误，请重试', 'error');
            })
            .finally(function () {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = '确认创建';
                }
            });
    }

    function getActionText(action) {
        switch (action) {
            case 'call': return '叫号';
            case 'start': return '开始面试';
            case 'finish': return '完成面试';
            default: return action;
        }
    }

    // ---------- API 调用 ----------
    function createGroup(department) {
        fetch('/api/board/create-group/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': state.csrfToken || '',
            },
            credentials: 'same-origin',
            body: JSON.stringify({ department: department }),
        })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res.success) {
                    showToast(res.message || '场次创建成功', 'success');
                    fetchData();
                } else {
                    showToast(res.message || '创建失败', 'error');
                }
            })
            .catch(function (e) {
                console.error('创建场次失败:', e);
                showToast('网络错误，请重试', 'error');
            });
    }

    function callLobbyVolunteer(volunteerId, department) {
        fetch('/api/board/assign-volunteer/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': state.csrfToken || '',
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                volunteer_id: volunteerId,
                department: department,
            }),
        })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res.success) {
                    showToast(res.message || '叫号进场成功', 'success');
                    fetchData();
                } else {
                    showToast(res.message || '操作失败', 'error');
                }
            })
            .catch(function (e) {
                console.error('叫号进场失败:', e);
                showToast('网络错误，请重试', 'error');
            });
    }

    function callPersonAction(groupId, action, cigId) {
        var body = {
            action: action,
            cig_id: cigId
        };

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
