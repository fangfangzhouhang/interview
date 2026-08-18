// queue.js - 排队管理JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // DOM元素
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const queueList = document.getElementById('queueList');
    const refreshBtn = document.getElementById('refreshBtn');
    const minWaitTime = document.getElementById('minWaitTime');
    const messageContainer = document.getElementById('messageContainer');

    let refreshInterval = null;
    const AUTO_REFRESH_INTERVAL = 120000;

    // 获取CSRF Token
    function getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
               document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';
    }

    // 显示消息
    function showMessage(type, text) {
        if (!messageContainer) return;

        let existing = messageContainer.querySelector('.success-message, .error-message');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.className = type === 'success' ? 'success-message' : 'error-message';
        div.textContent = text;
        messageContainer.appendChild(div);

        setTimeout(() => {
            if (div.parentNode) div.remove();
        }, 5000);
    }

    // 切换侧边栏
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
        });
    }

    // ========== 获取排队信息 ==========
    async function fetchQueueInfo() {
        try {
            const response = await fetch('/api/queue/info/');
            const result = await response.json();

            if (result.success) {
                renderQueueData(result.data);
                updateMinWaitTime(result.min_wait_minutes);
                return true;
            } else {
                showMessage('error', result.message || '获取排队信息失败');
                return false;
            }
        } catch (error) {
            console.error('获取排队信息失败:', error);
            showMessage('error', '网络错误，请重试');
            return false;
        }
    }

    // ========== 渲染排队数据 ==========
    function renderQueueData(queueData) {
        if (!queueList) return;

        if (!queueData || queueData.length === 0) {
            queueList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <div class="empty-title">暂无志愿</div>
                    <div class="empty-desc">请先在个人页面填写志愿信息</div>
                </div>
            `;
            return;
        }

        let html = '';

        queueData.forEach((vol) => {
            const isQueuing = vol.is_in_queue;
            const statusClass = vol.status ? vol.status.toLowerCase() : 'filled';
            // ACCEPTED/REJECTED 显示为 completed
            const displayStatus = (vol.status === 'ACCEPTED' || vol.status === 'REJECTED') ? 'completed' : statusClass;
            const displayStatusText = (vol.status === 'ACCEPTED' || vol.status === 'REJECTED') ? '已完成' : vol.status_display;

            html += `
                <div class="queue-item" data-volunteer-id="${vol.volunteer_id}">
                    <div class="queue-header">
                        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                            <span class="queue-department">${vol.department_display}</span>
                            <span class="queue-priority">第${vol.priority}志愿</span>
                            <span class="queue-status-badge ${displayStatus}">${displayStatusText || '未填报'}</span>
                        </div>
                    </div>
            `;

            // 只有在排队中才显示详情
            if (isQueuing) {
                const position = vol.position || '?';
                const total = vol.total_in_queue || 0;
                const waitTime = vol.estimated_wait_minutes !== null && vol.estimated_wait_minutes !== undefined
                    ? `约 ${vol.estimated_wait_minutes} 分钟`
                    : '计算中...';

                html += `
                    <div class="queue-details expanded">
                        <div class="detail-row">
                            <span class="detail-label">📍 队列位置</span>
                            <span class="detail-value position">第 ${position} 位</span>
                            <span class="detail-value total">（共 ${total} 人）</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">⏱️ 预计等待</span>
                            <span class="detail-value wait-time">${waitTime}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">🕐 开始排队</span>
                            <span class="detail-value">${formatTime(vol.queue_start_time)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">⏳ 已排队</span>
                            <span class="detail-value">${formatDuration(vol.queue_duration)}</span>
                        </div>

                        <div class="queue-actions">
                            <button class="btn-sm btn-danger cancel-queue-btn" data-volunteer-id="${vol.volunteer_id}">取消排队</button>
                            <button class="btn-sm btn-warning requeue-btn" data-volunteer-id="${vol.volunteer_id}">重新排队</button>
                        </div>
                    </div>
                `;
            } else {
                // 未排队状态
                const canQueue = vol.status === 'FILLED' || vol.status === 'WAITING';
                html += `
                    <div class="queue-details" style="display: block; border-top: none; padding-top: 0;">
                        <div class="detail-row" style="color: var(--queue-text-secondary);">
                            <span>当前未在排队中</span>
                        </div>
                        ${canQueue ? `
                        <div class="queue-actions">
                            <button class="btn-sm btn-success start-queue-btn" data-volunteer-id="${vol.volunteer_id}">开始排队</button>
                        </div>
                        ` : `
                        <div class="queue-actions">
                            <span style="font-size: 13px; color: var(--queue-text-secondary);">该志愿已 ${displayStatusText}，不可排队</span>
                        </div>
                        `}
                    </div>
                `;
            }

            html += `</div>`;
        });

        queueList.innerHTML = html;

        // 绑定按钮事件 - 使用事件委托确保正确绑定
        queueList.querySelectorAll('.start-queue-btn').forEach(btn => {
            btn.removeEventListener('click', handleStartQueue);
            btn.addEventListener('click', handleStartQueue);
        });

        queueList.querySelectorAll('.cancel-queue-btn').forEach(btn => {
            btn.removeEventListener('click', handleCancelQueue);
            btn.addEventListener('click', handleCancelQueue);
        });

        queueList.querySelectorAll('.requeue-btn').forEach(btn => {
            btn.removeEventListener('click', handleRequeue);
            btn.addEventListener('click', handleRequeue);
        });
    }

    // ========== 按钮事件处理函数 ==========
    function handleStartQueue(e) {
        const volunteerId = e.currentTarget.dataset.volunteerId;
        handleVolunteerAction(volunteerId, 'start_queue');
    }

    function handleCancelQueue(e) {
        const volunteerId = e.currentTarget.dataset.volunteerId;
        handleVolunteerAction(volunteerId, 'cancel_queue');
    }

    function handleRequeue(e) {
        const volunteerId = e.currentTarget.dataset.volunteerId;
        handleVolunteerAction(volunteerId, 'requeue');
    }

    // ========== 更新预计等待时间 ==========
    function updateMinWaitTime(minWait) {
        if (minWait !== null && minWait !== undefined) {
            minWaitTime.textContent = `约 ${minWait} 分钟`;
        } else {
            minWaitTime.textContent = '暂无数据';
        }
    }

    // ========== 格式化工具函数 ==========
    function formatTime(timeStr) {
        if (!timeStr) return '-';
        try {
            const date = new Date(timeStr);
            return date.toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch {
            return timeStr;
        }
    }

    function formatDuration(seconds) {
        if (!seconds || seconds < 0) return '刚刚';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        if (mins > 0) {
            return `${mins} 分 ${secs} 秒`;
        }
        return `${secs} 秒`;
    }

    // ========== 处理志愿操作 ==========
    async function handleVolunteerAction(volunteerId, action) {
        const actionMap = {
            'start_queue': '开始排队',
            'cancel_queue': '取消排队',
            'requeue': '重新排队'
        };
        const actionLabel = actionMap[action] || action;

        // 防呆：空 id 直接提示，不发请求
        const invalidId =
            volunteerId === undefined || volunteerId === null ||
            volunteerId === '' || String(volunteerId) === 'null' ||
            String(volunteerId) === 'undefined' ||
            (typeof volunteerId === 'number' && isNaN(volunteerId));
        if (invalidId) {
            showMessage('error', `无法${actionLabel}：该志愿尚未生成记录，请先到「个人中心」保存志愿信息。`);
            return;
        }

        if (!confirm(`确定要${actionLabel}吗？`)) {
            return;
        }

        try {
            const response = await fetch('/api/profile/volunteer/action/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCSRFToken(),
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    volunteer_id: parseInt(volunteerId),
                    action: action
                })
            });

            const result = await response.json();
            if (result.success) {
                showMessage('success', result.message || `${actionLabel}成功`);
                await fetchQueueInfo();
            } else {
                showMessage('error', result.message || `${actionLabel}失败`);
            }
        } catch (error) {
            console.error('志愿操作失败:', error);
            showMessage('error', '操作失败，请稍后刷新重试');
        }
    }

    // ========== 刷新功能 ==========
    async function refresh() {
        const originalText = refreshBtn.textContent;
        refreshBtn.textContent = '⏳ 刷新中...';
        refreshBtn.disabled = true;

        await fetchQueueInfo();

        refreshBtn.textContent = originalText;
        refreshBtn.disabled = false;

        const now = new Date();
        const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const hint = document.querySelector('.auto-refresh-hint');
        if (hint) {
            hint.textContent = `最后更新: ${timeStr}`;
        }
    }

    // ========== 初始化 ==========
    async function init() {
        await fetchQueueInfo();

        if (refreshBtn) {
            refreshBtn.addEventListener('click', refresh);
        }

        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
        refreshInterval = setInterval(refresh, AUTO_REFRESH_INTERVAL);

        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                if (refreshInterval) {
                    clearInterval(refreshInterval);
                    refreshInterval = null;
                }
            } else {
                if (!refreshInterval) {
                    refreshInterval = setInterval(refresh, AUTO_REFRESH_INTERVAL);
                    refresh();
                }
            }
        });
    }

    init();

    window.addEventListener('beforeunload', function() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    });
});