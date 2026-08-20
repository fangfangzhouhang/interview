// main_sheet.js - 完整文件

// ===== 懒加载函数 =====
function lazyLoadImages() {
    if ('IntersectionObserver' in window) {
        const lazyImages = document.querySelectorAll('.lazy-load');
        if (lazyImages.length === 0) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.classList.remove('lazy-load');

                        // ===== 图片加载成功 =====
                        img.onload = function() {
                            this.classList.add('loaded');
                        };

                        // ===== 图片加载失败（404等） =====
                        img.onerror = function() {
                            this.onerror = null; // 防止无限循环
                            const wrapper = this.parentElement;
                            if (wrapper) {
                                wrapper.innerHTML = `
                                    <div class="candidate-avatar-placeholder">
                                        <span class="avatar-error-text">
                                            <span class="avatar-icon">📷</span>
                                            <span>暂未上传</span>
                                            <small>点击上传</small>
                                        </span>
                                    </div>
                                `;
                            }
                        };

                        observer.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: '50px',
            threshold: 0.01
        });

        lazyImages.forEach(img => observer.observe(img));
    } else {
        // 降级方案：不支持 IntersectionObserver 时直接加载
        document.querySelectorAll('.lazy-load').forEach(img => {
            if (img.dataset.src) {
                img.src = img.dataset.src;
                img.classList.remove('lazy-load');
                img.onload = function() {
                    this.classList.add('loaded');
                };
                img.onerror = function() {
                    this.onerror = null;
                    const wrapper = this.parentElement;
                    if (wrapper) {
                        wrapper.innerHTML = `
                            <div class="candidate-avatar-placeholder">
                                <span class="avatar-error-text">
                                    <span>暂无证件照</span>
                                </span>
                            </div>
                        `;
                    }
                };
                img.classList.add('loaded');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {

    const candidateButtons = document.getElementById('candidateButtons');
    const infoBody = document.getElementById('infoBody');
    const loadingText = document.getElementById('loadingText');
    const groupTitle = document.getElementById('groupTitle');
    const groupStatus = document.getElementById('groupStatus');
    const selfIntroContainer = document.getElementById('selfIntroContainer');
    const evaluationContainer = document.getElementById('evaluationContainer');
    const basicQuestion1 = document.getElementById('basicQuestion1');
    const basicQuestion2 = document.getElementById('basicQuestion2');
    const rushQuestion = document.getElementById('rushQuestion');
    const currentCandidateId = document.getElementById('currentCandidateId');
    const groupIdInput = document.getElementById('groupId');
    const evaluationForm = document.getElementById('evaluationForm');
    const clearScoreBtn = document.getElementById('clearScoreBtn');
    const saveBtn = document.getElementById('saveBtn');
    const saveBtnLabel = saveBtn ? saveBtn.querySelector('.save-btn-label') : null;
    const saveState = document.getElementById('saveState');
    const refreshCandidateBtn = document.getElementById('refreshCandidateBtn');
    const backBtn = document.getElementById('backBtn');
    const messageContainer = document.getElementById('messageContainer');
    const statusModal = document.getElementById('statusModal');
    const statusModalTitle = document.getElementById('statusModalTitle');
    const statusModalDesc = document.getElementById('statusModalDesc');
    const statusModalChief = document.getElementById('statusModalChief');
    const statusModalBtn = document.getElementById('statusModalBtn');
    const statusModalIcon = document.getElementById('statusModalIcon');
    const statusModalBackBtn = document.getElementById('statusModalBackBtn');
    const controlModal = document.getElementById('controlModal');
    const controlModalClose = document.getElementById('controlModalClose');
    const controlCurrentStatus = document.getElementById('controlCurrentStatus');
    const controlStartBtn = document.getElementById('controlStartBtn');
    const controlPauseBtn = document.getElementById('controlPauseBtn');
    const controlEndBtn = document.getElementById('controlEndBtn');
    const statusControl = document.getElementById('statusControl');
    const statusControlBtn = document.getElementById('statusControlBtn');
    const isChiefInput = document.getElementById('isChief');
    const groupStatusHidden = document.getElementById('groupStatusHidden');
    const timerDisplay = document.getElementById('timerDisplay');
    const wssStatusEl = document.getElementById('wssStatus');

    if (!candidateButtons || !infoBody || !selfIntroContainer || !evaluationContainer) {
        console.error('核心DOM元素不存在');
        return;
    }

    const groupId = groupIdInput ? groupIdInput.value : '';
    let candidatesData = [];
    let currentOrder = null;
    let currentCandidateInGroupId = null;
    let isInitialLoad = true;
    let isChief = false;
    let currentGroupStatus = '';
    let currentChiefName = '';
    let isSaving = false;
    let isDirty = false;
    let timerInterval = null;
    let timerStartTime = null;
    let ws = null;
    let isWebSocketConnected = false;
    let isWebSocketMode = false;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 10;

    let pollingInterval = null;
    const POLLING_INTERVAL = 10000;

    let isWssUpdating = false;

    function updateSaveState(state, text) {
        if (!saveState) return;
        saveState.classList.remove('is-dirty', 'is-saved');
        if (state === 'dirty') saveState.classList.add('is-dirty');
        if (state === 'saved') saveState.classList.add('is-saved');
        saveState.textContent = text;
    }

    function setSaveLoading(isLoading) {
        if (!saveBtn) return;
        saveBtn.classList.toggle('is-loading', isLoading);
        saveBtn.setAttribute('aria-busy', String(isLoading));
        if (saveBtnLabel) saveBtnLabel.textContent = isLoading ? '保存中' : '保存评价';
        saveBtn.disabled = isLoading || currentGroupStatus !== 'ONGOING';
    }

    // ===== WebSocket 连接 =====
    function getWebSocketUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}/ws/interview/${groupId}/`;
    }

    function updateConnectionStatus(connected) {
        if (!wssStatusEl) return;
        if (connected) {
            wssStatusEl.textContent = 'WS实时协作';
            wssStatusEl.className = 'wss-status online';
            isWebSocketMode = true;
            stopPolling();
        } else {
            wssStatusEl.textContent = 'WS离线模式';
            wssStatusEl.className = 'wss-status offline';
            isWebSocketMode = false;
            startPolling();
        }
    }

    function startPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
        if (!isWebSocketConnected && document.visibilityState === 'visible') {
            pollingInterval = setInterval(function() {
                pollQuestionsContent();
            }, POLLING_INTERVAL);
        }
    }

    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            if (!isWebSocketConnected) {
                startPolling();
            }
        } else {
            stopPolling();
        }
    });

    async function pollQuestionsContent() {
        try {
            const canEdit = isWebSocketMode || isChief;
            const currentQuestions = getQuestionData();

            let url = `/api/groups/${groupId}/questions/`;
            const params = new URLSearchParams();

            if (canEdit && currentGroupStatus === 'ONGOING') {
                params.append('basic_question_1', currentQuestions.basic_question_1 || '');
                params.append('basic_question_2', currentQuestions.basic_question_2 || '');
                params.append('rush_question', currentQuestions.rush_question || '');
            }

            const queryString = params.toString();
            if (queryString) {
                url += '?' + queryString;
            }

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    updateQuestionInputs({
                        basic_question_1: data.basic_question_1 || '',
                        basic_question_2: data.basic_question_2 || '',
                        rush_question: data.rush_question || ''
                    });
                }
            }
        } catch (e) {
            // 静默失败
        }
    }

    function updateQuestionInputs(questionData) {
        if (basicQuestion1) {
            basicQuestion1.value = questionData.basic_question_1 || '';
        }
        if (basicQuestion2) {
            basicQuestion2.value = questionData.basic_question_2 || '';
        }
        if (rushQuestion) {
            rushQuestion.value = questionData.rush_question || '';
        }
    }

    function getQuestionData() {
        return {
            basic_question_1: basicQuestion1 ? basicQuestion1.value : '',
            basic_question_2: basicQuestion2 ? basicQuestion2.value : '',
            rush_question: rushQuestion ? rushQuestion.value : ''
        };
    }

    function connectWebSocket() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            const wsUrl = getWebSocketUrl();
            ws = new WebSocket(wsUrl);

            ws.onopen = function() {
                isWebSocketConnected = true;
                isWebSocketMode = true;
                reconnectAttempts = 0;
                updateConnectionStatus(true);
                sendWebSocketMessage({ action: 'get_questions' });
                refreshPermissionStatus();
            };

            ws.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    handleWebSocketMessage(data);
                } catch (e) {
                    console.error('WebSocket消息解析失败:', e);
                }
            };

            ws.onclose = function(event) {
                isWebSocketConnected = false;
                isWebSocketMode = false;
                updateConnectionStatus(false);
                refreshPermissionStatus();

                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 10000);
                    setTimeout(connectWebSocket, delay);
                } else {
                    showMessage('连接断开，已切换到离线模式', 'error');
                }
            };

            ws.onerror = function(error) {
                console.error('WebSocket错误:', error);
            };
        } catch (e) {
            console.error('WebSocket连接失败:', e);
            isWebSocketMode = false;
            updateConnectionStatus(false);
            setTimeout(connectWebSocket, 3000);
        }
    }

    function sendWebSocketMessage(data) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
            return true;
        } else {
            console.warn('WebSocket未连接');
            return false;
        }
    }

    function handleWebSocketMessage(data) {
        const type = data.type;

        switch (type) {
            case 'initial_data':
                isWssUpdating = true;
                updateQuestionInputs({
                    basic_question_1: data.basic_question_1 || '',
                    basic_question_2: data.basic_question_2 || '',
                    rush_question: data.rush_question || ''
                });
                isWssUpdating = false;

                if (data.status !== undefined) {
                    currentGroupStatus = data.status;
                    updateGroupStatusDisplay(data.status);
                    updateUIByStatus(data.status);
                    refreshPermissionStatus();
                    checkAndShowStatusModal();
                }
                break;

            case 'questions':
            case 'questions_updated':
                isWssUpdating = true;
                updateQuestionInputs({
                    basic_question_1: data.basic_question_1 || '',
                    basic_question_2: data.basic_question_2 || '',
                    rush_question: data.rush_question || ''
                });
                isWssUpdating = false;
                if (type === 'questions_updated') {
                    showMessage('📝 题目已更新', 'success');
                }
                break;

            case 'status_changed':
                handleStatusChangeFromWss(data);
                break;

            case 'success':
                showMessage('✅ ' + (data.message || '操作成功'), 'success');
                break;

            case 'error':
                showMessage('❌ ' + (data.message || '操作失败'), 'error');
                break;

            default:
                console.log('未知消息类型:', type, data);
        }
    }

    function handleStatusChangeFromWss(data) {
        const newStatus = data.status;
        if (newStatus !== currentGroupStatus) {
            currentGroupStatus = newStatus;
            updateGroupStatusDisplay(newStatus);

            const statusMap = {
                'ONGOING': '▶ 面试已开始',
                'PAUSE': '⏸ 面试已暂停',
                'ENDED': '⏹ 面试已结束',
                'CANCELLED': '✖ 面试已取消'
            };
            if (statusMap[newStatus]) {
                showMessage(statusMap[newStatus], 'success');
            }

            if (data.start_time) {
                timerStartTime = new Date(data.start_time);
                if (newStatus === 'ONGOING') {
                    startTimer(timerStartTime);
                } else if (newStatus === 'PAUSE') {
                    const now = new Date();
                    const elapsedSeconds = (now - timerStartTime) / 1000;
                    updateTimerDisplay(elapsedSeconds);
                    stopTimer();
                }
            }
            if (newStatus === 'ENDED' && data.end_time) {
                const endTime = new Date(data.end_time);
                const totalSeconds = (endTime - timerStartTime) / 1000;
                updateTimerDisplay(totalSeconds);
                stopTimer();
            }

            updateUIByStatus(newStatus);
            refreshPermissionStatus();

            if (newStatus === 'ONGOING' || newStatus === 'ENDED') {
                if (statusModal) statusModal.style.display = 'none';
            }
            if (newStatus === 'ENDED') {
                if (statusControl) statusControl.style.display = 'none';
            }
        }
    }

    function refreshPermissionStatus() {
        const hasControlPermission = isWebSocketMode || isChief;

        if (statusControl) {
            statusControl.style.display = (hasControlPermission &&
                currentGroupStatus !== 'ENDED' &&
                currentGroupStatus !== 'CANCELLED') ? 'inline-block' : 'none';
        }

        if (statusModalBtn) {
            const status = currentGroupStatus;
            if (status === 'PENDING' || status === 'PAUSE') {
                if (hasControlPermission) {
                    statusModalBtn.style.display = 'block';
                    statusModalBtn.textContent = status === 'PENDING' ? '▶ 开始面试' : '▶ 继续面试';
                    statusModalBtn.onclick = () => handleStatusAction('start');
                } else {
                    statusModalBtn.style.display = 'none';
                }
            }
        }

        setQuestionsEditable();
        updateControlButtons();
    }

    function updateGroupStatusDisplay(status) {
        if (!groupStatus) return;
        const statusMap = {
            'PENDING': '待开始',
            'ONGOING': '进行中',
            'PAUSE': '暂停中',
            'ENDED': '已结束',
            'CANCELLED': '已取消'
        };
        groupStatus.textContent = statusMap[status] || status;
        groupStatus.className = 'group-status ' + status;
        if (groupStatusHidden) groupStatusHidden.value = status;
    }

    function handleTimerData(data) {
        if (data.start_time) {
            timerStartTime = new Date(data.start_time);

            if (data.status === 'ONGOING') {
                startTimer(timerStartTime);
            } else if (data.status === 'ENDED' && data.end_time) {
                const endTime = new Date(data.end_time);
                const totalSeconds = (endTime - timerStartTime) / 1000;
                updateTimerDisplay(totalSeconds);
                stopTimer();
            } else if (data.status === 'PAUSE') {
                const now = new Date();
                const elapsedSeconds = (now - timerStartTime) / 1000;
                updateTimerDisplay(elapsedSeconds);
                stopTimer();
            }
        } else if (data.status === 'PENDING') {
            updateTimerDisplay(0);
        }
    }

    function updateUIByStatus(status) {
        const isEditable = status === 'ONGOING';
        setFormEditable(isEditable);
        checkAndShowStatusModal();
        updateControlButtons();
    }

    function updateControlButtons() {
        if (!controlCurrentStatus) return;

        const statusMap = {
            'PENDING': '待开始',
            'ONGOING': '进行中',
            'PAUSE': '暂停中',
            'ENDED': '已结束',
            'CANCELLED': '已取消'
        };
        controlCurrentStatus.textContent = statusMap[currentGroupStatus] || currentGroupStatus;
        controlCurrentStatus.className = 'control-status-badge ' + currentGroupStatus;

        const hasControl = isWebSocketMode || isChief;
        const isActive = hasControl && currentGroupStatus !== 'ENDED' && currentGroupStatus !== 'CANCELLED';

        if (controlStartBtn) {
            controlStartBtn.disabled = !isActive || (currentGroupStatus !== 'PENDING' && currentGroupStatus !== 'PAUSE');
        }
        if (controlPauseBtn) {
            controlPauseBtn.disabled = !isActive || (currentGroupStatus !== 'ONGOING');
        }
        if (controlEndBtn) {
            controlEndBtn.disabled = !isActive || (currentGroupStatus !== 'ONGOING' && currentGroupStatus !== 'PAUSE');
        }

        if (statusControl) {
            statusControl.style.display = isActive ? 'inline-block' : 'none';
        }
    }

    function formatTime(seconds) {
        if (seconds < 0) seconds = 0;
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function startTimer(startTime) {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        timerStartTime = new Date(startTime);
        timerDisplay.style.display = 'inline-block';

        timerInterval = setInterval(function() {
            const now = new Date();
            const elapsedSeconds = (now - timerStartTime) / 1000;
            timerDisplay.textContent = formatTime(elapsedSeconds);
        }, 1000);

        const now = new Date();
        const elapsedSeconds = (now - timerStartTime) / 1000;
        timerDisplay.textContent = formatTime(elapsedSeconds);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function updateTimerDisplay(seconds) {
        timerDisplay.textContent = formatTime(seconds);
        timerDisplay.style.display = 'inline-block';
    }

    function setFormEditable(editable) {
        selfIntroContainer.querySelectorAll('textarea').forEach(ta => {
            ta.disabled = !editable;
        });
        evaluationContainer.querySelectorAll('.eval-score-input').forEach(inp => {
            inp.disabled = !editable;
        });
        evaluationContainer.querySelectorAll('.eval-comment-input').forEach(ta => {
            ta.disabled = !editable;
        });
        if (saveBtn) saveBtn.disabled = !editable;
        if (clearScoreBtn) clearScoreBtn.disabled = !editable;
        if (refreshCandidateBtn) refreshCandidateBtn.disabled = !currentCandidateInGroupId;
    }

    function setQuestionsEditable() {
        const canEdit = (isWebSocketMode || isChief) && (currentGroupStatus === 'ONGOING');
        if (basicQuestion1) {
            basicQuestion1.disabled = !canEdit;
            basicQuestion1.style.backgroundColor = canEdit ? '#fff' : '#f7fafc';
        }
        if (basicQuestion2) {
            basicQuestion2.disabled = !canEdit;
            basicQuestion2.style.backgroundColor = canEdit ? '#fff' : '#f7fafc';
        }
        if (rushQuestion) {
            rushQuestion.disabled = !canEdit;
            rushQuestion.style.backgroundColor = canEdit ? '#fff' : '#f7fafc';
        }
    }

    // ===== renderInfo 函数（包含头像显示和懒加载） =====
    function renderInfo(data, order) {
        const c = data.candidate;
        const scores = data.scores || [];
        const validScores = scores.filter(item => item.score > 0);
        let avg = 0;
        if (validScores.length) {
            avg = (validScores.reduce((s, x) => s + x.score, 0) / validScores.length).toFixed(2);
        }

        const myScore = data.score;
        const myComment = data.comment || '';

        // 获取头像缩略图URL
        const avatarThumbUrl = c.avatar_thumbnail_url || c.avatar_url || '';

        let html = `
            <div class="info-row avatar-row">
                <div class="candidate-avatar-wrapper">
                    ${avatarThumbUrl ?
                        `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 106'%3E%3Crect fill='%23f0f0f0' width='80' height='106'/%3E%3C/svg%3E"
                             data-src="${avatarThumbUrl}"
                             alt="${c.name}"
                             class="candidate-avatar-thumb lazy-load"
                             loading="lazy">` :
                        `<div class="candidate-avatar-placeholder">${c.name.charAt(0)}</div>`
                    }
                </div>
            </div>
            <div class="info-row"><label>序号</label><span>第 ${order} 位</span></div>
            <div class="info-row"><label>姓名</label><span>${c.name}</span></div>
            <div class="info-row"><label>性别</label><span>${c.gender_display || c.gender}</span></div>
            <div class="info-row"><label>学号</label><span>${c.student_number}</span></div>
            <div class="info-row"><label>学院</label><span>${c.school_display || c.school}</span></div>
            <div class="info-row"><label>班级</label><span>${c.homeroom}</span></div>
            <div class="info-row"><label>政治面貌</label><span>${c.political_status}</span></div>
            <div class="info-row full"><label>兴趣爱好</label><span>${c.character || '无'}</span></div>
            <div class="info-row full"><label>自我介绍</label><span>${c.introduction || '无'}</span></div>
            <div class="info-row full"><label>工作经历</label><span>${c.experience || '未填写或无'}</span></div>
            <div class="info-row full"><label>所获荣誉</label><span>${c.honor || '未填写或无'}</span></div>
        `;

        // 我的评分
        if (myScore !== null && myScore !== undefined && myScore > 0) {
            html += `<div class="info-row full"><label>我的评分</label><span class="my-score-tag">${myScore.toFixed(2)} 分</span></div>`;
        }
        if (myComment) {
            html += `<div class="info-row full"><label>我的评语</label><span>${myComment}</span></div>`;
        }

        // 所有评分
        if (validScores.length) {
            html += `<div class="info-row full"><label>所有评分</label><span>`;
            validScores.forEach(s => {
                html += `<span class="score-tag">${s.interviewer}: ${s.score.toFixed(2)}</span> `;
            });
            html += `<span class="score-tag avg">平均: ${avg}</span></span></div>`;
        }

        infoBody.innerHTML = html;
        updatePlaceholders(c.name);

        // ===== 调用懒加载（新图片需要重新观察） =====
        lazyLoadImages();
    }

    // ===== renderForm 函数 =====
    function renderForm(candidates) {
        const sortedCandidates = (candidates || []).sort((a, b) => a.order - b.order);

        let introHtml = '';
        sortedCandidates.forEach(c => {
            introHtml += `
                <div class="intro-item">
                    <label>面试者${c.order}（${c.candidate.name}）</label>
                    <textarea class="self-intro-input" data-order="${c.order}" data-candidate-id="${c.candidate.id}"
                              rows="2" placeholder="请输入面试者${c.order}的自我介绍"></textarea>
                </div>
            `;
        });
        selfIntroContainer.innerHTML = introHtml || '<div class="placeholder">暂无面试者</div>';

        let evalHtml = '';
        sortedCandidates.forEach(c => {
            evalHtml += `
                <div class="evaluation-card" data-order="${c.order}" data-candidate-id="${c.candidate.id}">
                    <div class="eval-header">面试者${c.order}（${c.candidate.name}）</div>
                    <div class="eval-score-row">
                        <span class="eval-score-label">评分</span>
                        <input type="number" class="eval-score-input" data-order="${c.order}"
                               min="0" max="10" step="0.01" value="0.00">
                        <span class="eval-unit">分</span>
                    </div>
                    <div class="eval-comment-row">
                        <span class="eval-comment-label">评语</span>
                        <textarea class="eval-comment-input" data-order="${c.order}"
                                  rows="2" placeholder="请输入面试者${c.order}的评语"></textarea>
                    </div>
                </div>
            `;
        });
        evaluationContainer.innerHTML = evalHtml || '<div class="placeholder">暂无面试者</div>';

        const isEditable = currentGroupStatus === 'ONGOING';
        setFormEditable(isEditable);

        document.querySelectorAll('.eval-score-input').forEach(input => {
            input.addEventListener('input', function() {
                let val = parseFloat(this.value);
                if (isNaN(val)) this.value = '0.00';
                else if (val < 0.01) this.value = '0.01';
                else if (val > 10) this.value = '10.00';
                else this.value = val.toFixed(2);
            });
        });
    }

    function renderButtons(candidates) {
        if (!candidateButtons) return;
        const max = 6;
        let html = '';
        for (let i = 1; i <= max; i++) {
            const c = candidates.find(x => x.order === i);
            if (c) {
                const hasScore = c.has_score !== undefined ? c.has_score : false;
                html += `<button class="candidate-btn" data-id="${c.id}" data-order="${c.order}">
                            ${c.order}${hasScore ? ' ✓' : ''}
                         </button>`;
            } else {
                html += `<button class="candidate-btn empty" disabled>${i}</button>`;
            }
        }
        candidateButtons.innerHTML = html;

        document.querySelectorAll('.candidate-btn:not(.empty)').forEach(btn => {
            btn.addEventListener('click', async function() {
                const nextId = parseInt(this.dataset.id);
                if (isDirty && currentCandidateInGroupId && nextId !== currentCandidateInGroupId) {
                    const shouldSwitch = window.confirm('当前评价尚未保存，切换面试者会覆盖本页未保存内容。是否继续？');
                    if (!shouldSwitch) return;
                }

                document.querySelectorAll('.candidate-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                const id = nextId;
                const order = parseInt(this.dataset.order);
                currentCandidateInGroupId = id;
                currentOrder = order;
                if (currentCandidateId) currentCandidateId.value = id;
                if (refreshCandidateBtn) refreshCandidateBtn.disabled = false;
                updateSaveState('idle', '正在读取评价');
                await Promise.all([
                    loadCandidateInfo(id, order),
                    loadEvaluationToForm(id, order)
                ]);
            });
        });
    }

    function clearForm() {
        selfIntroContainer.querySelectorAll('textarea').forEach(ta => ta.value = '');
        evaluationContainer.querySelectorAll('.eval-score-input').forEach(inp => inp.value = '0.00');
        evaluationContainer.querySelectorAll('.eval-comment-input').forEach(ta => ta.value = '');
    }

    function updatePlaceholders(name) {
        const introTextareas = selfIntroContainer.querySelectorAll('textarea');
        introTextareas.forEach((ta, idx) => {
            const order = idx + 1;
            ta.placeholder = `面试者${order}（${name}）的自我介绍`;
        });

        const commentInputs = evaluationContainer.querySelectorAll('.eval-comment-input');
        commentInputs.forEach((input, idx) => {
            const order = idx + 1;
            input.placeholder = `面试者${order}（${name}）的评语`;
        });
    }

    // ===== loadCandidateInfo 函数 =====
    async function loadCandidateInfo(candidateInGroupId, order) {
        showLoading(true);

        try {
            const res = await fetch(`/api/candidates/${candidateInGroupId}/`);
            if (res.ok) {
                const data = await res.json();
                renderInfo(data, order);
            } else {
                infoBody.innerHTML = '<div class="placeholder" style="color:#e53e3e;">加载失败</div>';
            }
        } catch (e) {
            infoBody.innerHTML = '<div class="placeholder" style="color:#e53e3e;">网络错误</div>';
        } finally {
            showLoading(false);
        }
    }

    async function loadEvaluationToForm(candidateInGroupId, order) {
        try {
            const res = await fetch(`/api/evaluation/${candidateInGroupId}/`);
            if (res.ok) {
                const data = await res.json();
                if (data.has_evaluation) {
                    const introTextareas = selfIntroContainer.querySelectorAll('textarea');
                    introTextareas.forEach((ta) => {
                        const orderNum = ta.dataset.order;
                        const key = `self_intro_${orderNum}`;
                        ta.value = data[key] || '';
                    });

                    const evalCards = evaluationContainer.querySelectorAll('.evaluation-card');
                    evalCards.forEach((card) => {
                        const orderNum = parseInt(card.dataset.order);
                        const scoreInput = card.querySelector('.eval-score-input');
                        const commentInput = card.querySelector('.eval-comment-input');

                        const scoreKey = `score_${orderNum}`;
                        const commentKey = `comment_${orderNum}`;

                        if (data[scoreKey] !== undefined && data[scoreKey] !== null) {
                            scoreInput.value = data[scoreKey].toFixed(2);
                        } else {
                            scoreInput.value = '0.00';
                        }
                        commentInput.value = data[commentKey] || '';
                    });
                    updateSaveState('saved', '已载入现有评价');
                } else {
                    clearForm();
                    updateSaveState('idle', '尚未保存');
                }
                isDirty = false;
            } else {
                clearForm();
                isDirty = false;
                updateSaveState('idle', '评价读取失败');
                showMessage('评价读取失败，请点击刷新资料重试', 'error');
            }
        } catch (e) {
            clearForm();
            isDirty = false;
            updateSaveState('idle', '网络连接异常');
            showMessage('网络连接异常，未能读取评价', 'error');
        }
    }

    function clearScores() {
        evaluationContainer.querySelectorAll('.eval-score-input').forEach(inp => inp.value = '0.00');
        isDirty = true;
        updateSaveState('dirty', '有未保存修改');
        showMessage('评分已清零', 'success');
    }

    function getCurrentFormData() {
        const candidateId = currentCandidateId ? currentCandidateId.value : '';
        const selfIntros = {};
        selfIntroContainer.querySelectorAll('.self-intro-input').forEach(ta => {
            const order = ta.dataset.order;
            selfIntros[`self_intro_${order}`] = ta.value;
        });

        const scores = {};
        const comments = {};
        evaluationContainer.querySelectorAll('.evaluation-card').forEach(card => {
            const order = card.dataset.order;
            const scoreInput = card.querySelector('.eval-score-input');
            const commentInput = card.querySelector('.eval-comment-input');
            scores[`score_${order}`] = parseFloat(scoreInput.value) || 0;
            comments[`comment_${order}`] = commentInput.value || '';
        });

        return {
            candidate_in_group_id: parseInt(candidateId),
            ...selfIntros,
            ...scores,
            ...comments,
        };
    }

    // ===== 保存评价 =====
    async function saveEvaluation(showSuccessMsg = true, silent = false) {
        if (isSaving) return false;

        const candidateId = currentCandidateId ? currentCandidateId.value : '';
        if (!candidateId) {
            if (showSuccessMsg && !silent) showMessage('请先选择一位面试者', 'error');
            return false;
        }

        if (currentGroupStatus === 'ENDED' || currentGroupStatus === 'CANCELLED') {
            if (showSuccessMsg && !silent) showMessage('面试已结束，不可编辑', 'error');
            return false;
        }

        if (currentGroupStatus === 'PENDING' || currentGroupStatus === 'PAUSE') {
            if (showSuccessMsg && !silent) showMessage('面试尚未开始或已暂停，不可编辑', 'error');
            return false;
        }

        isSaving = true;
        setSaveLoading(true);
        updateSaveState('idle', '正在保存评价');

        const payload = getCurrentFormData();

        try {
            const res = await fetch('/api/evaluation/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCSRFToken(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.success) {
                isDirty = false;
                const savedAt = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                updateSaveState('saved', `${savedAt} 已保存`);
                if (showSuccessMsg && !silent) showMessage('评价已保存', 'success');
                return true;
            } else {
                updateSaveState('dirty', '保存失败，修改仍保留');
                if (showSuccessMsg && !silent) showMessage('保存失败: ' + (data.error || '未知'), 'error');
                return false;
            }
        } catch (e) {
            updateSaveState('dirty', '网络异常，修改仍保留');
            if (showSuccessMsg && !silent) showMessage('网络错误', 'error');
            return false;
        } finally {
            isSaving = false;
            setSaveLoading(false);
        }
    }

    // ===== WSS 同步题目 =====
    function syncQuestionsViaWSS() {
        if (!isWebSocketConnected) {
            showMessage('实时协作已断开，请刷新页面重试', 'error');
            return false;
        }

        if (currentGroupStatus !== 'ONGOING') {
            showMessage('面试未开始，无法同步题目', 'error');
            return false;
        }

        const questionData = getQuestionData();
        const payload = {
            action: 'sync_questions',
            ...questionData
        };

        return sendWebSocketMessage(payload);
    }

    // ===== WSS 同步状态 =====
    function handleStatusActionViaWebSocket(action) {
        const actionMap = {
            'start': {
                confirmMsg: '确定要开始面试吗？',
                successMsg: '面试已开始'
            },
            'pause': {
                confirmMsg: '确定要暂停面试吗？',
                successMsg: '面试已暂停'
            },
            'end': {
                confirmMsg: '确定要结束面试吗？',
                successMsg: '面试已结束'
            }
        };

        const config = actionMap[action];
        if (!config) return;

        if (!confirm(config.confirmMsg)) return;

        const payload = {
            action: 'status_action',
            status_action: action
        };

        const sent = sendWebSocketMessage(payload);
        if (!sent) {
            showMessage('网络连接中断，请刷新页面', 'error');
            return;
        }

        if (controlModal) controlModal.style.display = 'none';
    }

    // ===== 处理状态操作 =====
    async function handleStatusAction(action) {
        if (isWebSocketConnected) {
            handleStatusActionViaWebSocket(action);
            return;
        }

        const actionMap = {
            'start': {
                confirmMsg: '确定要开始面试吗？',
                successMsg: '面试已开始'
            },
            'pause': {
                confirmMsg: '确定要暂停面试吗？',
                successMsg: '面试已暂停'
            },
            'end': {
                confirmMsg: '确定要结束面试吗？',
                successMsg: '面试已结束'
            }
        };

        const config = actionMap[action];
        if (!config) return;

        if (!confirm(config.confirmMsg)) return;

        try {
            const res = await fetch(`/api/groups/${groupId}/status/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCSRFToken(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: action })
            });
            const data = await res.json();
            if (data.success) {
                showMessage('✅ ' + config.successMsg, 'success');
                currentGroupStatus = data.status;
                updateGroupStatusDisplay(data.status);

                if (action === 'start') {
                    if (!timerStartTime) timerStartTime = new Date();
                    startTimer(timerStartTime);
                } else if (action === 'end') {
                    if (timerStartTime) {
                        const now = new Date();
                        const totalSeconds = (now - timerStartTime) / 1000;
                        updateTimerDisplay(totalSeconds);
                    }
                    stopTimer();
                } else if (action === 'pause') {
                    if (timerStartTime) {
                        const now = new Date();
                        const elapsedSeconds = (now - timerStartTime) / 1000;
                        updateTimerDisplay(elapsedSeconds);
                    }
                    stopTimer();
                }

                if (controlModal) controlModal.style.display = 'none';
                checkAndShowStatusModal();
            } else {
                showMessage('操作失败: ' + (data.error || '未知'), 'error');
            }
        } catch (e) {
            showMessage('网络错误', 'error');
        }
    }

    function getCSRFToken() {
        const token = document.querySelector('[name=csrfmiddlewaretoken]');
        return token ? token.value : '';
    }

    function showMessage(text, type) {
        if (!messageContainer) return;
        const cls = type === 'error' ? 'msg-error' : 'msg-success';
        const message = document.createElement('div');
        message.className = cls;
        message.textContent = text;
        messageContainer.replaceChildren(message);
        setTimeout(() => { messageContainer.innerHTML = ''; }, 4000);
    }

    function showLoading(show) {
        if (loadingText) {
            loadingText.style.display = show ? 'inline' : 'none';
        }
    }

    async function loadCandidates() {
        try {
            const res = await fetch(`/api/groups/${groupId}/candidates/`);
            if (res.ok) {
                const data = await res.json();
                candidatesData = data;
                renderForm(data);
                renderButtons(data);
                if (data.length > 0 && isInitialLoad) {
                    const first = document.querySelector('.candidate-btn:not(.empty)');
                    if (first) {
                        await first.click();
                        isInitialLoad = false;
                    }
                }
            } else {
                const data = await res.json();
                if (data.error) {
                    showMessage('权限错误: ' + data.error, 'error');
                    setFormEditable(false);
                } else {
                    showMessage('加载面试者失败', 'error');
                }
            }
        } catch (e) {
            showMessage('网络错误', 'error');
        }
    }

    function checkAndShowStatusModal() {
        if (!statusModal) return;

        const status = currentGroupStatus;

        if (status === 'ENDED' || status === 'CANCELLED') {
            statusModal.style.display = 'none';
            setFormEditable(false);
            setQuestionsEditable();
            if (statusControl) statusControl.style.display = 'none';
            return;
        }

        if (status === 'ONGOING') {
            statusModal.style.display = 'none';
            setFormEditable(true);
            setQuestionsEditable();
            const hasControl = isWebSocketMode || isChief;
            if (statusControl) {
                statusControl.style.display = hasControl ? 'inline-block' : 'none';
            }
            return;
        }

        if (status === 'PENDING') {
            statusModalIcon.textContent = '⏳';
            statusModalTitle.textContent = '面试尚未开始';
            statusModalDesc.textContent = '当前状态为：待开始';
            updateTimerDisplay(0);

            const hasControl = isWebSocketMode || isChief;
            if (hasControl) {
                statusModalChief.textContent = isWebSocketMode ? 'WebSocket协作模式 - 您可以开始面试' : '您是主面试官，可以开始面试';
                statusModalBtn.style.display = 'block';
                statusModalBtn.textContent = '▶ 开始面试';
                statusModalBtn.onclick = () => handleStatusAction('start');
            } else {
                statusModalChief.textContent = `主面试官：${currentChiefName || '未设置'}`;
                statusModalBtn.style.display = 'none';
            }

            statusModal.style.display = 'flex';
            setFormEditable(false);
            setQuestionsEditable();
            if (statusControl) statusControl.style.display = 'none';
            return;
        }

        if (status === 'PAUSE') {
            statusModalIcon.textContent = '⏸';
            statusModalTitle.textContent = '面试已暂停';
            statusModalDesc.textContent = '当前状态为：暂停中';
            if (timerStartTime) {
                const now = new Date();
                const elapsedSeconds = (now - timerStartTime) / 1000;
                updateTimerDisplay(elapsedSeconds);
            } else {
                updateTimerDisplay(0);
            }

            const hasControl = isWebSocketMode || isChief;
            if (hasControl) {
                statusModalChief.textContent = isWebSocketMode ? 'WebSocket协作模式 - 您可以继续面试' : '您是主面试官，可以继续面试';
                statusModalBtn.style.display = 'block';
                statusModalBtn.textContent = '▶ 继续面试';
                statusModalBtn.onclick = () => handleStatusAction('start');
            } else {
                statusModalChief.textContent = `主面试官：${currentChiefName || '未设置'}`;
                statusModalBtn.style.display = 'none';
            }

            statusModal.style.display = 'flex';
            setFormEditable(false);
            setQuestionsEditable();
            if (statusControl) statusControl.style.display = 'none';
            return;
        }

        statusModal.style.display = 'none';
    }

    async function loadGroupInfo() {
        if (!groupId) {
            if (groupTitle) groupTitle.textContent = '⚠️ 无效场次';
            if (groupStatus) groupStatus.textContent = '请从面板进入';
            return;
        }

        const wssStatusEl = document.getElementById('wssStatus');
        if (wssStatusEl) {
            wssStatusEl.textContent = 'WS离线模式';
            wssStatusEl.className = 'wss-status offline';
        }

        try {
            const res = await fetch(`/api/groups/${groupId}/`);
            const data = await res.json();
            if (res.ok) {
                if (groupTitle) groupTitle.textContent = data.group_id || '未命名场次';
                currentGroupStatus = data.status || 'PENDING';
                currentChiefName = data.chief_name || '';
                isChief = data.is_chief || false;

                if (isChiefInput) isChiefInput.value = isChief ? 'true' : 'false';
                if (groupStatusHidden) groupStatusHidden.value = currentGroupStatus;

                updateGroupStatusDisplay(currentGroupStatus);

                updateQuestionInputs({
                    basic_question_1: data.basic_question1 || '',
                    basic_question_2: data.basic_question2 || '',
                    rush_question: data.rush_question || ''
                });

                if (data.start_time) {
                    timerStartTime = new Date(data.start_time);
                    if (data.status === 'ONGOING') {
                        startTimer(timerStartTime);
                    } else if (data.status === 'ENDED' && data.end_time) {
                        const endTime = new Date(data.end_time);
                        const totalSeconds = (endTime - timerStartTime) / 1000;
                        updateTimerDisplay(totalSeconds);
                        stopTimer();
                    } else if (data.status === 'PAUSE') {
                        const now = new Date();
                        const elapsedSeconds = (now - timerStartTime) / 1000;
                        updateTimerDisplay(elapsedSeconds);
                        stopTimer();
                    }
                } else if (data.status === 'PENDING') {
                    updateTimerDisplay(0);
                }

                await loadCandidates();

                setupQuestionChangeListener();

                checkAndShowStatusModal();
                setQuestionsEditable();
                refreshPermissionStatus();

                connectWebSocket();

            } else {
                if (data.error) {
                    showMessage('权限错误: ' + data.error, 'error');
                    setFormEditable(false);
                    setQuestionsEditable();
                } else {
                    showMessage('加载失败: ' + (data.error || '未知'), 'error');
                }
            }
        } catch (e) {
            showMessage('网络错误', 'error');
        }
    }

    function setupQuestionChangeListener() {
        let syncTimer = null;

        const questionInputs = [basicQuestion1, basicQuestion2, rushQuestion];

        questionInputs.forEach(input => {
            if (!input) return;

            input.addEventListener('input', function() {
                if (isWssUpdating) {
                    return;
                }

                clearTimeout(syncTimer);
                syncTimer = setTimeout(() => {
                    if (currentGroupStatus !== 'ONGOING') return;

                    const canEdit = isWebSocketMode || isChief;
                    if (!canEdit) return;

                    if (isWebSocketConnected) {
                        syncQuestionsViaWSS();
                    }
                }, 250);
            });
        });
    }

    // ===== 页面卸载前自动保存 =====
    window.addEventListener('beforeunload', function(e) {
        if (ws) {
            ws.close();
        }
        stopTimer();
        stopPolling();

        if (currentGroupStatus === 'ENDED' || currentGroupStatus === 'CANCELLED') return;
        if (currentGroupStatus === 'PENDING' || currentGroupStatus === 'PAUSE') return;

        const candidateId = currentCandidateId ? currentCandidateId.value : '';
        if (!candidateId) return;

        const payload = getCurrentFormData();

        const data = new FormData();
        data.append('payload', JSON.stringify(payload));
        data.append('csrfmiddlewaretoken', getCSRFToken());

        navigator.sendBeacon('/api/evaluation/', data);
    });

    // ===== 初始化 =====
    renderForm([]);
    loadGroupInfo();

    // ===== 事件绑定 =====
    if (evaluationForm) {
        evaluationForm.addEventListener('input', function(event) {
            if (!event.target.matches('.intro-item textarea, .eval-score-input, .eval-comment-input')) return;
            isDirty = true;
            updateSaveState('dirty', '有未保存修改');
        });
    }

    if (evaluationForm) {
        evaluationForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await saveEvaluation(true);
        });
    }

    if (clearScoreBtn) {
        clearScoreBtn.addEventListener('click', function() {
            if (confirm('确定将所有评分清零吗？（自我介绍、评语不受影响）')) {
                clearScores();
            }
        });
    }

    if (refreshCandidateBtn) {
        refreshCandidateBtn.addEventListener('click', async function() {
            if (!currentCandidateInGroupId) return;
            if (isDirty && !window.confirm('刷新会覆盖当前未保存的评价内容。是否继续？')) return;

            refreshCandidateBtn.disabled = true;
            refreshCandidateBtn.textContent = '正在刷新';
            try {
                await Promise.all([
                    loadCandidateInfo(currentCandidateInGroupId, currentOrder),
                    loadEvaluationToForm(currentCandidateInGroupId, currentOrder)
                ]);
                showMessage('当前候选人资料已更新', 'success');
            } finally {
                refreshCandidateBtn.disabled = false;
                refreshCandidateBtn.textContent = '刷新当前';
            }
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            if (currentGroupStatus === 'ONGOING') {
                await saveEvaluation(false, true);
            }
            if (ws) {
                ws.close();
            }
            stopTimer();
            stopPolling();
            window.location.href = this.getAttribute('href') || "/interviewer-panel/";
        });
    }

    if (statusControlBtn) {
        statusControlBtn.addEventListener('click', function() {
            if (controlModal) {
                const statusMap = {
                    'PENDING': '待开始',
                    'ONGOING': '进行中',
                    'PAUSE': '暂停中',
                    'ENDED': '已结束',
                    'CANCELLED': '已取消'
                };
                if (controlCurrentStatus) {
                    controlCurrentStatus.textContent = statusMap[currentGroupStatus] || currentGroupStatus;
                    controlCurrentStatus.className = 'control-status-badge ' + currentGroupStatus;
                }

                const hasControl = isWebSocketMode || isChief;
                const isActive = hasControl && currentGroupStatus !== 'ENDED' && currentGroupStatus !== 'CANCELLED';

                if (controlStartBtn) {
                    controlStartBtn.disabled = !isActive || (currentGroupStatus !== 'PENDING' && currentGroupStatus !== 'PAUSE');
                }
                if (controlPauseBtn) {
                    controlPauseBtn.disabled = !isActive || (currentGroupStatus !== 'ONGOING');
                }
                if (controlEndBtn) {
                    controlEndBtn.disabled = !isActive || (currentGroupStatus !== 'ONGOING' && currentGroupStatus !== 'PAUSE');
                }

                controlModal.style.display = 'flex';
            }
        });
    }

    if (controlModalClose) {
        controlModalClose.addEventListener('click', function() {
            controlModal.style.display = 'none';
        });
    }
    if (controlModal) {
        controlModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    }

    if (controlStartBtn) {
        controlStartBtn.addEventListener('click', function() {
            handleStatusAction('start');
        });
    }
    if (controlPauseBtn) {
        controlPauseBtn.addEventListener('click', function() {
            handleStatusAction('pause');
        });
    }
    if (controlEndBtn) {
        controlEndBtn.addEventListener('click', function() {
            handleStatusAction('end');
        });
    }

    // 页面加载完成后初始化懒加载
    lazyLoadImages();

    setInterval(function() {
        if (!isWebSocketConnected && ws && ws.readyState !== WebSocket.CONNECTING) {
            connectWebSocket();
        }
    }, 20000);

});
