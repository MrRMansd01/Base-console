document.addEventListener('DOMContentLoaded', () => {
    const supabaseUrl = 'https://lholzspyazziknxqopmi.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2x6c3B5YXp6aWtueHFvcG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMjc0MTAsImV4cCI6MjA1NzYwMzQxMH0.uku06OF-WapBhuV-A_rJBXu3x24CKKkSTM0SnmPIOOE';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    const userNameDisplay = document.getElementById('user-name-display');
    const widgetsContainer = document.getElementById('dashboard-widgets-container');
    const logoutBtn = document.getElementById('logout-btn');

    function createWidget(title, icon, link) {
        const widget = document.createElement('a');
        widget.href = link;
        widget.className = 'widget-card';
        widget.innerHTML = `<i class="fas ${icon} widget-icon"></i><h3 class="widget-title">${title}</h3>`;
        return widget;
    }


    function renderDashboard(role) {
        widgetsContainer.innerHTML = ''; 

        const widgets = new Map();
        const addWidget = (key, title, icon, link) => {
            if (!widgets.has(key)) {
                widgets.set(key, createWidget(title, icon, link));
            }
        };

        // --- افزودن ویجت‌ها بر اساس سطح دسترسی ---
        addWidget('tasks', 'مدیریت وظایف', 'fa-tasks', '/index.html');
        addWidget('profile', 'پروفایل من', 'fa-user-circle', '/profile.html');

        // ویجت‌های دانش‌آموز
        if (role === 'student') {
            // This line is updated
            addWidget('report_card', 'کارنامه من', 'fa-graduation-cap', '/report-card.html');
        }

        // ویجت‌های مشترک بین مدیر، معلم و مشاور
        if (['admin', 'teacher', 'consultant'].includes(role)) {
            addWidget('class_report', 'گزارش کلاس', 'fa-chart-bar', '/reports.html');
            addWidget('enter_scores', 'ثبت نمرات', 'fa-edit', '/scores.html');
        }
        
        // ویجت‌های مشترک بین مدیر و مشاور
        if (['admin', 'consultant'].includes(role)) {
            addWidget('manage_subjects', 'مدیریت درس‌ها', 'fa-book', '/subjects.html');
            addWidget('manage_exams', 'مدیریت آزمون‌ها', 'fa-file-signature', '/exams.html');
        }

        // ویجت‌های اختصاصی مدیر
        if (role === 'admin') {
            addWidget('manage_users', 'مدیریت کاربران', 'fa-users-cog', '/users.html');
        }

        widgets.forEach(widget => {
            widgetsContainer.appendChild(widget);
        });
    }


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

    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/login.html';
    });

    checkAuthAndLoadDashboard();
});
