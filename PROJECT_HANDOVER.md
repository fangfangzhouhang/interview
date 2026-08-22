# 面试系统项目交接文档

## 一、项目概述

### 1.1 项目简介
这是一个面向高校学生会招新场景的**在线面试评分系统**，支持多部门、多面试官协同工作。系统包含候选人管理、面试官评分、实时叫号看板、数据导出等核心功能。

### 1.2 技术栈
| 层级 | 技术 | 版本 |
|------|------|------|
| 后端框架 | Django | 4.2.30 |
| ASGI服务器 | Daphne | 4.2.3 |
| WebSocket | Django Channels | 4.3.2 |
| 数据库 | SQLite（开发）/ MySQL（生产） | - |
| 前端 | 原生HTML/CSS/JS | - |
| 包管理 | pip + venv | - |

### 1.3 项目结构
```
d:\网站设计\网站设计\
├── interview_system/          # Django项目配置
│   ├── settings.py           # 主配置文件
│   ├── asgi.py              # ASGI入口（支持WebSocket）
│   └── urls.py              # 根URL配置
├── interview/                # 核心应用
│   ├── models.py            # 数据模型定义
│   ├── views/               # 视图函数
│   ├── wss_api/             # WebSocket相关
│   ├── migrations/          # 数据库迁移
│   └── urls/                # URL配置
├── static/                   # 静态资源
│   ├── css/                 # 样式文件
│   └── js/                  # JavaScript
├── templates/                # HTML模板
├── deploy/                   # 部署脚本
└── manage.py                # Django管理入口
```

---

## 二、核心功能模块

### 2.1 用户角色与权限
| 角色 | 权限说明 |
|------|---------|
| **超级管理员** | 全部权限 |
| **管理员 (ADMIN)** | 管理所有部门数据、用户管理、数据导出 |
| **部门管理员 (SUBADMIN)** | 仅能管理本部门数据 |
| **面试官** | 查看本部门场次、进行评分 |
| **候选人** | 查看自己的排队状态 |

### 2.2 评分系统（核心改造）
#### 2.2.1 百分制评分维度（总分100分）
```python
# interview/models.py - SCORE_DIMENSIONS
SCORE_DIMENSIONS = [
    {'code': 'expression',   'name': '表达能力',   'max_score': 20},
    {'code': 'resume',      'name': '简历得分',   'max_score': 15},
    {'code': 'innovation',  'name': '创新能力',   'max_score': 20},
    {'code': 'responsibility', 'name': '责任心', 'max_score': 15},
    {'code': 'logic',       'name': '逻辑思维',   'max_score': 15},
    {'code': 'teamwork',    'name': '团队协作',   'max_score': 10},
    {'code': 'match',       'name': '部门匹配度', 'max_score': 5},
]
```

#### 2.2.2 数据模型
- **InterviewerScore** 模型
  - `score`: DecimalField, 总分0-100，由各维度自动计算
  - `dimension_scores`: JSONField，存储各维度得分 `{"expression": 20, "resume": 15, ...}`
  - `save()` 方法自动计算总分

#### 2.2.3 评分交互
- **选择式评分**：预设分值按钮
- **滑动式评分**：连续调整
- **实时总分计算**：修改任一分度立即更新总分

### 2.3 叫号看板
- 6个部门独立页面轮播（5秒自动切换）
- 部门导航栏支持手动切换
- 实时显示排队状态：等待中/面试中/已完成
- 管理员可通过密码保护的控制面板操作

### 2.4 实时协作（WebSocket）
- Django Channels实现
- 面试官可实时看到其他面试官的操作
- 支持状态同步（开始/暂停/结束面试）

---

## 三、关键文件索引

### 3.1 后端核心文件
| 文件路径 | 说明 |
|---------|------|
| `interview/models.py` | 数据模型 + SCORE_DIMENSIONS配置 |
| `interview/wss_api/workflow_services.py` | 评分保存/读取/业务逻辑 |
| `interview/wss_api/consumers.py` | WebSocket消费者 |
| `interview/views/workflow_views/main_sheet.py` | 面试官工作台视图 |
| `interview/views/admin_views/score_views.py` | 管理员评分查看API |
| `interview/views/subadmin_views/score_views.py` | 部门管理员评分查看API |
| `interview_system/asgi.py` | ASGI配置（关键！） |

### 3.2 前端核心文件
| 文件路径 | 说明 |
|---------|------|
| `static/js/workflow/main_sheet.js` | 面试官评分UI |
| `static/js/addmin/addmin_scores.js` | 管理员评分查看 |
| `static/js/subaddmin/subaddmin_scores.js` | 部门评分查看 |
| `static/css/interview.css` | 面试官页样式 |
| `static/css/admin.css` | 管理员页样式 |
| `static/css/subadmin.css` | 部门管理员页样式 |
| `templates/workflow/main_sheet.html` | 面试官工作台模板 |

### 3.3 数据库迁移
| 文件路径 | 说明 |
|---------|------|
| `interview/migrations/0009_add_dimension_scores_to_interviewerscore.py` | 添加维度得分字段 |

---

## 四、启动方式（重要）

### ⚠️ 必须使用 Daphne 启动（支持WebSocket）

```bash
# 进入项目目录
cd d:\网站设计\网站设计

# 使用虚拟环境的Daphne启动
.\venv\Scripts\python.exe -m daphne -p 8000 interview_system.asgi:application
```

### ❌ 不要使用 runserver（不支持WebSocket）
```bash
# 这个命令只能用于调试普通页面
# WebSocket功能会降级为离线模式
.\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

### 访问地址
- 主页: `http://127.0.0.1:8000/`
- 叫号看板: `http://127.0.0.1:8000/board/`
- 面试官工作台: `http://127.0.0.1:8000/interview/?group=9`
- 管理员后台: `http://127.0.0.1:8000/addmin/`
- 部门管理员: `http://127.0.0.1:8000/subaddmin/`

---

## 五、已修复的关键Bug

### Bug 1: 评分保存唯一约束冲突
- **现象**: 保存评分时提示 "UNIQUE constraint failed"
- **根因**: `get_or_create` 查询条件包含 `interview_group`，但唯一约束是 `(candidate, interviewer)`
- **修复**: 改用 `(candidate, interviewer)` 查询，动态更新 `interview_group` 字段
- **文件**: `interview/wss_api/workflow_services.py`

### Bug 2: 部门权限检查逻辑错误
- **现象**: 部门管理员无法查看本部门场次评价
- **根因**: 权限检查条件 `department == 'ALL'` 被错误地拒绝
- **修复**: 修正为 `department != 'ALL' and group.departments != department`
- **文件**: `interview/views/subadmin_views/score_views.py`

### Bug 3: 浏览器缓存旧JS
- **现象**: 页面功能不生效，代码已更新但浏览器显示旧效果
- **根因**: 浏览器缓存了旧版本JS文件
- **修复**: 在模板中添加版本号参数 `?v=2`
- **文件**: `templates/addmin/addmin_scores.html`, `templates/subaddmin/subaddmin_scores.html`

### Bug 4: WebSocket显示离线
- **现象**: 页面显示"WS离线模式"
- **根因**: 使用 `runserver`(WSGI) 启动，不支持WebSocket
- **修复**: 使用 `daphne`(ASGI) 启动
- **相关**: `interview_system/asgi.py`

---

## 六、待完成的改进方向

### 6.1 高优先级
1. **面试端评分UI优化**
   - 添加分值提示气泡
   - 滑块拖动时实时显示当前分值
   - 优化响应式布局

2. **数据导出增强**
   - 支持Excel/PDF格式导出
   - 导出时包含维度得分的可视化图表
   - 批量导出功能

3. **空状态优化**
   - 未评分场次添加"开始评分"引导
   - 评分完成后显示统计摘要

### 6.2 中优先级
4. **数据可视化**
   - 雷达图展示各维度得分
   - 分数分布直方图
   - 部门对比分析图表

5. **通知系统**
   - 候选人状态变更通知
   - 面试官评分提醒
   - 管理员预警（评分异常等）

6. **批量操作**
   - 批量设置评委
   - 批量调整场次状态
   - 批量导出报告

### 6.3 低优先级
7. **移动端适配**
   - 触屏优化
   - 移动端叫号看板
   - 响应式评分界面

8. **性能优化**
   - 数据库查询优化
   - 静态资源CDN
   - 页面加载速度优化

9. **安全加固**
   - CSRF防护
   - 输入验证
   - 日志审计

---

## 七、开发注意事项

### 7.1 修改代码前检查
1. 确认修改的是正确的文件
2. 检查是否有对应的数据迁移需要创建
3. 确认权限检查逻辑是否一致

### 7.2 新增功能时
1. 如果涉及模型修改：创建迁移文件 `python manage.py makemigrations`
2. 如果涉及前端缓存：记得更新模板中的版本号参数
3. 如果涉及权限：检查 decorators/permission_decorators.py

### 7.3 测试流程
1. 启动Daphne服务器
2. 打开浏览器测试页面功能
3. 检查控制台是否有错误
4. 验证API返回数据格式

---

## 八、关键配置项

### 8.1 Django Settings
- 配置文件: `interview_system/settings.py`
- DEBUG模式: 默认开启
- 允许主机: 127.0.0.1, localhost, 以及局域网IP

### 8.2 评分维度配置
修改 `interview/models.py` 中的 `SCORE_DIMENSIONS` 列表即可调整评分维度。
**注意**: 修改后需要考虑历史数据兼容性。

### 8.3 部门代码
```python
DEPARTMENT_CHOICES = [
    ('BGS', '办公室'),
    ('XCB', '宣传部'),
    ('QYB', '权益部'),
    ('XSB', '学术部'),
    ('WYB', '文艺部'),
    ('TYB', '体育部'),
]
```

---

## 九、快速参考命令

```bash
# 启动服务器（开发）
.\venv\Scripts\python.exe -m daphne -p 8000 interview_system.asgi:application

# 创建迁移
.\venv\Scripts\python.exe manage.py makemigrations

# 执行迁移
.\venv\Scripts\python.exe manage.py migrate

# Django系统检查
.\venv\Scripts\python.exe manage.py check

# 创建超级用户
.\venv\Scripts\python.exe manage.py createsuperuser

# 收集静态文件
.\venv\Scripts\python.exe manage.py collectstatic
```

---

## 十、联系与备注

- 项目完成时间: 2026年8月
- 最后更新: 2026年8月22日
- 文档维护者: 开发团队

---

**本文档用于项目交接，新开发者请先阅读此文档再开始工作。**
