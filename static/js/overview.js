// static/js/overview.js

(function() {
    'use strict';

    // ==================== DOM 引用 ====================
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

    const els = {
        cardsContainer: $('#cardsContainer'),
        lastUpdated: $('#lastUpdated'),
        countdownTimer: $('#countdownTimer'),
        refreshBtn: $('#refreshBtn'),
        autoGroupBtn: $('#autoGroupBtn'),
        toast: $('#toast'),
    };

    // ==================== 状态 ====================
    let countdown = 180;
    let countdownInterval = null;
    let isPolling = false;

    function setButtonLoading(button, isLoading, label) {
        const labelElement = $('.button-label', button);
        button.disabled = isLoading;
        button.classList.toggle('is-loading', isLoading);
        button.setAttribute('aria-busy', String(isLoading));
        if (labelElement) labelElement.textContent = label;
    }

    // ==================== Toast ====================
    function showToast(message, type = 'info') {
        const toast = els.toast;
        toast.textContent = message;
        toast.className = `toast ${type}`;
        void toast.offsetWidth;
        toast.classList.add('show');
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 3500);
    }

    // ==================== 数据渲染 ====================
    function renderCards(data) {
        const container = els.cardsContainer;
        const cards = data.cards || [];

        if (!cards || cards.length === 0) {
            container.innerHTML = `<div class="empty-text">暂无面试场次数据</div>`;
            return;
        }

        let html = '';
        for (const card of cards) {
            const groups = card.groups || [];
            let groupsHtml = '';
            let hasPending = false;
            let hasOngoing = false;

            if (groups.length === 0) {
                groupsHtml = `<div class="empty-text">暂无面试场次</div>`;
            } else {
                for (const group of groups) {
                    // 检测是否有待开始状态
                    if (group.status === 'PENDING') {
                        hasPending = true;
                    }
                    if (group.status === 'ONGOING') {
                        hasOngoing = true;
                    }

                    const statusClass = group.status.toLowerCase();
                    const isPending = group.status === 'PENDING';
                    const pendingClass = isPending ? 'pending-group' : '';

                    const candidatesHtml = (group.candidate_names && group.candidate_names.length > 0)
                        ? group.candidate_names.map(name =>
                            `<span class="candidate-name">${escapeHtml(name)}</span>`
                          ).join('')
                        : '<span class="empty-candidates">暂无面试者</span>';

                    groupsHtml += `
                        <div class="group-item ${pendingClass}">
                            <div class="group-row">
                                <span class="group-name">${escapeHtml(group.group_id || '未命名场次')}</span>
                                <span class="group-status ${statusClass}">${escapeHtml(group.status_display)}</span>
                            </div>
                            <div class="group-candidates">${candidatesHtml}</div>
                        </div>
                    `;
                }
            }

            // 卡片强调类
            let cardExtraClass = '';
            if (hasPending) {
                cardExtraClass = 'has-pending';
            } else if (hasOngoing) {
                cardExtraClass = 'has-ongoing';
            }

            html += `
                <div class="card ${cardExtraClass}">
                    <div class="card-header">
                        <span class="dept-name">${escapeHtml(card.department_name)}</span>
                        <span class="dept-badge">${card.total_groups}场</span>
                    </div>
                    <div class="card-body">
                        ${groupsHtml}
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function updateLastUpdated(timeStr) {
        els.lastUpdated.textContent = timeStr || '--';
    }

    function updateCountdown(seconds) {
        els.countdownTimer.textContent = `${seconds}s`;
    }

    // ==================== API 调用 ====================
    async function fetchOverviewData() {
        try {
            const response = await fetch('/api/overview/data/', {
                credentials: 'same-origin',
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });
            const result = await response.json();

            if (result.success) {
                renderCards(result.data);
                updateLastUpdated(result.data.last_updated);
                return result.data;
            } else {
                showToast(result.message || '加载数据失败', 'error');
                return null;
            }
        } catch (error) {
            console.error('[Overview] Fetch error:', error);
            showToast('网络错误，请重试', 'error');
            return null;
        }
    }

    // ==================== 自动分组 + 刷新（一体化） ====================
    async function refreshWithAutoGroup() {
        const btn = els.refreshBtn;
        setButtonLoading(btn, true, '正在刷新');

        try {
            const response = await fetch('/api/overview/manual_refresh/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });
            const result = await response.json();

            if (result.success) {
                renderCards(result.data);
                updateLastUpdated(result.data.last_updated);

                if (result.data.auto_group_result) {
                    const gr = result.data.auto_group_result;
                    if (gr.created_groups > 0) {
                        showToast(gr.message, 'success');
                    } else if (gr.message && !gr.message.includes('没有符合条件的')) {
                        showToast(gr.message, 'info');
                    }
                }
                countdown = 180;
                updateCountdown(countdown);
            } else {
                showToast(result.message || '刷新失败', 'error');
            }
        } catch (error) {
            console.error('[Overview] Refresh error:', error);
            showToast('网络错误，请重试', 'error');
        } finally {
            setButtonLoading(btn, false, '刷新并分组');
        }
    }

    // ==================== 仅手动自动分组 ====================
    async function performAutoGroup() {
        if (!(await Modal.confirm('自动分组会按当前规则更新待分配场次。是否继续？'))) return;

        const btn = els.autoGroupBtn;
        setButtonLoading(btn, true, '正在分组');

        try {
            const response = await fetch('/api/overview/auto_group/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });
            const result = await response.json();

            if (result.success) {
                showToast(result.message || '自动分组完成', 'success');
                await fetchOverviewData();
                countdown = 180;
                updateCountdown(countdown);
            } else {
                showToast(result.message || '自动分组失败', 'error');
            }
        } catch (error) {
            console.error('[Overview] Auto group error:', error);
            showToast('网络错误，请重试', 'error');
        } finally {
            setButtonLoading(btn, false, '自动分组');
        }
    }

    // ==================== 轮询控制 ====================
    function startPolling() {
        stopPolling();

        refreshWithAutoGroup().then(() => {
            countdown = 180;
            updateCountdown(countdown);

            if (countdownInterval) {
                clearInterval(countdownInterval);
            }

            countdownInterval = setInterval(() => {
                countdown -= 1;
                updateCountdown(countdown);
                if (countdown <= 0) {
                    countdown = 180;
                    if (!isPolling) {
                        isPolling = true;
                        refreshWithAutoGroup().finally(() => {
                            isPolling = false;
                        });
                    }
                }
            }, 1000);
        });
    }

    function stopPolling() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        countdown = 180;
        updateCountdown(countdown);
    }

    // ==================== 初始化 ====================
    function init() {
        els.refreshBtn.addEventListener('click', refreshWithAutoGroup);
        els.autoGroupBtn.addEventListener('click', performAutoGroup);

        startPolling();

        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                stopPolling();
                startPolling();
            }
        });

    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('beforeunload', function() {
        stopPolling();
    });

})();
