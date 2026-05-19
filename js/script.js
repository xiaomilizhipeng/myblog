// script.js - 小鹏的博客交互逻辑

document.addEventListener('DOMContentLoaded', function() {
    // 隐藏加载动画
    setTimeout(() => {
        const loader = document.getElementById('loader');
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }, 800);

    // 导航链接切换
    const navLinks = document.querySelectorAll('[data-page]');
    const pages = document.querySelectorAll('.page');
    const menuToggle = document.getElementById('menuToggle');
    const navLinksContainer = document.getElementById('navLinks');

    // 页面切换函数
    function navigateTo(pageId) {
        // 隐藏所有页面
        pages.forEach(page => page.classList.remove('active'));

        // 显示目标页面
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            // 滚动到顶部
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // 更新导航链接状态
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('data-page') === pageId) {
                    link.classList.add('active');
                }
            });
        }
    }

    // 为所有导航链接添加点击事件
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.getAttribute('data-page');
            navigateTo(pageId);

            // 在移动设备上关闭菜单
            if (window.innerWidth <= 768) {
                navLinksContainer.classList.remove('active');
            }
        });
    });

    // 移动端菜单切换
    menuToggle.addEventListener('click', function() {
        navLinksContainer.classList.toggle('active');
    });

    // 联系表单处理
    const sendMessageBtn = document.getElementById('sendMessage');
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', function() {
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const message = document.getElementById('message').value;

            if (!name || !email || !message) {
                showNotification('请填写所有字段！', 'error');
                return;
            }

            // 模拟发送成功
            setTimeout(() => {
                showNotification('消息已发送！我会尽快回复您。');
                // 清空表单
                document.getElementById('name').value = '';
                document.getElementById('email').value = '';
                document.getElementById('message').value = '';
            }, 1000);
        });
    }

    // 显示通知
    function showNotification(text, type = 'success') {
        const notification = document.getElementById('notification');
        notification.textContent = text;
        notification.style.background = type === 'error' ? '#e63946' : '#4361ee';
        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // 平滑滚动（用于页脚链接）
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});
