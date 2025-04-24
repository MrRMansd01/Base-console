document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded, initializing app...');
    
    // Define global variables early
    let selectedUserId = null;
    let selectedDateObject = new Date();
    let isAdmin = false;
    const ADMIN_ID = '23df94b7-412f-4321-a001-591c07fe622e';
    let supabase; // Define supabase here to make it accessible in the scope
    let selectedScore = 1; // Keep track of selected score
    let currentFilter = 'all'; // Keep track of the current filter
    let editingTaskId = null; // Keep track of the task being edited
    let userTaskMap = new Map(); // Add userTaskMap definition
    
    // --- 2. DOM Element References ---
        const taskModal = document.getElementById('taskModal');
        const addTaskBtn = document.querySelector('.add-task-btn');
        const submitTaskBtn = document.querySelector('.submit-task-btn');
    const taskTitleInput = document.getElementById('task-title');
    const taskDateInput = document.getElementById('task-date');
    const timeStartInput = document.getElementById('time-start');
    const timeEndInput = document.getElementById('time-end');
    const categoryButtons = document.querySelectorAll('.category-btn');
        const tasksContainer = document.querySelector('.tasks-container');
        const usersContainer = document.getElementById('users-container');
    const userNameElement = document.getElementById('username');
    const calendarBtn = document.querySelector('.calendar-btn');
    const userSearchInput = document.querySelector('.search-box .search-input'); // For user search
    const dayDisplayElement = document.querySelector('.date-display .day');
    const fullDateDisplayElement = document.querySelector('.date-display .full-date');
    // Add new references for filters, clear button, and stats
        const filterButtons = document.querySelectorAll('.filter-btn');
    const clearCompletedBtn = document.querySelector('.clear-completed-btn');
    const statsCompletedElement = document.querySelector('.stats .stat-card:nth-child(1) .stat-number');
    const statsPendingElement = document.querySelector('.stats .stat-card:nth-child(2) .stat-number');
    const statsTotalTimeElement = document.querySelector('.stats .stat-card:nth-child(3) .stat-number'); // Add Total Time Stat Element
    const taskCountHeaderElement = document.querySelector('.task-count-number'); // Header task count
    const modalTitleElement = taskModal?.querySelector('h2'); // Get modal title H2
    let flatpickrInstance = null; // Store flatpickr instance (Change const to let)
    const editUserModal = document.getElementById('editUserModal');
    const editUserIdInput = document.getElementById('edit-user-id');
    const editUserNameInput = document.getElementById('edit-user-name');
    const editUserFilterInput = document.getElementById('edit-user-filter');
    const saveEditUserBtn = document.getElementById('saveEditUserBtn');
    const cancelEditUserBtn = document.getElementById('cancelEditUserBtn');
    
    // --- Function Definitions FIRST --- 
    // (Move all function definitions here: loadUsers, loadTasksForUser, 
    // createTaskElement, updateTaskStatus, deleteTask, editTask, 
    // showTaskModal, hideTaskModal, clearTaskForm) 

    async function loadTasksForUser(userId, userName, isAdminFlag, filter = 'all') {
        const tasksContainer = document.querySelector('.tasks-container');
        try {
            console.log(`[loadTasksForUser] Loading tasks for user: ${userName} (${userId}) with filter: ${filter}`); // Log start with filter

            // Permission check
            const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
            if (!currentUser || authError) {
                console.error('[loadTasksForUser] Authentication error or no user.');
                return; // Stop if user is not authenticated
            }
            if (!isAdminFlag && userId !== currentUser.id) {
                 console.error('[loadTasksForUser] Permission denied: Cannot view tasks of other users');
                 tasksContainer.innerHTML = '<div class="error-message" style="text-align: center; padding: 2rem; font-size: 1.2rem; color: #f44336;">دسترسی محدود است</div>';
                 // Reset stats on permission error
                 updateStatsDisplay(0, 0, '0:00');
            return;
        }
        
            // Fetch tasks with filtering
            console.log('[loadTasksForUser] Fetching tasks from Supabase...');
            let query = supabase
                .from('tasks')
                .select('*')
                .eq('user_id', userId);

            // Apply filter based on is_completed status
            if (filter === 'completed') {
                query = query.eq('is_completed', true);
            } else if (filter === 'incomplete') {
                query = query.eq('is_completed', false);
            }
            // 'all' filter needs no additional condition

            query = query.order('created_at', { ascending: false });
            
            const { data: tasks, error } = await query;
                
            if (error) {
                console.error('[loadTasksForUser] Error fetching tasks:', error);
                tasksContainer.innerHTML = '<div class="error-message">خطا در بارگذاری تسک‌ها</div>';
                updateStatsDisplay(0, 0, '0:00'); // Reset stats on error
                    return;
                }
                
            console.log('[loadTasksForUser] Fetched tasks:', tasks); // Log fetched tasks
                
            // Fetch ALL tasks for the user (for stats calculation, including time)
            let allTasksForStats = [];
            try {
                const { data: statsTasks, error: statsError } = await supabase
                    .from('tasks')
                    .select('is_completed, time_start, time_end') // Select only needed fields
                    .eq('user_id', userId);
                if (statsError) throw statsError;
                allTasksForStats = statsTasks || [];
            } catch (error) {
                console.error('[loadTasksForUser] Error fetching tasks for stats:', error);
                // Continue without calculating stats if this fails, or show 0
            }

            // Clear tasks container
            tasksContainer.innerHTML = '';
            
            let completedCount = 0;
            let pendingCount = 0;
            let totalMinutesStudied = 0;

            // Calculate stats from allTasksForStats
            allTasksForStats.forEach(task => {
                if (task.is_completed) {
                    completedCount++;
                    // Calculate duration for completed tasks
                    if (task.time_start && task.time_end) {
                        try {
                            const start = new Date(`1970-01-01T${task.time_start}`);
                            const end = new Date(`1970-01-01T${task.time_end}`);
                            if (!isNaN(start) && !isNaN(end) && end > start) {
                                const durationMillis = end - start;
                                totalMinutesStudied += durationMillis / (1000 * 60);
                            }
                        } catch (e) {
                             console.warn('Could not parse time for stats:', task.time_start, task.time_end, e);
                        }
                    }
                        } else {
                    pendingCount++;
                }
            });

            // Format total study time
            const hoursStudied = Math.floor(totalMinutesStudied / 60);
            const minutesStudied = Math.round(totalMinutesStudied % 60); // Round minutes
            const formattedTotalTime = `${hoursStudied}:${minutesStudied.toString().padStart(2, '0')}`;

            // Render FILTERED tasks (using the 'tasks' variable from the first query)
            if (!tasks || tasks.length === 0) {
                console.log('[loadTasksForUser] No tasks found for this user/filter.');
                tasksContainer.innerHTML = '<div class="no-tasks">هیچ تسکی وجود ندارد</div>';
                } else {
                console.log(`[loadTasksForUser] Found ${tasks.length} tasks. Rendering...`);
                tasks.forEach(task => {
                    const taskElement = createTaskElement(task, isAdminFlag);
                    tasksContainer.appendChild(taskElement);
                });
            }
             
            console.log('[loadTasksForUser] Task rendering complete.');

            // Update Stats Display (now including total time)
            updateStatsDisplay(completedCount, pendingCount, formattedTotalTime);

            // Highlight the correct user in the sidebar
            const usersContainer = document.getElementById('users-container');
            document.querySelectorAll('.user-item').forEach(item => {
                item.classList.remove('selected');
            });
            const selectedUserElement = usersContainer.querySelector(`.user-item[data-user-id="${userId}"]`);
            if (selectedUserElement) {
                selectedUserElement.classList.add('selected');
                }
                
            } catch (error) {
                console.error('[loadTasksForUser] Unexpected error:', error);
                tasksContainer.innerHTML = '<div class="error-message">خطا در بارگذاری تسک‌ها</div>';
                updateStatsDisplay(0, 0, '0:00'); // Reset stats on error
        }
    }
    
    // --- Updated Function to Update Stats ---
    function updateStatsDisplay(completed, pending, totalTime) {
        if (statsCompletedElement) statsCompletedElement.textContent = completed;
        if (statsPendingElement) statsPendingElement.textContent = pending;
        if (statsTotalTimeElement) statsTotalTimeElement.textContent = totalTime;
        if (taskCountHeaderElement) taskCountHeaderElement.textContent = completed + pending; // Update header count
        console.log(`[updateStatsDisplay] Stats updated: Completed=${completed}, Pending=${pending}, TotalTime=${totalTime}`);
    }
    // --- End Updated Function ---

    async function updateTaskStatus(taskId, isCompleted) {
        try {
            const { error } = await supabase.from('tasks').update({ 
                is_completed: isCompleted,
                updated_at: new Date().toISOString() 
            }).eq('id', taskId);
            if (error) throw error;
            
            // Reload tasks for the currently selected user, maintaining the current filter
            const { data: { user } } = await supabase.auth.getUser();
            const targetUserId = selectedUserId || user?.id;
            const targetUserName = document.querySelector(`.user-item[data-user-id="${targetUserId}"] .user-name`)?.textContent || user?.email;
            if(targetUserId) {
                await loadTasksForUser(targetUserId, targetUserName, isAdmin, currentFilter); // Pass currentFilter
                // Reload user list to update task counts in sidebar too
                await loadUsers(user, isAdmin);
            }
        } catch (error) {
            console.error('Error updating task status:', error);
            alert('خطا در به‌روزرسانی وضعیت تسک');
        }
    }
    
    function createTaskElement(task, isAdminFlag) {
            const taskElement = document.createElement('div');
        taskElement.className = `task-item score${task.color || '1'}`;
            taskElement.dataset.id = task.id;
        const currentUserId = supabase.auth.getUser().data?.user?.id;
        const canModify = isAdminFlag || task.user_id === currentUserId;

        // Format time for display
        const formatTime = (timeStr) => {
            if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr.substring(0, 5))) return ''; // Basic check for HH:MM format
            const [hours, minutes] = timeStr.split(':');
            return `${hours}:${minutes}`;
        };

        const startTime = formatTime(task.time_start);
        const endTime = formatTime(task.time_end);
        
        // Format date for display
        const taskDate = task.date ? new Date(task.date).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
                
                taskElement.innerHTML = `
                    <div class="task-checkbox">
                <input type="checkbox" class="task-complete-checkbox" 
                    ${task.is_completed ? 'checked' : ''} 
                    ${canModify ? '' : 'disabled'}> 
                    </div>
                    </div>
                
                    <div class="task-content">
                <span class="task-title">${task.title}</span>
                    <div class="task-info">
                    ${taskDate ? `
                        <span class="task-date">
                            <i class="fas fa-calendar"></i>
                            ${taskDate}
                        </span>
                    ` : ''}
                    ${startTime ? `
                        <span class="task-time">
                            <i class="fas fa-clock"></i>
                            ${startTime}
                        </span>
                    ` : ''}
                    ${endTime ? `
                        <span class="task-time">
                            <i class="fas fa-stopwatch"></i> <!-- Different icon for end time -->
                            ${endTime}
                        </span>
                    ` : ''}
                        </div>
                    </div>
            <div class="task-actions">
                ${canModify ? `
                    <button class="task-btn edit-btn" title="ویرایش"><i class="fas fa-edit"></i></button>
                    <button class="task-btn delete-btn" title="حذف"><i class="fas fa-trash"></i></button>
                ` : ''} 
                    </div>
                `;
            
        // Add event listeners only if user can modify
        if (canModify) {
            const checkbox = taskElement.querySelector('.task-complete-checkbox');
            checkbox.addEventListener('change', async () => {
                await updateTaskStatus(task.id, checkbox.checked);
            });

            const deleteBtn = taskElement.querySelector('.delete-btn');
            deleteBtn?.addEventListener('click', async () => { // Use optional chaining
                if (confirm('آیا مطمئن هستید که می‌خواهید این تسک را حذف کنید؟')) {
                    await deleteTask(task.id);
                }
            });

            const editBtn = taskElement.querySelector('.edit-btn');
            editBtn?.addEventListener('click', () => { 
                showTaskModal(task); // Pass the task data to the modal function
            });
        }
            
            return taskElement;
        }
        
    async function loadUsers(currentUser, isAdminFlag) {
        const usersContainer = document.getElementById('users-container');
        if (!usersContainer) {
            console.error("Error: Could not find element with ID 'users-container'");
                    return;
                }
        try {
            console.log('Loading users...');
            
            // Get all users from profiles table
            const { data: users, error: usersError } = await supabase
                .from('profiles')
                    .select('*')
                .order('created_at', { ascending: true });
            
            if (usersError) {
                console.error('Error fetching users:', usersError);
                usersContainer.innerHTML = '<li class="error-message">خطا در بارگذاری کاربران</li>';
                    return;
                }
                
            if (!users || users.length === 0) {
                usersContainer.innerHTML = '<li class="no-users">هیچ کاربری یافت نشد</li>';
                    return;
                }
                
            // Get all tasks to count tasks per user
            const { data: allTasks, error: tasksError } = await supabase
                    .from('tasks')
                .select('user_id, is_completed'); // Also select is_completed for filtering
            
            if (tasksError) {
                 console.error('Error fetching tasks for count:', tasksError);
                 // Continue without counts if tasks fetch fails
            }
            
            // Clear and rebuild userTaskMap
            userTaskMap.clear();
            
            // Create a map of task counts per user and populate userTaskMap
            const taskCounts = {};
            const completedCounts = {};
            if (allTasks) {
                allTasks.forEach(task => {
                    if (task.user_id) {
                        // Total tasks
                        taskCounts[task.user_id] = (taskCounts[task.user_id] || 0) + 1;
                        // Completed tasks
                        if (task.is_completed) {
                            completedCounts[task.user_id] = (completedCounts[task.user_id] || 0) + 1;
                        }
                    }
                });
            }
            
            // Populate userTaskMap with user data
            users.forEach(user => {
                const totalTasks = taskCounts[user.id] || 0;
                const completedTasks = completedCounts[user.id] || 0;
                userTaskMap.set(user.id, {
                    ...user,
                    taskCount: totalTasks,
                    completedCount: completedTasks,
                    incompleteCount: totalTasks - completedTasks
                });
            });
            
            // Example check before using isAdmin or user
            if (typeof isAdminFlag === 'undefined' || typeof currentUser === 'undefined') {
                 console.error('Error in loadUsers: isAdmin or user is not defined!');
                 // Don't throw, just log and potentially return or display an error
                 return;
            }
            
            const usersToDisplay = isAdminFlag ? users : users.filter(u => u.id === currentUser.id);
            
            // Display users
            usersContainer.innerHTML = '';
            usersToDisplay.forEach(userProfile => {
                const userElement = document.createElement('li');
                userElement.className = 'user-item';
                userElement.dataset.userId = userProfile.id;

                // Add selected class if this user is the currently selected one
                if (userProfile.id === selectedUserId) { 
                    userElement.classList.add('selected');
                }
                 // Add admin class identifier if user is admin
                if (userProfile.id === ADMIN_ID) {
                    userElement.classList.add('admin-user');
                }
                
                // Add current user class identifier
                if (userProfile.id === currentUser?.id) { 
                    userElement.classList.add('current-user');
                }

                // Get task counts for this user
                const userData = userTaskMap.get(userProfile.id);
                const taskCount = userData ? userData.taskCount : 0;
                const completedCount = userData ? userData.completedCount : 0;
                const incompleteCount = userData ? userData.incompleteCount : 0;

                userElement.innerHTML = `
                    <div class="user-actions">
                        <button class="user-action-btn dots-btn" title="گزینه‌ها">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div class="user-actions-menu">
                            <button class="menu-item edit-user-btn">ویرایش</button>
                            <button class="menu-item delete-user-btn">حذف</button>
                        </div>
                    </div>
                    <span class="user-name">${userProfile.name || userProfile.username || userProfile.email}</span>
                    <span class="task-count">${taskCount} تسک</span>
                `;
                
                // User selection listener
                userElement.addEventListener('click', (event) => {
                    if (event.target.closest('.user-actions')) return;
                    if (selectedUserId === userProfile.id) return;

                    document.querySelectorAll('.user-item').forEach(item => {
                        item.classList.remove('selected');
                    });
                    userElement.classList.add('selected');
                    selectedUserId = userProfile.id;
                    loadTasksForUser(userProfile.id, userProfile.username || userProfile.email, isAdminFlag, userProfile.filter || currentFilter);
                });

                // Dots button listener
                const dotsBtn = userElement.querySelector('.dots-btn');
                const actionsMenu = userElement.querySelector('.user-actions-menu');
                
                dotsBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    document.querySelectorAll('.user-actions-menu.visible').forEach(menu => {
                        if (menu !== actionsMenu) {
                            menu.classList.remove('visible');
                        }
                    });
                    actionsMenu.classList.toggle('visible');
                });
                
                // Edit button listener
                const editBtn = userElement.querySelector('.edit-user-btn');
                editBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    openEditUserModal(userProfile.id);
                });

                // Delete button listener
                const deleteBtn = userElement.querySelector('.delete-user-btn');
                deleteBtn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    await deleteUserProfile(userProfile.id, userProfile.name || userProfile.username || userProfile.email);
                });
                
                usersContainer.appendChild(userElement);
            });

            // Click handler to close menus when clicking elsewhere
            document.addEventListener('click', (event) => {
                if (!event.target.closest('.user-actions')) {
                    document.querySelectorAll('.user-actions-menu.visible').forEach(menu => {
                        menu.classList.remove('visible');
                    });
                }
            }, true);

            // If no user is selected yet (initial load), select the current user
            if (!selectedUserId && currentUser) {
                const currentUserElement = usersContainer.querySelector(`.user-item[data-user-id="${currentUser.id}"]`);
                if (currentUserElement) {
                    currentUserElement.click();
                }
            }
            
            } catch (error) {
            console.error('Error details in loadUsers:', error);
            usersContainer.innerHTML = '<li class="error-message">خطا در بارگذاری کاربران</li>';
        }
    }
    
    function showTaskModal(taskToEdit = null) {
        editingTaskId = taskToEdit ? taskToEdit.id : null; // Set editing state
        
        if (editingTaskId) {
            console.log('[showTaskModal] Opening in EDIT mode for task:', taskToEdit);
            // Populate form with task data
            if (modalTitleElement) modalTitleElement.textContent = 'ویرایش تسک'; // Change modal title
            if (taskTitleInput) taskTitleInput.value = taskToEdit.title;
            if (timeStartInput) timeStartInput.value = taskToEdit.time_start || '';
            if (timeEndInput) timeEndInput.value = taskToEdit.time_end || '';
            
            // Set date in Flatpickr
            selectedDateObject = taskToEdit.date ? new Date(taskToEdit.date) : new Date();
            if (flatpickrInstance) {
                 flatpickrInstance.setDate(selectedDateObject, true); // Update picker, trigger onChange?
                 // Also update the visible input manually if altInput is used
                 taskDateInput.value = selectedDateObject.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
            } else if (taskDateInput) {
                // Fallback if flatpickr not ready?
                taskDateInput.value = selectedDateObject.toLocaleDateString('fa-IR');
            }

            // Set category/score
            selectedScore = parseInt(taskToEdit.color || '1');
            categoryButtons.forEach(btn => {
                btn.classList.remove('active');
                if (parseInt(btn.dataset.score) === selectedScore) {
                    btn.classList.add('active');
                }
            });

            if (submitTaskBtn) submitTaskBtn.textContent = 'ذخیره تغییرات'; // Change button text

        } else {
            console.log('[showTaskModal] Opening in ADD mode');
            // Reset form to Add mode (using the renamed function)
            resetTaskForm(); 
        }
        
        taskModal.style.display = 'block';
    }
    
    function hideTaskModal() {
        taskModal.style.display = 'none';
        editingTaskId = null; // Reset editing state when modal is hidden
        // Reset form to default state after hiding (optional, but good practice)
        resetTaskForm(); 
    }
    
    function resetTaskForm() {
        console.log('[resetTaskForm] Resetting form to ADD mode...');
        editingTaskId = null; // Ensure editing ID is null
        
        // Reset texts
        if (modalTitleElement) modalTitleElement.textContent = 'تسک جدید'; // Default title
        if (submitTaskBtn) submitTaskBtn.textContent = 'افزودن تسک'; // Default button text
        
        // Clear input fields
        if (taskTitleInput) taskTitleInput.value = '';
        if (timeStartInput) timeStartInput.value = '';
        if (timeEndInput) timeEndInput.value = '';
        
        // Reset date picker to today
        selectedDateObject = new Date(); 
        if (flatpickrInstance) {
            flatpickrInstance.setDate(selectedDateObject, true); 
             taskDateInput.value = selectedDateObject.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
        } else if (taskDateInput) {
             taskDateInput.value = selectedDateObject.toLocaleDateString('fa-IR');
        }

        // Reset category buttons to default (first one active)
        categoryButtons?.forEach(btn => btn.classList.remove('active'));
        const firstCategory = categoryButtons?.[0];
        if (firstCategory) {
             firstCategory.classList.add('active');
             selectedScore = parseInt(firstCategory.dataset.score) || 1;
        } else {
            selectedScore = 1; // Default if no buttons
        }
    }
    
    async function deleteTask(taskId) {
        try {
                        const { error } = await supabase
                            .from('tasks')
                .delete()
                .eq('id', taskId);
                        
                        if (error) throw error;
                        
            // Reload tasks and users, maintaining filter
            const { data: { user } } = await supabase.auth.getUser();
            const targetUserId = selectedUserId || user?.id;
            const targetUserName = document.querySelector(`.user-item[data-user-id="${targetUserId}"] .user-name`)?.textContent || user?.email;
            if (targetUserId) {
                await loadTasksForUser(targetUserId, targetUserName, isAdmin, currentFilter); // Pass filter
                await loadUsers(user, isAdmin); // Update user task counts
            }
            } catch (error) {
            console.error('Error deleting task:', error);
            alert('خطا در حذف تسک');
        }
    }
    
    // --- Helper Function to Format Date --- 
    function formatDateToYYYYMMDD(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // --- End Helper Function --- 

    // --- New Function to Clear Completed Tasks (Moved Inside) ---
    async function clearCompletedTasks() {
        const { data: { user } } = await supabase.auth.getUser();
        const targetUserId = selectedUserId || user?.id;

        if (!targetUserId) {
            console.error('Cannot clear completed tasks: No user selected.');
            return;
        }

        if (!confirm('آیا مطمئن هستید که می‌خواهید تمام تسک‌های تکمیل شده این کاربر را حذف کنید؟')) {
            return;
        }

        console.log(`[clearCompletedTasks] Clearing completed tasks for user ${targetUserId}`);
        try {
                const { error } = await supabase
                    .from('tasks')
                .delete()
                .eq('user_id', targetUserId)
                .eq('is_completed', true);
                
                if (error) throw error;
                
            console.log('[clearCompletedTasks] Completed tasks deleted successfully.');
            // Reload tasks and users, maintaining filter
            const targetUserName = document.querySelector(`.user-item[data-user-id="${targetUserId}"] .user-name`)?.textContent || user?.email;
            await loadTasksForUser(targetUserId, targetUserName, isAdmin, currentFilter);
            await loadUsers(user, isAdmin);

            } catch (error) {
            console.error('Error clearing completed tasks:', error);
            alert('خطا در حذف تسک‌های تکمیل شده.');
        }
    }
    // --- End New Function ---

    // --- User search functionality (Moved Inside) ---
    function searchUsers(searchTerm) {
        // Get all user elements
        const userElements = usersContainer?.querySelectorAll('.user-item');
        
        if (!userElements) return; // Add check
        
        console.log('Searching users for term:', searchTerm);
        console.log('Total users to search through:', userElements.length);
        
        // If search term is empty, show all users
        if (!searchTerm) {
            userElements.forEach(userEl => { // Renamed variable to avoid conflict
                userEl.style.display = '';
            });
            return;
        }
        
        let matchingUsers = 0;
        
        // Filter users based on search term
        userElements.forEach(userEl => { // Renamed variable to avoid conflict
            const userName = userEl.querySelector('.user-name')?.textContent.toLowerCase(); // Optional chaining
            const userTaskCount = userEl.querySelector('.task-count')?.textContent.toLowerCase() || '';
            
            // Check if user name or task count contains search term
            if (userName && (userName.includes(searchTerm) || userTaskCount.includes(searchTerm))) {
                userEl.style.display = ''; // Show user
                matchingUsers++;
            } else {
                userEl.style.display = 'none'; // Hide user
            }
        });
        
        console.log('Matching users found:', matchingUsers);
    }
    // --- End User search functionality ---

    // --- Edit User Modal Functions --- 
    async function saveUserEdit() {
        console.log('Saving user edit...');
        const userId = document.getElementById('edit-user-id').value;
        const newName = document.getElementById('edit-user-name').value;
        const filterInput = document.getElementById('edit-user-filter');
        
        // Get the exact value from the input, preserving spaces
        const newFilter = filterInput.value;

        if (!userId || !newName) {
            console.error('Missing required fields');
            alert('لطفا تمام فیلدهای ضروری را پر کنید');
                return;
            }
            
            try {
            // Log the exact filter value we're about to save
            console.log('Filter value before save:', {
                rawValue: newFilter,
                length: newFilter.length,
                charCodes: [...newFilter].map(c => c.charCodeAt(0))
            });

            const updates = {
                name: newName.trim(),
                filter: newFilter, // Don't trim the filter value
                updated_at: new Date().toISOString()
            };

            console.log('Sending update to server:', updates);

                const { data, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', userId);
                
                if (error) {
                console.error('Supabase update error:', error);
                    throw error;
                }
                
            // Verify the update by fetching the latest data
            const { data: verifyData, error: verifyError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (verifyError) {
                console.error('Error verifying update:', verifyError);
            } else {
                console.log('Verified saved data:', verifyData);
                // Update userTaskMap with verified data
                const currentUserData = userTaskMap.get(userId);
                if (verifyData && currentUserData) {
                    const updatedUserData = {
                        ...currentUserData,
                        name: verifyData.name,
                        filter: verifyData.filter
                    };
                    userTaskMap.set(userId, updatedUserData);
                    console.log('Updated userTaskMap with verified data:', updatedUserData);
                }
            }

            // Close modal
            hideEditUserModal();
            
            // Show success message
            alert('اطلاعات کاربر با موفقیت بروزرسانی شد');
            
            // Get current user for reloading
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            
            // Reload users list with verified data
            await loadUsers(currentUser, isAdmin);
            
            // If this was the selected user, reload their tasks
            if (selectedUserId === userId) {
                await loadTasksForUser(userId, verifyData?.name || updates.name, isAdmin, verifyData?.filter || updates.filter);
            }

                } catch (error) {
            console.error('Error updating user:', error);
            alert('خطا در بروزرسانی اطلاعات کاربر');
        }
    }

    function openEditUserModal(userId) {
        console.log('Opening edit modal for user:', userId);
        // First get fresh data from database
        supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
            .then(({ data: freshData, error }) => {
                if (error) {
                    console.error('Error fetching fresh user data:', error);
                    return;
                }
                
                console.log('Fresh data from database:', {
                    ...freshData,
                    filterLength: freshData?.filter?.length,
                    filterChars: [...(freshData?.filter || '')].map(c => c.charCodeAt(0))
                });
                
                const editUserModal = document.getElementById('editUserModal');
                const editUserIdInput = document.getElementById('edit-user-id');
                const editUserNameInput = document.getElementById('edit-user-name');
                const editUserFilterInput = document.getElementById('edit-user-filter');

                if (editUserIdInput) editUserIdInput.value = userId;
                if (editUserNameInput) editUserNameInput.value = freshData?.name || '';
                if (editUserFilterInput) {
                    editUserFilterInput.value = freshData?.filter || '';
                    // Force LTR direction for the filter input
                    editUserFilterInput.style.direction = 'ltr';
                }
                
                if (editUserModal) {
                    editUserModal.style.display = 'block';
                }

                // Add event listeners
                const saveEditUserBtn = document.getElementById('saveEditUserBtn');
                const cancelEditUserBtn = document.getElementById('cancelEditUserBtn');

                if (saveEditUserBtn) {
                    const newSaveBtn = saveEditUserBtn.cloneNode(true);
                    saveEditUserBtn.parentNode.replaceChild(newSaveBtn, saveEditUserBtn);
                    newSaveBtn.addEventListener('click', async () => {
                        console.log('Save button clicked');
                        await saveUserEdit();
                    });
                }

                if (cancelEditUserBtn) {
                    const newCancelBtn = cancelEditUserBtn.cloneNode(true);
                    cancelEditUserBtn.parentNode.replaceChild(newCancelBtn, cancelEditUserBtn);
                    newCancelBtn.addEventListener('click', () => {
                        console.log('Cancel button clicked');
                        hideEditUserModal();
                    });
                }

                // Close modal when clicking outside
                editUserModal.onclick = function(event) {
                    if (event.target === editUserModal) {
                        hideEditUserModal();
                    }
                };
            });
    }

    function hideEditUserModal() {
        console.log('Hiding edit modal');
        const editUserModal = document.getElementById('editUserModal');
        const editUserIdInput = document.getElementById('edit-user-id');
        const editUserNameInput = document.getElementById('edit-user-name');
        const editUserFilterInput = document.getElementById('edit-user-filter');

        if (editUserModal) editUserModal.style.display = 'none';
        if (editUserIdInput) editUserIdInput.value = '';
        if (editUserNameInput) editUserNameInput.value = '';
        if (editUserFilterInput) editUserFilterInput.value = '';
    }

    async function updateUserProfile(userId, newName) {
        if (!newName || !newName.trim()) {
            alert('لطفا نام کاربر را وارد کنید.');
            return;
        }
        console.log(`[updateUserProfile] Updating user ${userId} with name: ${newName}`);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ 
                    name: newName.trim(), // Update the 'name' field
                    updated_at: new Date().toISOString() 
                })
                .eq('id', userId);

            if (error) throw error;

            console.log('[updateUserProfile] Profile updated successfully.');
            hideEditUserModal();
            // Reload user list to show the change
            const { data: { user } } = await supabase.auth.getUser(); 
            await loadUsers(user, isAdmin); 

        } catch (error) {
            console.error('Error updating user profile:', error);
            alert('خطا در به‌روزرسانی پروفایل کاربر.');
        }
    }
    // --- End Edit User Modal Functions ---

    // --- Delete User Profile Function ---
    async function deleteUserProfile(userIdToDelete, userName) {
         // Prevent deleting the currently logged-in user or the admin from the UI
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (userIdToDelete === currentUser?.id) {
            alert('شما نمی‌توانید حساب کاربری خودتان را از اینجا حذف کنید.');
            return;
        }
        if (userIdToDelete === ADMIN_ID) {
            alert('امکان حذف کاربر ادمین وجود ندارد.');
                    return;
                }
                
        if (!confirm(`آیا مطمئن هستید که می‌خواهید کاربر "${userName}" و تمام تسک‌هایش را حذف کنید؟ این عمل غیرقابل بازگشت است.`)) {
            return;
        }

        console.log(`[deleteUserProfile] Attempting to delete user ${userName} (${userIdToDelete}) and their tasks.`);
        try {
            // 1. Delete user's tasks first
            console.log(` - Deleting tasks for user ${userIdToDelete}...`);
            const { error: taskError } = await supabase
                .from('tasks')
                .delete()
                .eq('user_id', userIdToDelete);
            
            if (taskError) {
                 console.error('Error deleting tasks:', taskError);
                 // Decide if you want to stop or continue if tasks fail to delete
                 // throw new Error('Failed to delete tasks, aborting profile deletion.'); 
                 alert('خطا در حذف تسک‌های کاربر. پروفایل حذف نشد.');
                    return;
                }
            console.log(' - Tasks deleted successfully.');

            // 2. Delete user profile
            console.log(` - Deleting profile for user ${userIdToDelete}...`);
            const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userIdToDelete);

            if (profileError) throw profileError;
            
            console.log('[deleteUserProfile] Profile deleted successfully.');

            // 3. Reload user list
            // Check if the deleted user was the selected one, if so, select the current user
             if (selectedUserId === userIdToDelete) {
                 selectedUserId = currentUser.id; // Switch selection back to current user
                 // No need to explicitly load tasks, loadUsers will handle it
             }
            await loadUsers(currentUser, isAdmin);

        } catch (error) {
            console.error('Error deleting user profile or tasks:', error);
            alert('خطا در حذف کاربر یا تسک‌هایش.');
        }
    }
    // --- End Delete User Profile Function ---

    // --- End of Function Definitions ---

    try {
        // Make sure Supabase is available
        if (!window.supabase) {
            console.error('Supabase is not available! Make sure the Supabase script is loaded correctly.');
            alert('خطا در بارگذاری کتابخانه Supabase. لطفا صفحه را دوباره بارگذاری کنید.');
            return;
        }
        
        // Initialize Supabase client
        const supabaseUrl = 'https://lholzspyazziknxqopmi.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2x6c3B5YXp6aWtueHFvcG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMjc0MTAsImV4cCI6MjA1NzYwMzQxMH0.uku06OF-WapBhuV-A_rJBXu3x24CKKkSTM0SnmPIOOE';
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        
        console.log('Supabase client initialized successfully');
        
        // Check authentication - Define user and authError here for broader scope
        let user, authError;
        try {
            const { data, error } = await supabase.auth.getUser();
            user = data?.user; // Assign to the outer scope variable
            authError = error; // Assign to the outer scope variable
        } catch (e) {
            authError = e; // Catch potential errors during getUser
        }
        
        if (authError) {
            console.error('Authentication error:', authError);
            window.location.href = '/login.html';
            return;
        }
        
        if (!user) {
            console.log('No user logged in, redirecting to login');
            window.location.href = '/login.html';
            return;
        }
        
        console.log('User authenticated:', user.email);
        
        // Check if user has a profile (using the 'user' variable defined above)
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
        if (profileError || !profile) {
            console.log('Creating profile for user...');
            const { error: createError } = await supabase
                .from('profiles')
                .insert([{
                    id: user.id,
                    username: user.email.split('@')[0],
                    email: user.email,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }]);
                
            if (createError) {
                console.error('Error creating profile:', createError);
                alert('خطا در ایجاد پروفایل کاربر');
                return;
            }
        }
        
        // DOM Elements
        const taskModal = document.getElementById('taskModal');
        const addTaskBtn = document.querySelector('.add-task-btn');
        const submitTaskBtn = document.querySelector('.submit-task-btn');
        const tasksContainer = document.querySelector('.tasks-container');
        const taskInput = document.querySelector('.task-input');
        const taskCount = document.querySelector('.task-count');
        const clearCompletedBtn = document.querySelector('.clear-completed-btn');
        const searchInput = document.querySelector('.search-input');
        const userNameElement = document.getElementById('username');
        const usersContainer = document.getElementById('users-container');
        const filterButtons = document.querySelectorAll('.filter-btn');
        const taskTitleInput = document.getElementById('task-title');
        const taskDateInput = document.getElementById('task-date');
        const timeStartInput = document.getElementById('time-start');
        const timeEndInput = document.getElementById('time-end');
        const categoryButtons = document.querySelectorAll('.category-btn');
        
        // Check if all DOM elements are available
        if (!taskModal || !addTaskBtn || !submitTaskBtn || !tasksContainer || !taskInput) {
            console.error('Some DOM elements are missing!', {
                taskModal, addTaskBtn, submitTaskBtn, tasksContainer, taskInput
            });
            alert('خطا در بارگذاری صفحه. لطفا صفحه را دوباره بارگذاری کنید.');
            return;
        }
        
        console.log('All DOM elements loaded successfully');
        
        // Update username in sidebar
        userNameElement.textContent = profile?.name || user.email;
        
        // Track active importance
        let activeImportance = 'score2';
        
        // Check if current user is admin
        isAdmin = user.id === ADMIN_ID;
        console.log('Current user is admin:', isAdmin);
        
        // Load all users
        await loadUsers(user, isAdmin);
        
        // --- Initialize Flatpickr (Store the instance) ---
        const flatpickrWrapper = document.querySelector('.flatpickr-wrapper'); 
        if (flatpickrWrapper) { 
            // Store the instance in the higher scope variable
            flatpickrInstance = flatpickr(flatpickrWrapper, {
                locale: "fa",
                dateFormat: "Y-m-d",
                altInput: true,
                altFormat: "l ، j F Y",
                wrap: true,
                defaultDate: selectedDateObject,
                onChange: function(selectedDates, dateStr, instance) {
                    console.log('[Flatpickr onChange] Triggered! selectedDates:', selectedDates);
                    if (selectedDates.length > 0) {
                        selectedDateObject = selectedDates[0];
                        console.log('[Flatpickr onChange] selectedDateObject updated:', selectedDateObject);
                    }
                },
            });
            console.log('Flatpickr initialized for .flatpickr-wrapper');
        } else {
            console.warn('.flatpickr-wrapper not found, Flatpickr not initialized.');
        }
        // --- End Flatpickr Initialization ---

        // Add event listener for add task button
        addTaskBtn?.addEventListener('click', () => showTaskModal());

        // ---- Updated Submit Task Listener (Handles ADD and EDIT) ----
        submitTaskBtn?.addEventListener('click', async () => {
            const taskTitle = taskTitleInput?.value.trim();
            if (!taskTitle) return alert('لطفا عنوان تسک را وارد کنید');
            
            if (!(selectedDateObject instanceof Date) || isNaN(selectedDateObject.getTime())) {
                console.error("Invalid date object before submit");
                alert("تاریخ انتخاب شده معتبر نیست.");
                selectedDateObject = new Date(); // Reset
            }
            const formattedDate = formatDateToYYYYMMDD(selectedDateObject); 
            const targetUserId = selectedUserId || user.id;

            const taskData = {
            title: taskTitle,
                date: formattedDate,
                time_start: timeStartInput.value || null, // Use null if empty for DB
                time_end: timeEndInput.value || null, // Use null if empty for DB
                color: selectedScore.toString(),
            updated_at: new Date().toISOString()
                // user_id and created_at are handled differently for add/edit
            };

            try {
                if (editingTaskId) {
                    // --- EDIT MODE --- 
                    console.log(`[submitTaskBtn] Editing task with ID: ${editingTaskId}`);
                    await updateTaskStatus(editingTaskId, true); // Mark task as completed
                    await updateTaskStatus(editingTaskId, false); // Mark task as incomplete
                    await loadTasksForUser(selectedUserId, userNameElement.textContent, isAdmin, currentFilter);
                } else {
                    // --- ADD MODE --- 
                    console.log(`[submitTaskBtn] Adding new task with data:`, taskData);
                    await createTask(taskData);
                }
    } catch (error) {
                console.error('Error handling task submission:', error);
                alert('خطا در ثبت تسک');
            }
        });

    } catch (error) {
        console.error('Error initializing app:', error);
        alert('خطا در بارگذاری برنامه');
    }
});