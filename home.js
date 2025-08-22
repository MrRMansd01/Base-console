document.addEventListener('DOMContentLoaded', () => {
    const supabaseUrl = 'https://lholzspyazziknxqopmi.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2x6c3B5YXp6aWtueHFvcG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMjc0MTAsImV4cCI6MjA1NzYwMzQxMH0.uku06OF-WapBhuV-A_rJBXu3x24CKKkSTM0SnmPIOOE';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    const userNameDisplay = document.getElementById('user-name-display');
    const widgetsContainer = document.getElementById('dashboard-widgets-container');
    const logoutBtn = document.getElementById('logout-btn');
    const subscriptionDisplay = document.getElementById('subscription-display');

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
            if (!widgets.has(key)) widgets.set(key, createWidget(title, icon, link));
        };

        addWidget('tasks', 'مدیریت وظایف', 'fa-tasks', '/index.html');
        addWidget('profile', 'پروفایل من', 'fa-user-circle', '/profile.html');

        if (role === 'student') {
            addWidget('report_card', 'کارنامه من', 'fa-graduation-cap', '/report-card.html');
        }
        if (['admin', 'teacher', 'consultant'].includes(role)) {
            addWidget('class_report', 'گزارش کلاس', 'fa-chart-bar', '/reports.html');
            addWidget('enter_scores', 'ثبت نمرات', 'fa-edit', '/scores.html');
        }
        if (['admin', 'consultant'].includes(role)) {
            addWidget('manage_subjects', 'مدیریت درس‌ها', 'fa-book', '/subjects.html');
            addWidget('manage_exams', 'مدیریت آزمون‌ها', 'fa-file-signature', '/exams.html');
        }
        if (role === 'admin') {
             // Admin doesn't manage users directly anymore in this model
        }
        if (role === 'super_admin') {
            addWidget('manage_users', 'مدیریت کاربران', 'fa-users-cog', '/users.html');
            // Add subscription management widgets here later
        }

        widgets.forEach(widget => widgetsContainer.appendChild(widget));
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
        
        // If user is an admin, fetch subscription info
        if (profile.role === 'admin') {
            const { data: subscription, error: subError } = await supabase
                .from('subscriptions')
                .select('end_date')
                .eq('user_id', user.id)
                .single();
            
            if (subscription && subscription.end_date) {
                const endDate = new Date(subscription.end_date);
                const today = new Date();
                const diffTime = endDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays > 0) {
                    subscriptionDisplay.textContent = `${diffDays} روز از اشتراک شما باقی مانده است`;
                } else {
                    subscriptionDisplay.textContent = 'اشتراک شما منقضی شده است';
                    subscriptionDisplay.style.backgroundColor = '#ffcdd2';
                    subscriptionDisplay.style.color = '#c62828';
                }
                subscriptionDisplay.style.display = 'inline-block';
            }
        }

        renderDashboard(profile.role);
    }

    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/login.html';
    });

    checkAuthAndLoadDashboard();
});