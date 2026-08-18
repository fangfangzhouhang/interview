=======================================

使用说明
* 文档区分大小写
* 请不要跳过步骤
* 部署中目录一致
* 开发模式下SSL自签名证书，
* 浏览器https连接可能显示不安全，
* 点击“高级”或“了解详情”，继续访问

=======================================

常规启动

---------------------------------------

1. 启动Redis
# 打开一个cmd窗口
# 假设已进入C:\目录
| C:\>cd Redis
| C:\Redis>redis-server.exe C:\Redis\redis.windows.conf

2. 启动Daphne
# 打开一个cmd窗口
# 假设已进入C:\目录
| C:\>cd test6
| C:\test6>venv\Scripts\activate.bat
| (venv)C:\test6>scripts\start_daphne.bat

3. 启动Nginx
# 打开一个cmd窗口
# 假设已进入C:\目录
| C:\>cd nginx
| C:\nginx>nginx.exe

4. 保持三个cmd窗口前台运行即可

=======================================

部署步骤

---------------------------------------

1.准备环境

1.1 显示隐藏文件夹
# Win+R打开设置，搜索“文件夹”
# 更改文件和文件夹的搜索选项-查看
# 显示隐藏的文件、文件夹和驱动器
# 应用，确认，关闭

1.2 卸载预装python
# 删除C:\Users\Administrator\AppData\Local\python文件夹

1.3 安装（重装）Python 3.9.7
# 安装包在support/python-3.9.7-amd64.exe
# 复制安装包到C:\Users\Administrator\Desktop\目录
# 形成C:\Users\Administrator\Desktop\python-3.9.7-amd64.exe
# 右键-以管理员身份运行，安装
* 勾选 Add PYTHON to PATH.

1.4 创建虚拟环境
# 假设已进入C:\目录
# 更改pip为清华源
| C:\>pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
# 进入C:\test6目录，创建虚拟环境
| C:\>cd test6
| C:\test6>virtualenv env

1.5 激活虚拟环境
| C:\test6>venv\Scripts\activate.bat

1.6 安装依赖
# 将support/requirement.txt复制到C:\test6\目录下
# 形成C:\test6\requirement.txt
| (venv)C:\test6>pip install -r requirements.txt

1.7 退出虚拟环境
| (venv)C:\test6>deactivate

---------------------------------------

2.部署nssm

2.1 安装nssm
# 将support/nssm复制到C:\目录下
# 形成C:\nssm\*

---------------------------------------

3.部署Nginx

3.1 禁用宝塔面板原生Nginx服务（以管理员身份运行）
# 假设已退出虚拟环境，已进入C:\目录
| C:\>C:\nssm\nssm.exe remove Nginx confirm
# 停止服务
| C:\>net stop Nginx 2>nul
# 强制删除服务
| C:\>sc delete Nginx 2>nul


3.2 重装Nginx
# 将support/nginx复制到C:\目录下
# 形成C:\nginx\*
# 修复文件目录
| C:\>C:\nginx\create_dirs.bat
# 手动创建目录
| C:\>mkdir C:\nginx\conf\sites-enabled
# 重装服务
| C:\>C:\nssm\nssm.exe install Nginx C:\nginx\nginx.exe
# 设置服务为开机自动启动
| C:\>C:\nssm\nssm.exe set Nginx Start SERVICE_AUTO_START

---------------------------------------

4.安装Redis

# 注意版本为8.8.0，至少应为5.0.0以上
# 将support/Redis复制到C:\目录下
# 形成C:\Redis\*
# 假设已进入C:\目录
# 启动Redis
| C:\>C:\Redis\redis-server.exe C:\Redis\redis.windows.conf
# 安装Redis
| C:\>cd Redis
| C:\>redis-server.exe --service-install redis.windows.conf --loglevel verbose

---------------------------------------

5.配置参数

# 编辑 deploy/config.py
# 设置正确的路径和参数，注意加入公网IP和域名

---------------------------------------

6.执行部署
# 将test6复制到C:\目录下
# 形成C:\test6\*
# 假设已进入C:\目录
| C:\>cd test6\deploy

6.1 生成自签名SSL（开发环境）
| C:\test6\deploy>python generate_ssl_cert.py
* 生产环境应该在C:\nginx\ssl正确部署SSL证书

6.2 一键部署
# 进入虚拟环境
| C:\test6\deploy>..\venv\Scripts\activate.bat
# 部署
| (venv)C:\test6\deploy>python deploy_all.py
# 也可以依次逐一部署
* (venv)C:\test6\deploy>python 01_setup_env.py
* (venv)C:\test6\deploy>python 02_setup_nginx.py
* (venv)C:\test6\deploy>python 03_setup_redis.py
* (venv)C:\test6\deploy>python 04_setup_daphne.py
* (venv)C:\test6\deploy>python 05_update_settings.py

6.3 收集静态文件
| (venv)C:\test6\deploy>python.exe manage.py collectstatic
* 是否覆盖，选择yes即可

6.4 退出虚拟环境
| (venv)C:\test6\deploy>deactivate

---------------------------------------

7.启动服务
# 假设已进入C:\目录
* 以下服务独立启动

7.1 启动Redis存储
| C:\>C:\Redis\redis-server.exe C:\Redis\redis.windows.conf
# 安装Redis
| C:\>cd Redis
| C:\Redis>redis-server.exe --service-install redis.windows.conf --loglevel verbose

7.2 通过Daphne启动后端
# 进入项目目录
| C:\Redis>cd ..\test6
# 进入虚拟环境
| C:\test6>venv\Scripts\activate.bat
# 启动Daphne
(venv)C:\test6>scripts\start_daphne.bat

7.3 启动Nginx双向代理
# 新启动一个cmd窗口
# 假设已进入C:\目录
| C:\>cd C:\nginx
| C:\nginx>nginx.exe

---------------------------------------

8 启动测试
# 打开Edge浏览器
# 测试https://127.0.0.1:443/login
# 页面显示成功即可

---------------------------------------

9 部署完成
# 保持Daphne窗口开启
# 保持nginx窗口开启
# 外网访问测试

=======================================

常用命令

---------------------------------------

1. Redis命令

# 查看版本
| redis-server.exe --version
# 启动
| redis-server.exe C:\Redis\redis.windows.conf
# 前台运行
| redis-server.exe C:\Redis\redis.windows.conf --loglevel verbose
# 安装
| redis-server.exe --service-install redis.windows.conf --loglevel verbose
# 卸载
| redis-server.exe --service-uninstall
# 停止
| redis-server.exe --service-stop
# 测试
| redis-cli.exe ping

---------------------------------------

2. Daphne命令
# 启动
| (venv)C:\test6>scripts\start_daphne.bat
# 退出
| Ctrl+C

---------------------------------------

3. Nginx命令
# 修复文件目录
| C:\>C:\nginx\create_dirs.bat
# 手动创建目录
| C:\>mkdir C:\nginx\conf\sites-enabled
# 重装服务
| C:\>C:\nssm\nssm.exe install Nginx C:\nginx\nginx.exe
# 设置服务为开机自动启动
| C:\>C:\nssm\nssm.exe set Nginx Start SERVICE_AUTO_START
# 强制中断
| C:\nginx>nginx.exe -s stop

=======================================


