document.addEventListener('DOMContentLoaded', function() {
    // 侧边栏切换
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            this.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
        });
    }

    // DOM 元素
    const tbody = document.getElementById('tableBody');
    const searchInput = document.getElementById('searchInput');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const currentPageSpan = document.getElementById('currentPage');
    const totalPagesSpan = document.getElementById('totalPages');
    const pageStartSpan = document.getElementById('pageStart');
    const pageEndSpan = document.getElementById('pageEnd');
    const pageTotalSpan = document.getElementById('pageTotal');
    const totalCountSpan = document.getElementById('totalCount');

    let currentPage = 1;
    let totalPages = 1;
    let searchTimer = null;
    let isLoading = false;

    // 加载数据
    async function loadGroups(page = 1, search = '') {
        if (isLoading) return;
        isLoading = true;

        try {
            const params = new URLSearchParams({
                page: page,
                search: search
            });
            const response = await fetch(`/api/interviewer/groups/?${params}`);
            const result = await response.json();

            if (result.success) {
                renderTable(result.data);
                renderPagination(result.pagination);
                currentPage = result.pagination.current_page;
                totalPages = result.pagination.total_pages;
                totalCountSpan.textContent = result.pagination.total_count;
            } else {
                tbody.innerHTML = `<tr><td colspan="4" class="loading-text">${result.message || '加载失败'}</td></tr>`;
            }
        } catch (error) {
            console.error('加载失败:', error);
            tbody.innerHTML = `<tr><td colspan="4" class="loading-text">加载失败，请刷新</td></tr>`;
        } finally {
            isLoading = false;
        }
    }

    // 渲染表格
    function renderTable(data) {
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="loading-text">暂无面试场次</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(item => `
            <tr class="clickable-row" data-group-id="${item.group_id}">
                <td>${item.index}</td>
                <td>${item.candidates}</td>
                <td><span class="status-tag status-${item.status_code.toLowerCase()}">${item.status}</span></td>
                <td>${item.interview_date}</td>
            </tr>
        `).join('');

        // 点击行进入场次详情
        document.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', function() {
                const groupId = this.dataset.groupId;
                window.location.href = `/interview/?group=${groupId}`;
            });
        });
    }

    // 渲染分页
    function renderPagination(pagination) {
        const { current_page, total_pages, total_count, page_size, start, end } = pagination;

        currentPageSpan.textContent = current_page;
        totalPagesSpan.textContent = total_pages;
        pageStartSpan.textContent = start;
        pageEndSpan.textContent = end;
        pageTotalSpan.textContent = total_count;
        totalCountSpan.textContent = total_count;

        prevPageBtn.disabled = current_page <= 1;
        nextPageBtn.disabled = current_page >= total_pages;
    }

    // 搜索（防抖）
    function handleSearch() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            const search = searchInput.value.trim();
            loadGroups(1, search);
        }, 500);
    }

    // 翻页
    function goToPage(page) {
        if (page < 1 || page > totalPages || page === currentPage) return;
        const search = searchInput.value.trim();
        loadGroups(page, search);
    }

    // 事件绑定
    searchInput.addEventListener('input', handleSearch);

    prevPageBtn.addEventListener('click', function() {
        goToPage(currentPage - 1);
    });

    nextPageBtn.addEventListener('click', function() {
        goToPage(currentPage + 1);
    });

    // 键盘快捷键：回车触发搜索
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            clearTimeout(searchTimer);
            const search = searchInput.value.trim();
            loadGroups(1, search);
        }
    });

    // 初始加载
    loadGroups(1);
});