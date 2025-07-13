document.addEventListener('DOMContentLoaded', () => {
    const supabaseUrl = 'https://lholzspyazziknxqopmi.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2x6c3B5YXp6aWtueHFvcG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMjc0MTAsImV4cCI6MjA1NzYwMzQxMH0.uku06OF-WapBhuV-A_rJBXu3x24CKKkSTM0SnmPIOOE';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    const userNameDisplay = document.getElementById('user-name-display');
    const widgetsContainer = document.getElementById('dashboard-widgets-container');
    const logoutBtn = document.getElementById('logout-btn');

    // تابع برای ساخت یک ویجت (کارت) در داشبورد
    function createWidget(title, icon, link) {
        const widget = document.createElement('a');
        widget.href = link;
        widget.className = 'widget-card';
        widget.innerHTML = `
            <i class="fas ${icon} widget-icon"></i>
            <h3 class="widget-title">${title}</h3>
        `;
        return widget;
    }

    // تابع برای رندر کردن داشبورد بر اساس نقش کاربر
    function renderDashboard(role) {
        widgetsContainer.innerHTML = ''; // پاک کردن حالت لودینگ

        // ویجت‌های مشترک
        widgetsContainer.appendChild(createWidget('مدیریت وظایف', 'fa-tasks', '/index.html'));
        widgetsContainer.appendChild(createWidget('پروفایل من', 'fa-user-circle', '#')); // لینک پروفایل را بعدا تکمیل می‌کنیم

        // ویجت‌های اختصاصی بر اساس نقش
        if (role === 'admin') {
            widgetsContainer.appendChild(createWidget('مدیریت کاربران', 'fa-users-cog', '#'));
            widgetsContainer.appendChild(createWidget('مدیریت درس‌ها', 'fa-book', '/subjects.html'));
            widgetsContainer.appendChild(createWidget('مدیریت آزمون‌ها', 'fa-file-signature', '/exams.html'));
        }

        if (role === 'teacher') {
            widgetsContainer.appendChild(createWidget('ثبت نمرات', 'fa-edit', '#'));
            widgetsContainer.appendChild(createWidget('گزارش کلاس', 'fa-chart-bar', '#'));
        }

        if (role === 'student') {
            widgetsContainer.appendChild(createWidget('کارنامه من', 'fa-graduation-cap', '#'));
        }
    }

    // بررسی وضعیت احراز هویت و دریافت اطلاعات کاربر
    async function checkAuthAndLoadDashboard() {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            window.location.href = '/login.html';
            return;
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('name, role')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('Error fetching profile:', profileError);
            userNameDisplay.textContent = 'خطا در بارگذاری پروفایل';
            return;
        }
        
        userNameDisplay.textContent = `خوش آمدید، ${profile.name || user.email}`;
        renderDashboard(profile.role);
    }

    // رویداد کلیک برای دکمه خروج
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/login.html';
    });

    // اجرای تابع اصلی
    checkAuthAndLoadDashboard();
});
