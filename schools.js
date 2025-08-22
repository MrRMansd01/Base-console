document.addEventListener('DOMContentLoaded', () => {
    const supabaseUrl = 'https://lholzspyazziknxqopmi.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2x6c3B5YXp6aWtueHFvcG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMjc0MTAsImV4cCI6MjA1NzYwMzQxMH0.uku06OF-WapBhuV-A_rJBXu3x24CKKkSTM0SnmPIOOE';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // DOM Elements
    const modal = document.getElementById('school-modal');
    const cancelBtn = document.getElementById('cancel-btn');
    const schoolForm = document.getElementById('school-form');
    const adminIdInput = document.getElementById('admin-id');
    const adminNameDisplay = document.getElementById('admin-name-display');
    const schoolNameInput = document.getElementById('school-name');
    const studentLimitInput = document.getElementById('student-limit');
    const schoolsTableBody = document.querySelector('#schools-table tbody');
    const loadingMessage = document.getElementById('loading-message');

    // New elements for adding admins
    const addAdminBtn = document.getElementById('add-admin-btn');
    const addAdminModal = document.getElementById('add-admin-modal');
    const addAdminForm = document.getElementById('add-admin-form');
    const cancelAddBtn = document.getElementById('cancel-add-btn');

    // Check if the logged-in user is a super_admin
    async function checkSuperAdminRole() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = '/login.html';
            return;
        }

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

    // Fetch and display all admins (schools)
    async function fetchAdmins() {
        loadingMessage.textContent = 'در حال بارگذاری لیست مدیران...';
        schoolsTableBody.innerHTML = '';

        const { data: admins, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'admin')
            .order('created_at', { ascending: false });

        if (error) {
            loadingMessage.textContent = 'خطا در بارگذاری مدیران.';
            console.error('Error fetching admins:', error);
            return;
        }

        if (admins.length === 0) {
            loadingMessage.textContent = 'هیچ مدیری یافت نشد. برای افزودن، از دکمه بالا استفاده کنید.';
        } else {
            loadingMessage.style.display = 'none';
            admins.forEach(admin => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${admin.name || 'نامشخص'}</td>
                    <td>${admin.email}</td>
                    <td>${admin.school_name || 'تعیین نشده'}</td>
                    <td>${admin.student_limit || 'نامحدود'}</td>
                    <td class="actions-cell">
                        <button class="btn-icon btn-edit" data-admin='${JSON.stringify(admin)}' title="ویرایش مدرسه"><i class="fas fa-edit"></i></button>
                    </td>
                `;
                schoolsTableBody.appendChild(row);
            });
        }
    }

    // Show modal for editing school details
    function showModal(admin) {
        adminIdInput.value = admin.id;
        adminNameDisplay.textContent = admin.name;
        schoolNameInput.value = admin.school_name || '';
        studentLimitInput.value = admin.student_limit || '';
        modal.classList.add('is-open');
    }

    // Hide modal
    function hideModal() {
        modal.classList.remove('is-open');
    }

    // Handle form submission for updating school details
    schoolForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = adminIdInput.value;
        const school_name = schoolNameInput.value.trim();
        const student_limit = parseInt(studentLimitInput.value, 10) || null;

        if (!id || !school_name) {
            alert('لطفاً نام مدرسه را وارد کنید.');
            return;
        }

        const { error } = await supabase
            .from('profiles')
            .update({ school_name, student_limit })
            .eq('id', id);

        if (error) {
            console.error('Error updating school details:', error);
            alert('خطا در به‌روزرسانی اطلاعات مدرسه.');
        } else {
            hideModal();
            fetchAdmins(); // Refresh the list
        }
    });

    // --- New Logic for Adding Admins ---
    addAdminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-admin-name').value.trim();
        const email = document.getElementById('new-admin-email').value.trim();
        const password = document.getElementById('new-admin-password').value;
        const school_name = document.getElementById('new-admin-school-name').value.trim();
        const student_limit = parseInt(document.getElementById('new-admin-student-limit').value, 10);

        if (!name || !email || !password || !school_name || isNaN(student_limit)) {
            alert('لطفاً تمام فیلدها را به درستی پر کنید.');
            return;
        }

        // 1. Sign up the user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    name: name // Pass name during signup
                }
            }
        });

        if (authError) {
            console.error('Error signing up admin:', authError);
            alert(`خطا در ایجاد کاربر: ${authError.message}`);
            return;
        }

        if (authData.user) {
            // 2. Update the user's profile with the admin role and school details
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    role: 'admin',
                    school_name: school_name,
                    student_limit: student_limit,
                    name: name
                })
                .eq('id', authData.user.id);

            if (profileError) {
                console.error('Error updating profile for new admin:', profileError);
                alert('کاربر ایجاد شد اما در به‌روزرسانی پروفایل خطایی رخ داد.');
            } else {
                alert(`مدیر "${name}" برای مدرسه "${school_name}" با موفقیت ایجاد شد.`);
                addAdminModal.classList.remove('is-open');
                fetchAdmins(); // Refresh the list of admins
            }
        }
    });

    // Handle clicks on edit buttons
    schoolsTableBody.addEventListener('click', (e) => {
        const editButton = e.target.closest('.btn-edit');
        if (editButton) {
            const admin = JSON.parse(editButton.dataset.admin);
            showModal(admin);
        }
    });

    // Event Listeners for modals
    cancelBtn.addEventListener('click', hideModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });

    addAdminBtn.addEventListener('click', () => {
        addAdminForm.reset();
        addAdminModal.classList.add('is-open');
    });
    cancelAddBtn.addEventListener('click', () => {
        addAdminModal.classList.remove('is-open');
    });
    addAdminModal.addEventListener('click', (e) => {
        if (e.target === addAdminModal) {
            addAdminModal.classList.remove('is-open');
        }
    });

    // Initial Load
    checkSuperAdminRole().then(() => {
        fetchAdmins();
    });
});
