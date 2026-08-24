/* ============================================================
   面试叫号看板 - 多部门轮播展示逻辑
   - 6个部门独立页面，自动轮播（5秒/页）
   - 30秒数据刷新，平滑过渡
   - 管理员模式：Ctrl+Shift+A 唤起入口
   ============================================================ */
(function () {
    'use strict';

    var CAROUSEL_INTERVAL = 5000;   // 每页停留 5 秒
    var REFRESH_INTERVAL = 30000;  // 数据刷新 30 秒
    var QUEUE_MAX_DISPLAY = 20;     // 每页最多显示 30 条（增加容量）

    var state = {
        data: [],
        currentIndex: 0,
        isPaused: false,
        carouselTimer: null,
        refreshTimer: null,
        progressTimer: null,
        progressStart: 0,
        departments: [],
    };

    // ---------- DOM ----------
    var trackEl = document.getElementById('carouselTrack');
    var indicatorsEl = document.getElementById('carouselIndicators');
    var paginationEl = document.getElementById('carouselPagination');
    var progressFillEl = document.getElementById('carouselProgressFill');
    var serverTimeEl = document.getElementById('carouselServerTime');
    var adminEntryEl = document.getElementById('adminEntry');
    var toastEl = document.getElementById('carouselToast');
    var navEl = document.getElementById('carouselDeptNav');

    if (window.BOARD_CONFIG && window.BOARD_CONFIG.departments) {
        state.departments = window.BOARD_CONFIG.departments;
    }

    // ---------- 工具 ----------
    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showToast(msg, type) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.className = 'carousel-toast ' + (type === 'error' ? 'toast-error' : 'toast-success');
        toastEl.style.display = 'block';
        clearTimeout(showToast._t);
        showToast._t = setTimeout(function () {
            toastEl.style.display = 'none';
        }, 3200);
    }

    // ---------- 时钟 ----------
    function tickClock() {
        var now = new Date();
        var hh = String(now.getHours()).padStart(2, '0');
        var mm = String(now.getMinutes()).padStart(2, '0');
        var ss = String(now.getSeconds()).padStart(2, '0');
        var timeEl = document.getElementById('carouselTime');
        var dateEl = document.getElementById('carouselDate');
        if (timeEl) timeEl.textContent = hh + ':' + mm + ':' + ss;
        if (dateEl) {
            var wd = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
            dateEl.textContent = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 星期' + wd;
        }
    }

    // ---------- 状态样式映射 ----------
    function statusClass(callStatus) {
        switch (callStatus) {
            case 'WAITING': return 'st-waiting';
            case 'CALLED': return 'st-called';
            case 'INTERVIEWING': return 'st-interviewing';
            case 'FINISHED': return 'st-finished';
            case 'CANCELLED': return 'st-cancelled';
            default: return 'st-waiting';
        }
    }

    function statusText(callStatus) {
        switch (callStatus) {
            case 'WAITING': return '等待中';
            case 'CALLED': return '已叫号';
            case 'INTERVIEWING': return '面试中';
            case 'FINISHED': return '已完成';
            case 'CANCELLED': return '已取消';
            default: return '等待中';
        }
    }

    // ---------- 渲染导航栏 ----------
    function renderNav() {
        if (!navEl || !state.data || !state.data.length) return;

        var html = '';
        state.data.forEach(function (dept, idx) {
            var waiting = dept.waiting_total || 0;
            var classes = ['dept-nav-item'];
            if (idx === state.currentIndex) classes.push('is-active');

            html += '<div class="' + classes.join(' ') + '" data-dept="' + escapeHtml(dept.department) + '" data-index="' + idx + '" role="button" tabindex="0">';
            if (waiting > 0) {
                html += '<span class="dept-nav-count">' + waiting + '</span>';
            }
            html += '<span class="dept-nav-name">' + escapeHtml(dept.department_name) + '部</span>';
            html += '<span class="dept-nav-code">' + escapeHtml(dept.department) + '</span>';
            html += '</div>';
        });
        navEl.innerHTML = html;

        // 绑定点击事件
        navEl.querySelectorAll('.dept-nav-item').forEach(function (item) {
            item.addEventListener('click', function () {
                var idx = parseInt(item.dataset.index, 10);
                goToSlide(idx);
            });
            // 键盘可达性：Enter/Space 触发
            item.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    var idx = parseInt(item.dataset.index, 10);
                    goToSlide(idx);
                }
            });
        });

        // 自动滚动到活跃导航项
        scrollNavToActive();
    }

    function updateNavActive() {
        if (!navEl) return;
        var items = navEl.querySelectorAll('.dept-nav-item');
        items.forEach(function (item, idx) {
            if (idx === state.currentIndex) {
                item.classList.add('is-active');
            } else {
                item.classList.remove('is-active');
            }
        });
        scrollNavToActive();
    }

    function scrollNavToActive() {
        if (!navEl) return;
        var active = navEl.querySelector('.dept-nav-item.is-active');
        if (!active) return;
        var navRect = navEl.getBoundingClientRect();
        var itemRect = active.getBoundingClientRect();
        if (itemRect.left < navRect.left || itemRect.right > navRect.right) {
            active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }

    // ---------- 渲染幻灯片 ----------
    function renderSlides() {
        if (!trackEl || !state.data || !state.data.length) {
            if (trackEl) {
                trackEl.innerHTML = '<div class="carousel-loading">暂无看板数据</div>';
            }
            return;
        }

        var html = '';
        state.data.forEach(function (dept, idx) {
            html += renderDeptSlide(dept, idx);
        });
        trackEl.innerHTML = html;

        // 渲染导航栏
        renderNav();

        // 渲染指示器
        renderIndicators();

        // 渲染分页
        renderPagination();

        // 应用当前活跃状态
        applyActiveSlide();
    }

    function renderDeptSlide(dept, idx) {
        var queue = dept.display_queue || [];
        var waitingTotal = dept.waiting_total || 0;
        var classroom = dept.classroom || '待安排';

        var html = '<div class="dept-slide" data-index="' + idx + '">';

        // 幻灯片头部
        html += '<div class="slide-header">';
        html += '<div class="slide-dept-info">';
        html += '<span class="slide-dept-name">' + escapeHtml(dept.department_name) + '部</span>';
        html += '<span class="slide-dept-code">' + escapeHtml(dept.department) + '</span>';
        html += '</div>';
        html += '<div class="slide-waiting-count">';
        html += '<span class="slide-waiting-label">当前等待</span>';
        html += '<span><span class="slide-waiting-number">' + waitingTotal + '</span><span class="slide-waiting-unit">人</span></span>';
        html += '</div>';
        html += '</div>';

        // 教室信息
        html += '<div class="slide-classroom-bar">';
        html += '<div class="slide-classroom-item">';
        html += '<span class="slide-classroom-label">面试教室：</span>';
        html += '<span class="slide-classroom-value">' + escapeHtml(classroom) + '</span>';
        html += '</div>';
        if (dept.lobby_count !== undefined) {
            html += '<div class="slide-classroom-sep"></div>';
            html += '<div class="slide-classroom-item">';
            html += '<span class="slide-classroom-label">候场人数：</span>';
            html += '<span class="slide-classroom-value">' + escapeHtml(String(dept.lobby_count)) + '人</span>';
            html += '</div>';
        }
        html += '</div>';

        // 队列列表
        html += '<div class="queue-list">';
        if (queue.length === 0) {
            html += '<div class="queue-empty">';
            html += '<div class="queue-empty-icon">📋</div>';
            html += '<div>暂无排队信息</div>';
            html += '</div>';
        } else {
            var displayQueue = queue.slice(0, QUEUE_MAX_DISPLAY);
            displayQueue.forEach(function (item) {
                html += renderQueueItem(item, dept);
            });
            if (queue.length > QUEUE_MAX_DISPLAY) {
                html += '<div class="queue-more">还有 ' + (queue.length - QUEUE_MAX_DISPLAY) + ' 人排队中...</div>';
            }
        }
        html += '</div>';

        html += '</div>';
        return html;
    }

    function renderQueueItem(item, dept) {
        var isCurrent = item.is_current;
        var isCalled = item.call_status === 'CALLED';
        var isFinished = item.is_finished || item.call_status === 'FINISHED';

        var classes = ['queue-item'];
        if (isCurrent) classes.push('is-current');
        if (isCalled) classes.push('is-called');
        if (isFinished) classes.push('is-finished');
        if (item.call_status === 'CANCELLED') classes.push('is-cancelled');

        var html = '<div class="' + classes.join(' ') + '">';

        // 序号
        var seqDisplay = String(item.seq || item.order || 1).padStart(2, '0');
        html += '<div class="queue-seq">' + escapeHtml(seqDisplay) + '</div>';

        // 姓名与部门
        html += '<div class="queue-info">';
        html += '<div class="queue-name">' + escapeHtml(item.name) + '</div>';
        html += '<div class="queue-dept">';
        html += '<span class="queue-dept-code">' + escapeHtml(dept.department_name) + '部</span>';
        html += '<span class="queue-classroom">教室：' + escapeHtml(item.classroom || '待安排') + '</span>';
        html += '</div>';
        html += '</div>';

        // 状态标签
        var stClass = statusClass(item.call_status);
        var stText = item.call_status_display || statusText(item.call_status);
        html += '<div class="queue-status ' + stClass + '">' + escapeHtml(stText) + '</div>';

        // 当前叫号徽章
        if (isCurrent) {
            html += '<div class="queue-current-badge">当前叫号</div>';
        }

        html += '</div>';
        return html;
    }

    function renderIndicators() {
        if (!indicatorsEl) return;
        var html = '';
        state.data.forEach(function (_, idx) {
            html += '<span class="pagination-dot' + (idx === state.currentIndex ? ' is-active' : '') + '" data-index="' + idx + '"></span>';
        });
        indicatorsEl.innerHTML = html;

        // 绑定指示器点击
        indicatorsEl.querySelectorAll('.pagination-dot').forEach(function (dot) {
            dot.addEventListener('click', function () {
                var idx = parseInt(dot.dataset.index, 10);
                goToSlide(idx);
            });
        });
    }

    function renderPagination() {
        if (!paginationEl) return;
        var html = '';
        state.data.forEach(function (dept, idx) {
            var classes = ['pagination-dot'];
            if (idx === state.currentIndex) classes.push('is-active');
            html += '<span class="' + classes.join(' ') + '" data-index="' + idx + '" title="' + escapeHtml(dept.department_name) + '部"></span>';
        });
        paginationEl.innerHTML = html;

        // 绑定分页点击
        paginationEl.querySelectorAll('.pagination-dot').forEach(function (dot) {
            dot.addEventListener('click', function () {
                var idx = parseInt(dot.dataset.index, 10);
                goToSlide(idx);
            });
        });
    }

    function applyActiveSlide() {
        if (!trackEl) return;
        var slides = trackEl.querySelectorAll('.dept-slide');
        slides.forEach(function (slide, idx) {
            if (idx === state.currentIndex) {
                slide.classList.add('is-active');
            } else {
                slide.classList.remove('is-active');
            }
        });
        renderIndicators();
        renderPagination();
        updateNavActive();
    }

    // ---------- 轮播控制 ----------
    function goToSlide(idx) {
        if (!state.data || !state.data.length) return;
        state.currentIndex = idx % state.data.length;
        applyActiveSlide();
        restartProgress();
        scrollNavToActive();
    }

    function nextSlide() {
        if (!state.data || !state.data.length) return;
        var next = state.currentIndex + 1;
        if (next >= state.data.length) next = 0;
        goToSlide(next);
    }

    function startCarousel() {
        stopCarousel();
        state.carouselTimer = setInterval(function () {
            if (!state.isPaused) {
                nextSlide();
            }
        }, CAROUSEL_INTERVAL);
        restartProgress();
    }

    function stopCarousel() {
        if (state.carouselTimer) {
            clearInterval(state.carouselTimer);
            state.carouselTimer = null;
        }
        if (state.progressTimer) {
            clearInterval(state.progressTimer);
            state.progressTimer = null;
        }
    }

    function restartProgress() {
        state.progressStart = Date.now();
        updateProgress();
        if (state.progressTimer) clearInterval(state.progressTimer);
        state.progressTimer = setInterval(updateProgress, 50);
    }

    function updateProgress() {
        if (!progressFillEl || state.isPaused) return;
        var elapsed = Date.now() - state.progressStart;
        var pct = Math.min((elapsed / CAROUSEL_INTERVAL) * 100, 100);
        progressFillEl.style.width = pct + '%';
    }

    function togglePause() {
        state.isPaused = !state.isPaused;
        if (!state.isPaused) {
            restartProgress();
        }
        showToast(state.isPaused ? '轮播已暂停' : '轮播已继续', 'success');
    }

    // ---------- 数据获取 ----------
    function fetchData() {
        fetch('/api/board/', { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res.success) {
                    state.data = res.data;
                    if (serverTimeEl && res.server_time) {
                        var timeStr = res.server_time.replace('T', ' ').substring(11, 19);
                        serverTimeEl.textContent = '服务器时间: ' + timeStr;
                    }
                    // 保持当前索引有效
                    if (state.currentIndex >= state.data.length) {
                        state.currentIndex = 0;
                    }
                    renderSlides();
                }
            })
            .catch(function (e) {
                console.error('看板数据加载失败:', e);
            });
    }

    function startRefreshLoop() {
        if (state.refreshTimer) return;
        state.refreshTimer = setInterval(fetchData, REFRESH_INTERVAL);
    }

    // ---------- 键盘快捷键 ----------
    function setupKeyboard() {
        document.addEventListener('keydown', function (e) {
            // Ctrl+Shift+A 显示管理员入口
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                if (adminEntryEl) {
                    adminEntryEl.classList.toggle('is-visible');
                }
                e.preventDefault();
            }
            // 空格暂停/继续
            if (e.key === ' ' || e.key === 'Spacebar') {
                togglePause();
                e.preventDefault();
            }
            // 左右箭头手动切换
            if (e.key === 'ArrowLeft') {
                if (state.data.length) {
                    var prev = state.currentIndex - 1;
                    if (prev < 0) prev = state.data.length - 1;
                    goToSlide(prev);
                }
                e.preventDefault();
            }
            if (e.key === 'ArrowRight') {
                nextSlide();
                e.preventDefault();
            }
            // F 刷新
            if (e.key === 'f' || e.key === 'F') {
                fetchData();
            }
        });
    }

    // ---------- 启动 ----------
    tickClock();
    setInterval(tickClock, 1000);
    setupKeyboard();
    fetchData();
    startCarousel();
    startRefreshLoop();

})();
