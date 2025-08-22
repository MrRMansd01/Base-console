document.addEventListener('DOMContentLoaded', () => {
    const supabaseUrl = 'https://lholzspyazziknxqopmi.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2x6c3B5YXp6aWtueHFvcG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMjc0MTAsImV4cCI6MjA1NzYwMzQxMH0.uku06OF-WapBhuV-A_rJBXu3x24CKKkSTM0SnmPIOOE';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // DOM Elements
    const modal = document.getElementById('user-modal');
    const cancelBtn = document.getElementById('cancel-btn');
    const userForm = document.getElementById('user-form');
    const userIdInput = document.getElementById('user-id');
    const userNameInput = document.getElementById('user-name');
    const userEmailInput = document.getElementById('user-email');
    const userRoleSelect = document.getElementById('user-role');
    const usersTableBody = document.querySelector('#users-table tbody');
    const loadingMessage = document.getElementById('loading-message');
    
    // Admin specific fields
    const adminFields = document.getElementById('admin-fields');
    const schoolNameInput = document.getElementById('school-name');
    const studentLimitInput = document.getElementById('student-limit');

    // Manager selection fields
    const managerFields = document.getElementById('manager-fields');
    const managerSelect = document.getElementById('manager-select');

    let currentUserId = null;

    // Check if the logged-in user is a super_admin
    async function checkSuperAdminRole() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = '/login.html';
            return;
        }
        currentUserId = user.id;

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (error || profile.role !== 'super_admin') {
            alert('شما دسترسی لازم برای مشاهده این صفحه را ندارید.');
            window.location.href = '/home.html';
        }
    }
    
    // --- اضافه شده: این تابع لیست مدیران را برای انتخاب می‌آورد ---
    async function populateManagersDropdown() {
        const { data: admins, error } = await supabase
            .from('profiles')
            .select('id, name, school_name')
            .eq('role', 'admin');
        
        if (error) {
            console.error('Error fetching admins:', error);
            return;
        }
        
        managerSelect.innerHTML = '<option value="">بدون مدیر (مستقل)</option>'; // Reset
        admins.forEach(admin => {
            const option = new Option(`${admin.name} (${admin.school_name || 'بدون مدرسه'})`, admin.id);
            managerSelect.appendChild(option);
        });
    }

    // Fetch and display all users
    async function fetchUsers() {
        loadingMessage.textContent = 'در حال بارگذاری کاربران...';
        usersTableBody.innerHTML = '';

        const { data: users, error } = await supabase
            .from('profiles')
            .select('*, manager:manager_id(school_name)') // Fetch school name from manager
            .order('created_at', { ascending: false });

        if (error) {
            loadingMessage.textContent = 'خطا در بارگذاری کاربران.';
            console.error('Error fetching users:', error);
            return;
        }

        if (users.length === 0) {
            loadingMessage.textContent = 'هیچ کاربری یافت نشد.';
        } else {
            loadingMessage.style.display = 'none';
            users.forEach(user => {
                const school = user.role === 'admin' ? user.school_name : (user.manager ? user.manager.school_name : '-');
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.name || 'نامشخص'}</td>
                    <td>${user.email}</td>
                    <td>${user.role || 'تعیین نشده'}</td>
                    <td>${school || '-'}</td>
                    <td class="actions-cell">
                        <button class="btn-icon btn-edit" data-user='${JSON.stringify(user)}' title="ویرایش"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon btn-delete" data-id="${user.id}" title="حذف"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                usersTableBody.appendChild(row);
            });
        }
    }

    // Show modal for editing a user
    function showModal(user) {
        userIdInput.value = user.id;
        userNameInput.value = user.name;
        userEmailInput.value = user.email;
        userRoleSelect.value = user.role || 'student';
        
        // Show/hide fields based on the selected role
        toggleModalFields(user.role);
        
        if (user.role === 'admin') {
            schoolNameInput.value = user.school_name || '';
            studentLimitInput.value = user.student_limit || '';
        } else if (['student', 'teacher', 'consultant'].includes(user.role)) {
            managerSelect.value = user.manager_id || '';
        }

        modal.classList.add('is-open');
    }

    // Hide modal
    function hideModal() {
        modal.classList.remove('is-open');
    }

    // --- اضافه شده: این تابع فیلدهای مودال را بر اساس نقش نمایش می‌دهد ---
    function toggleModalFields(role) {
        if (role === 'admin') {
            adminFields.style.display = 'block';
            managerFields.style.display = 'none';
        } else if (['student', 'teacher', 'consultant'].includes(role)) {
            adminFields.style.display = 'none';
            managerFields.style.display = 'block';
        } else { // for super_admin
            adminFields.style.display = 'none';
            managerFields.style.display = 'none';
        }
    }


    // Handle form submission for updating a user
    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = userIdInput.value;
        const name = userNameInput.value.trim();
        const role = userRoleSelect.value;
        
        if (!id || !name) {
            alert('لطفاً نام کاربر را وارد کنید.');
            return;
        }

        const updates = { name, role };

        if (role === 'admin') {
            updates.school_name = schoolNameInput.value.trim();
            updates.student_limit = parseInt(studentLimitInput.value, 10) || null;
            updates.manager_id = null; // An admin cannot have a manager
        } else if (['student', 'teacher', 'consultant'].includes(role)) {
            updates.manager_id = managerSelect.value || null;
            updates.school_name = null;
            updates.student_limit = null;
        } else { // for super_admin
            updates.manager_id = null;
            updates.school_name = null;
            updates.student_limit = null;
        }


        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', id);

        if (error) {
            console.error('Error updating user:', error);
            alert('خطا در به‌روزرسانی کاربر.');
        } else {
            hideModal();
            fetchUsers();
        }
    });
    
    // Toggle modal fields visibility when role changes
    userRoleSelect.addEventListener('change', (e) => {
        toggleModalFields(e.target.value);
    });

    // Handle clicks on edit and delete buttons
    usersTableBody.addEventListener('click', async (e) => {
        const editButton = e.target.closest('.btn-edit');
        if (editButton) {
            const user = JSON.parse(editButton.dataset.user);
            showModal(user);
        }

        const deleteButton = e.target.closest('.btn-delete');
        if (deleteButton) {
            const id = deleteButton.dataset.id;
            
            if (id === currentUserId) {
                alert('شما نمی‌توانید حساب کاربری خودتان را حذف کنید.');
                return;
            }

            if (confirm('آیا از حذف این کاربر مطمئن هستید؟ این عمل غیرقابل بازگشت است.')) {
                const { error } = await supabase
                    .from('profiles')
                    .delete()
                    .eq('id', id);

                if (error) {
                    console.error('Error deleting user profile:', error);
                    alert('خطا در حذف پروفایل کاربر.');
                } else {
                    alert('پروفایل کاربر با موفقیت حذف شد.');
                    fetchUsers();
                }
            }
        }
    });

    // Event Listeners for modal
    cancelBtn.addEventListener('click', hideModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });

    // Initial Load
    checkSuperAdminRole().then(() => {
        populateManagersDropdown();
        fetchUsers();
    });
});
