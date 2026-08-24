/* ============================================================
   Global Modal System
   覆盖原生 alert / confirm / prompt 为蓝白色自定义弹窗
   ============================================================ */
(function(global) {
    'use strict';

    function createOverlay() {
        const overlay = document.createElement('div');
        // global-modal-overlay 标记类用于区分本系统弹窗与页面自带的 .modal-overlay（如面试页 #statusModal）
        overlay.className = 'modal-overlay global-modal-overlay';
        overlay.innerHTML = `
            <div class="modal-dialog" role="dialog" aria-modal="true">
                <div class="modal-header">
                    <div class="modal-icon" id="modalIcon">ℹ️</div>
                    <div class="modal-title" id="modalTitle">提示</div>
                </div>
                <div class="modal-body" id="modalBody"></div>
                <div class="modal-footer" id="modalFooter"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    function showModal(options) {
        return new Promise(resolve => {
            let overlay = document.querySelector('.global-modal-overlay');
            if (!overlay) overlay = createOverlay();

            const icon = overlay.querySelector('#modalIcon');
            const title = overlay.querySelector('#modalTitle');
            const body = overlay.querySelector('#modalBody');
            const footer = overlay.querySelector('#modalFooter');

            icon.className = 'modal-icon ' + (options.iconType || 'info');
            icon.textContent = options.icon || 'ℹ️';
            title.textContent = options.title || '提示';

            body.innerHTML = '';
            if (options.htmlBody) {
                body.innerHTML = options.message || '';
            } else {
                body.textContent = options.message || '';
            }

            footer.innerHTML = '';

            if (options.input) {
                body.classList.add('modal-input-body');
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'modal-input';
                input.placeholder = options.inputPlaceholder || '';
                input.value = options.inputValue || '';
                body.appendChild(input);
                setTimeout(() => input.focus(), 50);

                if (options.inputHint) {
                    const hint = document.createElement('div');
                    hint.className = 'modal-input-hint';
                    hint.textContent = options.inputHint;
                    body.appendChild(hint);
                }
            }

            const buttons = options.buttons || [{ text: '确定', value: true, primary: true }];
            buttons.forEach(btn => {
                const el = document.createElement('button');
                el.className = 'modal-btn ' + (btn.primary ? 'modal-btn-primary' : (btn.danger ? 'modal-btn-danger' : (btn.success ? 'modal-btn-success' : 'modal-btn-secondary')));
                el.textContent = btn.text;
                el.onclick = () => {
                    if (options.input) {
                        const inputEl = overlay.querySelector('.modal-input');
                        closeModal(overlay);
                        resolve(btn.value ? (inputEl ? inputEl.value : null) : null);
                    } else {
                        closeModal(overlay);
                        resolve(btn.value);
                    }
                };
                footer.appendChild(el);
            });

            overlay.classList.add('modal-visible');

            const firstBtn = footer.querySelector('.modal-btn-primary') || footer.querySelector('.modal-btn');
            if (firstBtn) firstBtn.focus();

            if (options.closeOnOverlay) {
                overlay.onclick = (e) => {
                    if (e.target === overlay) {
                        closeModal(overlay);
                        resolve(options.overlayValue !== undefined ? options.overlayValue : false);
                    }
                };
            } else {
                overlay.onclick = null;
            }

            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    closeModal(overlay);
                    resolve(false);
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    }

    function closeModal(overlay) {
        overlay.classList.remove('modal-visible');
        setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 300);
    }

    function showToast(message, type) {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        const iconMap = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
        const iconClass = type || 'info';
        toast.className = 'toast-item';
        toast.innerHTML = `<span class="toast-icon ${iconClass}">${iconMap[iconClass] || 'ℹ️'}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-8px)';
            toast.style.transition = 'all 0.3s';
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 2500);
    }

    // ============================================================
    // 覆盖原生 window.alert / confirm / prompt
    // ============================================================

    const origAlert = window.alert.bind(window);
    const origConfirm = window.confirm.bind(window);
    const origPrompt = window.prompt.bind(window);

    // alert → 自动消失的 Toast
    window.alert = function(message) {
        showToast(String(message || ''), 'info');
    };

    // confirm → 返回 Promise，异步等待用户操作
    window.confirm = function(message) {
        return showModal({
            title: '操作确认',
            message: String(message || ''),
            icon: '❓',
            iconType: 'question',
            buttons: [
                { text: '取消', value: false },
                { text: '确定', value: true, primary: true }
            ],
            closeOnOverlay: true,
            overlayValue: false
        });
    };

    // prompt → 返回 Promise
    window.prompt = function(message, defaultValue) {
        return showModal({
            title: '请输入',
            message: String(message || ''),
            icon: '✏️',
            iconType: 'info',
            input: true,
            inputValue: defaultValue || '',
            buttons: [
                { text: '取消', value: false },
                { text: '确定', value: true, primary: true }
            ],
            closeOnOverlay: true,
            overlayValue: false
        });
    };

    // ============================================================
    // 同步兼容层：window.__syncConfirm / __syncPrompt
    // 用于尚未改造的旧代码，通过同步返回值保持兼容
    // 实际行为：弹窗展示，默认返回 true，允许操作继续
    // ============================================================
    window.__syncConfirm = function(message) {
        showModal({
            title: '操作确认',
            message: String(message || ''),
            icon: '❓',
            iconType: 'question',
            buttons: [
                { text: '知道了', value: true, primary: true }
            ],
            closeOnOverlay: true,
            overlayValue: true
        });
        return true;
    };

    // ============================================================
    // 全局 Modal API（供新代码使用）
    // ============================================================
    global.Modal = {
        alert: function(message, title, type) {
            return showModal({
                title: title || '提示',
                message: String(message || ''),
                icon: type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️',
                iconType: type || 'info',
                buttons: [{ text: '确定', value: true, primary: true }]
            });
        },

        confirm: function(message, title) {
            return showModal({
                title: title || '操作确认',
                message: String(message || ''),
                icon: '❓',
                iconType: 'question',
                buttons: [
                    { text: '取消', value: false },
                    { text: '确定', value: true, primary: true }
                ],
                closeOnOverlay: true,
                overlayValue: false
            });
        },

        prompt: function(message, defaultValue, title) {
            return showModal({
                title: title || '请输入',
                message: String(message || ''),
                icon: '✏️',
                iconType: 'info',
                input: true,
                inputValue: defaultValue || '',
                buttons: [
                    { text: '取消', value: false },
                    { text: '确定', value: true, primary: true }
                ],
                closeOnOverlay: true,
                overlayValue: false
            });
        },

        toast: showToast,

        success: function(message) { showToast(message, 'success'); },
        error: function(message) { showToast(message, 'error'); },
        info: function(message) { showToast(message, 'info'); },
        warning: function(message) { showToast(message, 'warning'); }
    };

    // 保存原始方法以备不时之需
    window.__native_alert = origAlert;
    window.__native_confirm = origConfirm;
    window.__native_prompt = origPrompt;

    // ============================================================
    // 全局侧边栏交互：鼠标悬停左边缘自动收缩/展开
    // ============================================================
    document.addEventListener('DOMContentLoaded', function() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        const EDGE_TRIGGER_WIDTH = 8;
        let autoCollapsed = false;
        let manualCollapsed = false;
        let rafId = null;
        let lastX = -1;

        const toggleBtn = document.getElementById('toggleSidebar');

        function applyState() {
            const shouldCollapse = autoCollapsed || manualCollapsed;
            sidebar.classList.toggle('collapsed', shouldCollapse);

            if (toggleBtn) {
                const icon = toggleBtn.querySelector('.toggle-icon');
                if (icon) icon.textContent = shouldCollapse ? '▶' : '◀';
                else toggleBtn.textContent = shouldCollapse ? '▶' : '◀';
            }
        }

        function onMouseMove(e) {
            if (e.clientX === lastX) return;
            lastX = e.clientX;

            const shouldAutoCollapse = e.clientX < EDGE_TRIGGER_WIDTH;

            if (shouldAutoCollapse !== autoCollapsed) {
                autoCollapsed = shouldAutoCollapse;
                applyState();
            }
        }

        function onMouseLeave() {
            autoCollapsed = false;
            applyState();
        }

        document.addEventListener('mousemove', function(e) {
            if (rafId) return;
            rafId = requestAnimationFrame(function() {
                rafId = null;
                onMouseMove(e);
            });
        });

        document.addEventListener('mouseleave', onMouseLeave);

        if (toggleBtn) {
            document.addEventListener('click', function(e) {
                if (e.target.closest && e.target.closest('#toggleSidebar') === toggleBtn) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    manualCollapsed = !(autoCollapsed || manualCollapsed);
                    autoCollapsed = false;
                    lastX = -1;
                    applyState();
                }
            }, true);
        }

        applyState();
    });

})(window);
