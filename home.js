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

        // --- ویجت‌های مشترک برای همه ---
        addWidget('profile', 'پروفایل من', 'fa-user-circle', '/profile.html');

        // --- ویجت‌های دانش‌آموز ---
        if (role === 'student') {
            addWidget('tasks', 'مدیریت وظایف', 'fa-tasks', '/index.html');
            addWidget('report_card', 'کارنامه من', 'fa-graduation-cap', '/report-card.html');
        }
        
        // --- ویجت‌های معلم و مشاور ---
        if (['teacher', 'consultant'].includes(role)) {
            addWidget('tasks', 'مدیریت وظایف', 'fa-tasks', '/index.html');
            addWidget('class_report', 'گزارش کلاس', 'fa-chart-bar', '/reports.html');
            addWidget('enter_scores', 'ثبت نمرات', 'fa-edit', '/scores.html');
        }

        // --- ویجت‌های مدیر و مشاور ---
        if (['admin', 'consultant'].includes(role)) {
            addWidget('manage_subjects', 'مدیریت درس‌ها', 'fa-book', '/subjects.html');
            addWidget('manage_exams', 'مدیریت آزمون‌ها', 'fa-file-signature', '/exams.html');
        }
        
        // --- ویجت‌های اختصاصی مدیر مدرسه ---
        if (role === 'admin') {
            addWidget('manage_school_users', 'مدیریت کاربران مدرسه', 'fa-users', '/index.html');
        }
        
        // --- ویجت‌های اختصاصی فقط برای ادمین کل ---
        if (role === 'super_admin') {
            addWidget('manage_schools', 'مدیریت مدارس', 'fa-school', '/schools.html');
            addWidget('manage_users', 'مدیریت کاربران', 'fa-users-cog', '/users.html');
            addWidget('manage_subscriptions', 'مدیریت اشتراک‌ها', 'fa-credit-card', '/subscriptions.html');
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
            .select('*') // Get all columns to check manager_id
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('Error fetching profile:', profileError);
            userNameDisplay.textContent = 'خطا در بارگذاری پروفایل';
            return;
        }
        userNameDisplay.textContent = `خوش آمدید، ${profile.name || user.email}`;
        
        // --- Subscription Check Logic ---
        let subscriptionExpired = false;
        let managerIdToCheck = null;

        if (profile.role === 'admin') {
            managerIdToCheck = profile.id;
        } else if (profile.manager_id) { // If user is a student/teacher managed by an admin
            managerIdToCheck = profile.manager_id;
        }

        if (managerIdToCheck) {
            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('end_date')
                .eq('user_id', managerIdToCheck)
                .single();

            if (subscription && subscription.end_date) {
                const endDate = new Date(subscription.end_date);
                const today = new Date();
                endDate.setHours(23, 59, 59, 999);
                today.setHours(0, 0, 0, 0);

                const diffTime = endDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 1) {
                    subscriptionExpired = true;
                }

                if (profile.role === 'admin') {
                    if (!subscriptionExpired) {
                        subscriptionDisplay.textContent = `${diffDays} روز از اشتراک شما باقی مانده است`;
                    } else {
                        subscriptionDisplay.textContent = 'اشتراک شما منقضی شده است';
                        subscriptionDisplay.style.backgroundColor = '#ffcdd2';
                        subscriptionDisplay.style.color = '#c62828';
                    }
                    subscriptionDisplay.style.display = 'inline-block';
                }
            } else {
                subscriptionExpired = true;
                if (profile.role === 'admin') {
                   subscriptionDisplay.textContent = 'اشتراک فعال نشده است';
                   subscriptionDisplay.style.display = 'inline-block';
                }
            }
        }

        if (subscriptionExpired) {
            widgetsContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #f44336; margin-bottom: 1rem;"></i>
                    <h2 style="color: #d32f2f;">دسترسی غیرفعال است</h2>
                    <p style="color: #333;">اشتراک مدرسه شما منقضی شده یا فعال نشده است. لطفا با پشتیبانی تماس بگیرید.</p>
                </div>
            `;
            return; 
        }

        renderDashboard(profile.role);
    }

    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/login.html';
    });

    checkAuthAndLoadDashboard();
});
