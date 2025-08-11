document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    
    // --- Global Variables ---
    let selectedUserId = null;
    let selectedDateObject = new Date();
    let isAdmin = false;
    let currentUserRole = null;
    const ADMIN_ID = '23df94b7-412f-4321-a001-591c07fe622e';
    let supabase; 
    let selectedScore = 1; 
    let currentFilter = 'all'; 
    let editingTaskId = null; 
    let userTaskMap = new Map(); 
    
    // --- DOM Element References ---
    const taskModal = document.getElementById('taskModal');
    const addTaskBtn = document.getElementById('open-task-modal-btn');
    const submitTaskBtn = document.querySelector('.submit-task-btn');
    const taskTitleInput = document.getElementById('task-title');
    const taskDateInput = document.getElementById('task-date');
    const timeStartInput = document.getElementById('time-start');
    const timeEndInput = document.getElementById('time-end');
    const categoryButtons = document.querySelectorAll('.category-btn');
    const tasksContainer = document.querySelector('.tasks-container');
    const usersContainer = document.getElementById('users-container');
    const userNameElement = document.getElementById('username');
    const userSearchInput = document.querySelector('.search-box .search-input');
    const logoutBtn = document.getElementById('logout-btn');

    const excelUploadBtn = document.getElementById('excelUploadBtn');
    const excelFileInput = document.getElementById('excelFileInput');
    
    const clearCompletedBtn = document.querySelector('.clear-completed-btn');
    const statsCompletedElement = document.getElementById('stats-completed');
    const statsPendingElement = document.getElementById('stats-pending');
    const statsTotalTimeElement = document.getElementById('stats-total-time');
    const modalTitleElement = taskModal?.querySelector('h2');
    let flatpickrInstance = null;
    
    const editUserModal = document.getElementById('editUserModal');
    const saveEditUserBtn = document.getElementById('saveEditUserBtn');
    const cancelEditUserBtn = document.getElementById('cancelEditUserBtn');
    
    const viewProfileBtn = document.getElementById('view-profile-btn');
    const studentDetailsModal = document.getElementById('studentDetailsModal');
    const saveStudentDetailsBtn = document.getElementById('saveStudentDetailsBtn');
    const cancelStudentDetailsBtn = document.getElementById('cancelStudentDetailsBtn');
    const detailsUserIdInput = document.getElementById('details-user-id');
    
    // --- Feedback System DOM Elements ---
    const feedbackModal = document.getElementById('feedbackModal');
    const feedbackForm = document.getElementById('feedback-form');
    const feedbackTaskIdInput = document.getElementById('feedback-task-id');
    const feedbackTextarea = document.getElementById('feedback-textarea');
    const skipFeedbackBtn = document.getElementById('skipFeedbackBtn');
    
    const viewFeedbackModal = document.getElementById('viewFeedbackModal');
    const closeViewFeedbackBtn = document.getElementById('closeViewFeedbackBtn');
    const feedbackDisplayContent = document.getElementById('feedback-display-content');

    // --- Report Modal DOM Elements ---
    const generateReportBtn = document.getElementById('generate-report-btn');
    const reportModal = document.getElementById('reportModal');
    const reportForm = document.getElementById('report-form');
    const reportDaysInput = document.getElementById('report-days');
    const reportContent = document.getElementById('report-content');
    const aiSummaryContent = document.getElementById('ai-summary-content');
    const closeReportModalBtn = document.getElementById('closeReportModalBtn');

    // --- Report Modal Functions ---
    function openReportModal() {
        if (!selectedUserId) {
            alert('لطفا ابتدا یک دانش‌آموز را از لیست انتخاب کنید.');
            return;
        }
        reportContent.textContent = '';
        aiSummaryContent.innerHTML = '<p class="placeholder">برای مشاهده خلاصه، ابتدا گزارش را ایجاد کنید.</p>';
        reportModal.classList.add('is-open');
    }

    function closeReportModal() {
        reportModal.classList.remove('is-open');
    }

    async function handleReportGeneration(e) {
        e.preventDefault();
        const days = parseInt(reportDaysInput.value);
        if (!days || days < 1) {
            alert('لطفا تعداد روز معتبری را وارد کنید.');
            return;
        }

        const studentId = selectedUserId;
        if (!studentId) {
            alert('دانش‌آموز انتخاب نشده است.');
            return;
        }

        reportContent.textContent = 'در حال تولید گزارش...';
        aiSummaryContent.innerHTML = '<p class="placeholder">در حال دریافت خلاصه هوشمند...</p>';

        try {
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - days);

            const { data: tasks, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', studentId)
                .gte('created_at', fromDate.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (tasks.length === 0) {
                reportContent.textContent = 'هیچ تسکی در این بازه زمانی یافت نشد.';
                aiSummaryContent.innerHTML = '<p class="placeholder">داده‌ای برای خلاصه‌سازی وجود ندارد.</p>';
                return;
            }

            let reportText = `گزارش عملکرد ${days} روز گذشته:\n`;
            reportText += '================================\n\n';
            let completedTasks = 0;
            let pendingTasks = 0;

            tasks.forEach(task => {
                const status = task.is_completed ? '✅ تکمیل شده' : '⏳ در انتظار';
                if (task.is_completed) completedTasks++;
                else pendingTasks++;
                const taskDate = new Date(task.created_at).toLocaleDateString('fa-IR');
                reportText += `- ${task.title} (تاریخ: ${taskDate}) - وضعیت: ${status}\n`;
            });
            
            reportText += `\n--- آمار کلی ---\n`;
            reportText += `تعداد کل تسک‌ها: ${tasks.length}\n`;
            reportText += `تکمیل شده: ${completedTasks}\n`;
            reportText += `در انتظار: ${pendingTasks}\n`;

            reportContent.textContent = reportText;

            const prompt = `لطفا گزارش عملکرد زیر را که برای یک دانش‌آموز است، به زبان فارسی خلاصه کن. در خلاصه‌ی خود به نقاط قوت، ضعف‌های احتمالی و یک توصیه‌ی کلی اشاره کن:\n\n${reportText}`;
            
            let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiKey = "";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API call failed with status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content.parts[0].text) {
                const summary = result.candidates[0].content.parts[0].text;
                aiSummaryContent.textContent = summary;
            } else {
                throw new Error('No content in API response.');
            }

        } catch (error) {
            console.error('Error generating report:', error);
            reportContent.textContent = 'خطا در تولید گزارش.';
            aiSummaryContent.innerHTML = '<p class="placeholder" style="color: var(--danger-color);">خطا در دریافت خلاصه.</p>';
        }
    }
    
    // --- Feedback System Functions ---
    function showFeedbackSubmissionModal(taskId) {
        if (!feedbackModal) return;
        feedbackTaskIdInput.value = taskId;
        feedbackTextarea.value = '';
        feedbackModal.classList.add('is-open');
    }

    function hideFeedbackSubmissionModal() {
        if (feedbackModal) feedbackModal.classList.remove('is-open');
    }

    async function handleFeedbackSubmit(e) {
        e.preventDefault();
        const taskId = feedbackTaskIdInput.value;
        const feedback = feedbackTextarea.value.trim();
        const { data: { user } } = await supabase.auth.getUser();

        if (!taskId || !user) {
            alert('خطا: اطلاعات تسک یا کاربر یافت نشد.');
            return;
        }

        if (feedback) {
            try {
                const { error } = await supabase.from('task_feedback').insert([
                    { task_id: taskId, user_id: user.id, feedback: feedback }
                ]);
                if (error) throw error;
            } catch (error) {
                console.error('Error submitting feedback:', error);
                alert('خطا در ثبت بازخورد.');
            }
        }
        
        hideFeedbackSubmissionModal();
        await reloadCurrentUserTasks();
    }
    
    async function openViewFeedbackModal(taskId, taskTitle) {
        if (!viewFeedbackModal || !feedbackDisplayContent) return;

        viewFeedbackModal.querySelector('h2').textContent = `بازخورد برای: ${taskTitle}`;
        feedbackDisplayContent.innerHTML = '<p>در حال بارگذاری بازخورد...</p>';
        viewFeedbackModal.classList.add('is-open');

        try {
            const { data, error } = await supabase
                .from('task_feedback')
                .select('feedback, created_at')
                .eq('task_id', taskId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data && data.length > 0) {
                feedbackDisplayContent.textContent = data[0].feedback;
            } else {
                feedbackDisplayContent.innerHTML = '<p style="color: #888;">هیچ بازخوردی برای این تسک ثبت نشده است.</p>';
            }
        } catch (error) {
            console.error('Error fetching feedback:', error);
            feedbackDisplayContent.innerHTML = '<p style="color: #f44336;">خطا در دریافت بازخورد.</p>';
        }
    }

    function closeViewFeedbackModal() {
        if (viewFeedbackModal) viewFeedbackModal.classList.remove('is-open');
    }

    async function reloadCurrentUserTasks() {
        const { data: { user } } = await supabase.auth.getUser();
        const targetUserId = selectedUserId || user.id;
        const targetUserName = document.querySelector(`.user-item[data-user-id="${targetUserId}"] .user-name`)?.textContent || user.email;
        if (targetUserId) {
            await loadTasksForUser(targetUserId, targetUserName, isAdmin, currentFilter);
            await loadUsers(user, isAdmin);
        }
    }

    // --- Core Application Logic ---
    async function loadTasksForUser(userId, userName, isAdminFlag, filter = 'all') {
        if (!tasksContainer) return;
        try {
            const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
            if (!currentUser || authError) return;

            if (!isAdminFlag && userId !== currentUser.id) {
                 tasksContainer.innerHTML = '<div class="error-message" style="text-align: center; padding: 2rem; font-size: 1.2rem; color: #f44336;">دسترسی محدود است</div>';
                 updateStatsDisplay(0, 0, '0:00');
                 return;
            }
        
            let query = supabase.from('tasks').select('*').eq('user_id', userId);
            if (filter === 'completed') query = query.eq('is_completed', true);
            if (filter === 'incomplete') query = query.eq('is_completed', false);
            query = query.order('created_at', { ascending: false });
            
            const { data: tasks, error } = await query;
            if (error) throw error;
                
            const { data: statsTasks, error: statsError } = await supabase
                .from('tasks')
                .select('is_completed, time_start, time_end')
                .eq('user_id', userId);
            if (statsError) throw statsError;

            tasksContainer.innerHTML = '';
            
            let completedCount = 0, pendingCount = 0, totalMinutesStudied = 0;
            (statsTasks || []).forEach(task => {
                if (task.is_completed) {
                    completedCount++;
                    if (task.time_start && task.time_end) {
                        const start = new Date(`1970-01-01T${task.time_start}`);
                        const end = new Date(`1970-01-01T${task.time_end}`);
                        if (!isNaN(start) && !isNaN(end) && end > start) {
                            totalMinutesStudied += (end - start) / (1000 * 60);
                        }
                    }
                } else {
                    pendingCount++;
                }
            });

            const hoursStudied = Math.floor(totalMinutesStudied / 60);
            const minutesStudied = Math.round(totalMinutesStudied % 60);
            const formattedTotalTime = `${hoursStudied}:${minutesStudied.toString().padStart(2, '0')}`;

            if (!tasks || tasks.length === 0) {
                tasksContainer.innerHTML = '<p class="no-tasks" style="text-align: center; padding: 2rem; color: #777;">هیچ تسکی برای نمایش وجود ندارد.</p>';
            } else {
                tasks.forEach(task => {
                    tasksContainer.appendChild(createTaskElement(task, isAdminFlag, currentUser));
                });
            }
            updateStatsDisplay(completedCount, pendingCount, formattedTotalTime);

            document.querySelectorAll('.user-item').forEach(item => item.classList.remove('selected'));
            const selectedUserElement = usersContainer.querySelector(`.user-item[data-user-id="${userId}"]`);
            if (selectedUserElement) selectedUserElement.classList.add('selected');
                
        } catch (error) {
            console.error('[loadTasksForUser] Unexpected error:', error);
            tasksContainer.innerHTML = '<div class="error-message">خطا در بارگذاری تسک‌ها</div>';
            updateStatsDisplay(0, 0, '0:00');
        }
    }
    
    function updateStatsDisplay(completed, pending, totalTime) {
        if (statsCompletedElement) statsCompletedElement.textContent = completed;
        if (statsPendingElement) statsPendingElement.textContent = pending;
        if (statsTotalTimeElement) statsTotalTimeElement.textContent = totalTime;
    }

    async function updateTaskStatus(taskId, isCompleted) {
        try {
            const { error } = await supabase.from('tasks').update({ 
                is_completed: isCompleted,
                updated_at: new Date().toISOString() 
            }).eq('id', taskId);
            if (error) throw error;
            
            if (isCompleted) {
                showFeedbackSubmissionModal(taskId);
            } else {
                await reloadCurrentUserTasks();
            }
        } catch (error) {
            console.error('Error updating task status:', error);
            alert('خطا در به‌روزرسانی وضعیت تسک');
        }
    }
    
    function createTaskElement(task, isAdminFlag, currentUser) {
        const taskElement = document.createElement('div');
        taskElement.className = `task-item score${task.color || '1'}`;
        taskElement.dataset.id = task.id;
        const canModify = isAdminFlag || task.user_id === currentUser.id;

        const formatTime = (timeStr) => {
            if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr.substring(0, 5))) return '';
            const [hours, minutes] = timeStr.split(':');
            return `${hours}:${minutes}`;
        };

        const startTime = formatTime(task.time_start);
        const endTime = formatTime(task.time_end);
        const taskDate = task.date ? new Date(task.date).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
                
        taskElement.innerHTML = `
            <div class="task-checkbox">
                <input type="checkbox" class="task-complete-checkbox" 
                    ${task.is_completed ? 'checked' : ''} 
                    ${canModify ? '' : 'disabled'}> 
            </div>
            <div class="task-content">
                <span class="task-title" style="cursor: pointer;" title="مشاهده بازخورد">${task.title}</span>
                <div class="task-info">
                    ${taskDate ? `<span><i class="fas fa-calendar"></i> ${taskDate}</span>` : ''}
                    ${startTime ? `<span><i class="fas fa-clock"></i> ${startTime}</span>` : ''}
                    ${endTime ? `<span><i class="fas fa-stopwatch"></i> ${endTime}</span>` : ''}
                </div>
            </div>
            <div class="task-actions">
                ${canModify ? `
                    <button class="task-btn edit-btn" title="ویرایش"><i class="fas fa-edit"></i></button>
                    <button class="task-btn delete-btn" title="حذف"><i class="fas fa-trash"></i></button>
                ` : ''} 
            </div>
        `;

        const taskTitleElement = taskElement.querySelector('.task-title');
        taskTitleElement.addEventListener('click', () => {
            if (task.is_completed) {
                openViewFeedbackModal(task.id, task.title);
            } else {
                alert('برای مشاهده بازخورد، ابتدا باید تسک را تکمیل کنید.');
            }
        });
            
        if (canModify) {
            taskElement.querySelector('.task-complete-checkbox').addEventListener('change', (e) => {
                updateTaskStatus(task.id, e.target.checked);
            });
            taskElement.querySelector('.delete-btn')?.addEventListener('click', () => {
                if (confirm('آیا مطمئن هستید که می‌خواهید این تسک را حذف کنید؟')) {
                    deleteTask(task.id);
                }
            });
            taskElement.querySelector('.edit-btn')?.addEventListener('click', () => showTaskModal(task));
        }
            
        return taskElement;
    }

    async function loadUsers(currentUser, isAdminFlag) {
        if (!usersContainer) return;
        try {
            const { data: users, error: usersError } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
            if (usersError) throw usersError;
                
            const { data: allTasks, error: tasksError } = await supabase.from('tasks').select('user_id');
            if (tasksError) console.error('Error fetching tasks for count:', tasksError);
            
            userTaskMap.clear();
            const taskCounts = {};
            if (allTasks) {
                allTasks.forEach(task => {
                    taskCounts[task.user_id] = (taskCounts[task.user_id] || 0) + 1;
                });
            }
            users.forEach(user => userTaskMap.set(user.id, { ...user, taskCount: taskCounts[user.id] || 0 }));
            
            const usersToDisplay = isAdminFlag ? users : users.filter(u => u.id === currentUser.id);
            
            usersContainer.innerHTML = '';
            usersToDisplay.forEach(userProfile => {
                const userElement = document.createElement('li');
                userElement.className = 'user-item';
                userElement.dataset.userId = userProfile.id;
                if (userProfile.id === selectedUserId) userElement.classList.add('selected');
                if (userProfile.id === currentUser?.id) userElement.classList.add('current-user');

                const userData = userTaskMap.get(userProfile.id);
                const taskCount = userData ? userData.taskCount : 0;

                userElement.innerHTML = `
                    <span class="user-name">${userProfile.name || userProfile.username || userProfile.email}</span>
                    <span class="task-count">${taskCount} تسک</span>
                    <div class="user-actions">
                        <button class="user-action-btn dots-btn" title="گزینه‌ها"><i class="fas fa-ellipsis-v"></i></button>
                        <div class="user-actions-menu">
                            <button class="menu-item edit-user-btn">ویرایش</button>
                            <button class="menu-item delete-user-btn">حذف</button>
                        </div>
                    </div>
                `;
                
                userElement.addEventListener('click', (e) => {
                    if (e.target.closest('.user-actions')) return;
                    if (selectedUserId === userProfile.id) return;
                    selectedUserId = userProfile.id;
                    const selectedUserRole = userTaskMap.get(userProfile.id)?.role;
                    viewProfileBtn.style.display = (currentUserRole !== 'student' && selectedUserRole === 'student') ? 'inline-block' : 'none';
                    loadTasksForUser(userProfile.id, userProfile.name, isAdminFlag, currentFilter);
                });

                userElement.querySelector('.dots-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const menu = userElement.querySelector('.user-actions-menu');
                    document.querySelectorAll('.user-actions-menu.visible').forEach(m => {
                        if (m !== menu) m.classList.remove('visible');
                    });
                    menu.classList.toggle('visible');
                });
                userElement.querySelector('.edit-user-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditUserModal(userProfile.id);
                });
                userElement.querySelector('.delete-user-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteUserProfile(userProfile.id, userProfile.name);
                });
                
                usersContainer.appendChild(userElement);
            });

            if (!selectedUserId && currentUser) {
                const currentUserElement = usersContainer.querySelector(`.user-item[data-user-id="${currentUser.id}"]`);
                if (currentUserElement) currentUserElement.click();
            }
        } catch (error) {
            console.error('Error in loadUsers:', error);
            usersContainer.innerHTML = '<li class="error-message">خطا در بارگذاری کاربران</li>';
        }
    }
    
    // --- Utility and Modal Functions ---
    function showTaskModal(taskToEdit = null) { 
        editingTaskId = taskToEdit ? taskToEdit.id : null;
        if (editingTaskId) {
            modalTitleElement.textContent = 'ویرایش تسک';
            taskTitleInput.value = taskToEdit.title;
            timeStartInput.value = taskToEdit.time_start || '';
            timeEndInput.value = taskToEdit.time_end || '';
            selectedDateObject = taskToEdit.date ? new Date(taskToEdit.date) : new Date();
            flatpickrInstance.setDate(selectedDateObject, true);
            selectedScore = parseInt(taskToEdit.color || '1');
            categoryButtons.forEach(btn => {
                btn.classList.remove('active');
                if (parseInt(btn.dataset.score) === selectedScore) btn.classList.add('active');
            });
            submitTaskBtn.textContent = 'ذخیره تغییرات';
        } else {
            resetTaskForm();
        }
        taskModal.classList.add('is-open');
    }
    function hideTaskModal() { taskModal.classList.remove('is-open'); }
    function resetTaskForm() {
        editingTaskId = null;
        modalTitleElement.textContent = 'تسک جدید';
        submitTaskBtn.textContent = 'افزودن تسک';
        taskTitleInput.value = '';
        timeStartInput.value = '';
        timeEndInput.value = '';
        selectedDateObject = new Date();
        flatpickrInstance.setDate(selectedDateObject, true);
        categoryButtons.forEach(btn => btn.classList.remove('active'));
        categoryButtons[0].classList.add('active');
        selectedScore = 1;
    }
    async function deleteTask(taskId) { 
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (error) {
            alert('خطا در حذف تسک');
        } else {
            reloadCurrentUserTasks();
        }
    }
    function formatDateToYYYYMMDD(date) {
        if (!(date instanceof Date) || isNaN(date.getTime())) return null;
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    async function clearCompletedTasks() {
        const { data: { user } } = await supabase.auth.getUser();
        const targetUserId = selectedUserId || user.id;
        if (!confirm('آیا مطمئن هستید که می‌خواهید تمام تسک‌های تکمیل شده این کاربر را حذف کنید؟')) return;
        const { error } = await supabase.from('tasks').delete().eq('user_id', targetUserId).eq('is_completed', true);
        if (error) alert('خطا در حذف تسک‌های تکمیل شده.');
        else reloadCurrentUserTasks();
    }
    function searchUsers(searchTerm) {
        searchTerm = searchTerm.toLowerCase();
        document.querySelectorAll('#users-container .user-item').forEach(userEl => {
            const userName = userEl.querySelector('.user-name')?.textContent.toLowerCase();
            userEl.style.display = (userName && userName.includes(searchTerm)) ? 'flex' : 'none';
        });
    }
    function openEditUserModal(userId) {
        const editUserRoleGroup = document.getElementById('edit-user-role-group');
        const editUserRoleSelect = document.getElementById('edit-user-role');
        const editUserIdInput = document.getElementById('edit-user-id');
        const editUserNameInput = document.getElementById('edit-user-name');

        if (isAdmin) {
            editUserRoleGroup.style.display = 'block';
        } else {
            editUserRoleGroup.style.display = 'none';
        }

        const userData = userTaskMap.get(userId);
        if(userData) {
            editUserIdInput.value = userId;
            editUserNameInput.value = userData.name || '';
            if (isAdmin) {
                editUserRoleSelect.value = userData.role || 'student';
            }
            editUserModal.classList.add('is-open');
        }
    }
    function hideEditUserModal() { 
        editUserModal.classList.remove('is-open');
    }
    async function deleteUserProfile(userIdToDelete, userName) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (userIdToDelete === currentUser?.id) {
            alert('شما نمی‌توانید حساب کاربری خودتان را حذف کنید.');
            return;
        }
        if (userIdToDelete === ADMIN_ID) {
            alert('امکان حذف کاربر ادمین وجود ندارد.');
            return;
        }
        if (!confirm(`آیا مطمئن هستید که می‌خواهید کاربر "${userName}" و تمام تسک‌هایش را حذف کنید؟`)) return;

        try {
            const { error } = await supabase.rpc('delete_user_and_data', { user_id_to_delete: userIdToDelete });
            if (error) throw error;
            
            if (selectedUserId === userIdToDelete) selectedUserId = currentUser.id;
            await loadUsers(currentUser, isAdmin);

        } catch (error) {
            console.error('Error deleting user:', error);
            alert('خطا در حذف کاربر. (ممکن است تابع delete_user_and_data در پایگاه داده وجود نداشته باشد)');
        }
    }
    async function openStudentDetailsModal() {
        if (!selectedUserId) return;
        const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', selectedUserId).single();
        if (error) {
            alert('خطا در دریافت اطلاعات پروفایل.');
            return;
        }
        document.getElementById('details-fullname').value = profile.full_name || '';
        document.getElementById('details-father-name').value = profile.father_name || '';
        document.getElementById('details-mother-name').value = profile.mother_name || '';
        document.getElementById('details-father-phone').value = profile.father_phone || '';
        document.getElementById('details-mother-phone').value = profile.mother_phone || '';
        document.getElementById('details-home-phone').value = profile.home_phone || '';
        document.getElementById('details-description').value = profile.description || '';
        detailsUserIdInput.value = profile.id;

        const isEditable = currentUserRole === 'admin';
        saveStudentDetailsBtn.style.display = isEditable ? 'inline-block' : 'none';
        studentDetailsModal.querySelectorAll('input, textarea').forEach(input => input.readOnly = !isEditable);
        
        studentDetailsModal.classList.add('is-open');
    }
    function closeStudentDetailsModal() { 
        studentDetailsModal.classList.remove('is-open');
    }
    async function saveStudentDetails() {
        const userId = detailsUserIdInput.value;
        if (!userId) return;
        const updates = {
            full_name: document.getElementById('details-fullname').value,
            father_name: document.getElementById('details-father-name').value,
            mother_name: document.getElementById('details-mother-name').value,
            father_phone: document.getElementById('details-father-phone').value,
            mother_phone: document.getElementById('details-mother-phone').value,
            home_phone: document.getElementById('details-home-phone').value,
            description: document.getElementById('details-description').value,
            updated_at: new Date().toISOString()
        };
        const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
        if (error) {
            alert('خطا در ذخیره تغییرات.');
        } else {
            alert('تغییرات با موفقیت ذخیره شد.');
            closeStudentDetailsModal();
        }
    }
    async function saveUserEdit() {
        const userId = document.getElementById('edit-user-id').value;
        const newName = document.getElementById('edit-user-name').value;
        const newUserRole = document.getElementById('edit-user-role').value;
        if (!userId || !newName) return alert('لطفا نام کاربر را وارد کنید.');
        const updates = { name: newName.trim() };
        if (isAdmin) updates.role = newUserRole;
        const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
        if (error) {
            alert('خطا در بروزرسانی کاربر.');
        } else {
            hideEditUserModal();
            const { data: { user } } = await supabase.auth.getUser();
            await loadUsers(user, isAdmin);
        }
    }

    // --- App Initialization ---
    async function initializeApp() {
        try {
            if (!window.supabase) throw new Error('Supabase client not loaded');
            
            supabase = window.supabase;

            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                window.location.href = '/login.html';
                return;
            }
            
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (userNameElement) userNameElement.textContent = profile?.name || user.email;
            isAdmin = user.id === ADMIN_ID;
            currentUserRole = profile.role;
            
            await loadUsers(user, isAdmin);
            
            flatpickrInstance = flatpickr(document.querySelector('.flatpickr-wrapper'), {
                locale: "fa",
                dateFormat: "Y-m-d",
                altInput: true,
                altFormat: "l ، j F Y",
                wrap: true,
                defaultDate: new Date(),
                onChange: (selectedDates) => {
                    if (selectedDates.length > 0) selectedDateObject = selectedDates[0];
                },
            });

            // --- Event Listeners Setup ---
            addTaskBtn?.addEventListener('click', () => showTaskModal());
            feedbackForm?.addEventListener('submit', handleFeedbackSubmit);
            skipFeedbackBtn?.addEventListener('click', async () => {
                hideFeedbackSubmissionModal();
                await reloadCurrentUserTasks();
            });
            closeViewFeedbackBtn?.addEventListener('click', closeViewFeedbackModal);
            
            generateReportBtn.addEventListener('click', openReportModal);
            closeReportModalBtn.addEventListener('click', closeReportModal);
            reportForm.addEventListener('submit', handleReportGeneration);

            window.addEventListener('click', (e) => {
                if (e.target == feedbackModal) hideFeedbackSubmissionModal();
                if (e.target == viewFeedbackModal) closeViewFeedbackModal();
                if (e.target == taskModal) hideTaskModal();
                if (e.target == editUserModal) hideEditUserModal();
                if (e.target == studentDetailsModal) closeStudentDetailsModal();
                if (e.target == reportModal) closeReportModal();
                if (!e.target.closest('.user-actions')) {
                    document.querySelectorAll('.user-actions-menu.visible').forEach(m => m.classList.remove('visible'));
                }
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    hideFeedbackSubmissionModal();
                    closeViewFeedbackModal();
                    hideTaskModal();
                    hideEditUserModal();
                    closeStudentDetailsModal();
                    closeReportModal();
                }
            });

            categoryButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    categoryButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    selectedScore = parseInt(btn.getAttribute('data-score'));
                });
            });
            document.querySelectorAll('.filter-btn').forEach(button => {
                button.addEventListener('click', async () => {
                    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    currentFilter = button.dataset.filter;
                    await reloadCurrentUserTasks();
                });
            });
            submitTaskBtn?.addEventListener('click', async () => {
                 const taskTitle = taskTitleInput?.value.trim();
                 if (!taskTitle) return alert('لطفا عنوان تسک را وارد کنید');
                 const formattedDate = formatDateToYYYYMMDD(selectedDateObject);
                 if (!formattedDate) return alert('لطفا تاریخ معتبر انتخاب کنید');
                 const { data: { user } } = await supabase.auth.getUser();
                 const targetUserId = selectedUserId || user.id;
                 const taskData = {
                     title: taskTitle,
                     date: formattedDate,
                     time_start: timeStartInput?.value || null,
                     time_end: timeEndInput?.value || null,
                     color: selectedScore,
                     updated_at: new Date().toISOString()
                 };
                 try {
                     if (editingTaskId) {
                         const { error } = await supabase.from('tasks').update(taskData).eq('id', editingTaskId);
                         if (error) throw error;
                     } else {
                         const { error } = await supabase.from('tasks').insert([{ ...taskData, user_id: targetUserId, created_at: new Date().toISOString() }]);
                         if (error) throw error;
                     }
                     hideTaskModal();
                     await reloadCurrentUserTasks();
                 } catch (error) {
                     alert('خطا در ثبت تسک');
                 }
            });
            userSearchInput?.addEventListener('input', (e) => searchUsers(e.target.value));
            clearCompletedBtn?.addEventListener('click', clearCompletedTasks);
            viewProfileBtn?.addEventListener('click', openStudentDetailsModal);
            cancelStudentDetailsBtn?.addEventListener('click', closeStudentDetailsModal);
            saveStudentDetailsBtn?.addEventListener('click', saveStudentDetails);
            saveEditUserBtn?.addEventListener('click', saveUserEdit);
            cancelEditUserBtn?.addEventListener('click', hideEditUserModal);
            logoutBtn?.addEventListener('click', async () => {
                await supabase.auth.signOut();
                window.location.href = '/login.html';
            });

        } catch (error) {
            console.error('Error initializing app:', error);
            document.body.innerHTML = '<h1>خطا در بارگذاری برنامه. لطفا صفحه را دوباره بارگذاری کنید.</h1>';
        }
    }

    initializeApp();
});
