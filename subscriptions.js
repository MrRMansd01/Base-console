document.addEventListener('DOMContentLoaded', () => {
    const supabaseUrl = 'https://lholzspyazziknxqopmi.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2x6c3B5YXp6aWtueHFvcG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMjc0MTAsImV4cCI6MjA1NzYwMzQxMH0.uku06OF-WapBhuV-A_rJBXu3x24CKKkSTM0SnmPIOOE';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // DOM Elements
    const adminSelect = document.getElementById('admin-select');
    const subscriptionDetails = document.getElementById('subscription-details');
    const currentExpiryEl = document.getElementById('current-expiry');
    const expiryDateInput = document.getElementById('expiry-date');
    const subscriptionForm = document.getElementById('subscription-form');
    const loadingMessage = document.getElementById('loading-message');

    // Initialize date picker
    const datePicker = flatpickr(expiryDateInput, {
        locale: "fa",
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "l، j F Y",
    });

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

    // Fetch admin users to populate the dropdown
    async function populateAdminsDropdown() {
        const { data: admins, error } = await supabase
            .from('profiles')
            .select('id, name, school_name')
            .eq('role', 'admin');
            
        if (error) return console.error('Error fetching admins:', error);

        admins.forEach(admin => {
            const option = new Option(`${admin.name} (${admin.school_name || 'بدون مدرسه'})`, admin.id);
            adminSelect.appendChild(option);
        });
    }

    // Fetch subscription details when an admin is selected
    adminSelect.addEventListener('change', async () => {
        const adminId = adminSelect.value;
        if (!adminId) {
            subscriptionDetails.style.display = 'none';
            loadingMessage.textContent = 'لطفا یک مدیر را انتخاب کنید.';
            loadingMessage.style.display = 'block';
            return;
        }

        loadingMessage.textContent = 'در حال بارگذاری اطلاعات اشتراک...';
        
        const { data: subscription, error } = await supabase
            .from('subscriptions')
            .select('end_date')
            .eq('user_id', adminId)
            .single();

        if (error && error.code !== 'PGRST116') { // Ignore 'no rows found' error
            console.error('Error fetching subscription:', error);
            currentExpiryEl.textContent = 'خطا در دریافت اطلاعات';
        } else if (subscription) {
            currentExpiryEl.textContent = new Date(subscription.end_date).toLocaleDateString('fa-IR');
        } else {
            currentExpiryEl.textContent = 'اشتراک فعال نشده است';
        }

        loadingMessage.style.display = 'none';
        subscriptionDetails.style.display = 'block';
    });

    // Handle form submission to save the new expiry date
    subscriptionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const adminId = adminSelect.value;
        const newEndDate = expiryDateInput.value;

        if (!adminId || !newEndDate) {
            alert('لطفا مدیر و تاریخ انقضای جدید را مشخص کنید.');
            return;
        }

        // Upsert handles both inserting a new subscription and updating an existing one
        const { error } = await supabase.from('subscriptions').upsert({
            user_id: adminId,
            end_date: newEndDate
        }, {
            onConflict: 'user_id'
        });

        if (error) {
            console.error('Error saving subscription:', error);
            alert('خطا در ذخیره اطلاعات اشتراک.');
        } else {
            alert('اطلاعات اشتراک با موفقیت به‌روزرسانی شد.');
            // Refresh the displayed expiry date
            currentExpiryEl.textContent = new Date(newEndDate).toLocaleDateString('fa-IR');
        }
    });

    // Initial Load
    checkSuperAdminRole().then(() => {
        populateAdminsDropdown();
    });
});
