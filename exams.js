document.addEventListener('DOMContentLoaded', () => {
    const supabaseUrl = 'https://lholzspyazziknxqopmi.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2x6c3B5YXp6aWtueHFvcG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMjc0MTAsImV4cCI6MjA1NzYwMzQxMH0.uku06OF-WapBhuV-A_rJBXu3x24CKKkSTM0SnmPIOOE';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // DOM Elements
    const addExamBtn = document.getElementById('add-exam-btn');
    const modal = document.getElementById('exam-modal');
    const modalTitle = document.getElementById('modal-title');
    const cancelBtn = document.getElementById('cancel-btn');
    const examForm = document.getElementById('exam-form');
    const examIdInput = document.getElementById('exam-id');
    const examNameInput = document.getElementById('exam-name');
    const subjectSelect = document.getElementById('subject-select');
    const examDateInput = document.getElementById('exam-date');
    const examsTableBody = document.querySelector('#exams-table tbody');
    const loadingMessage = document.getElementById('loading-message');
    
    // Initialize date picker
    const datePicker = flatpickr(examDateInput, {
        locale: "fa",
        dateFormat: "Y-m-d",
    });

    // Check user role (Admin or Teacher)
    async function checkAccessRole() {
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

        if (error || !['admin', 'teacher'].includes(profile.role)) {
            alert('شما دسترسی لازم برای مشاهده این صفحه را ندارید.');
            window.location.href = '/home.html';
        }
    }

    // Fetch subjects to populate dropdown
    async function populateSubjectsDropdown() {
        const { data: subjects, error } = await supabase
            .from('subjects')
            .select('id, name');

        if (error) {
            console.error('Error fetching subjects:', error);
            return;
        }

        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.name;
            subjectSelect.appendChild(option);
        });
    }

    // Fetch and display exams
    async function fetchExams() {
        loadingMessage.textContent = 'در حال بارگذاری آزمون‌ها...';
        examsTableBody.innerHTML = '';

        const { data: exams, error } = await supabase
            .from('exams')
            .select('*, subjects(name)') // Join with subjects table
            .order('exam_date', { ascending: false });

        if (error) {
            loadingMessage.textContent = 'خطا در بارگذاری آزمون‌ها.';
            console.error('Error fetching exams:', error);
            return;
        }

        if (exams.length === 0) {
            loadingMessage.textContent = 'هیچ آزمونی یافت نشد.';
        } else {
            loadingMessage.style.display = 'none';
            exams.forEach(exam => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${exam.name}</td>
                    <td>${exam.subjects.name}</td>
                    <td>${new Date(exam.exam_date).toLocaleDateString('fa-IR')}</td>
                    <td class="actions-cell">
                        <button class="btn-icon btn-edit" data-id="${exam.id}" data-name="${exam.name}" data-subject-id="${exam.subject_id}" data-date="${exam.exam_date}" title="ویرایش"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon btn-delete" data-id="${exam.id}" title="حذف"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                examsTableBody.appendChild(row);
            });
        }
    }

    // Show modal for adding or editing
    function showModal(exam = null) {
        if (exam) {
            modalTitle.textContent = 'ویرایش آزمون';
            examIdInput.value = exam.id;
            examNameInput.value = exam.name;
            subjectSelect.value = exam.subject_id;
            datePicker.setDate(exam.date);
        } else {
            modalTitle.textContent = 'افزودن آزمون جدید';
            examForm.reset();
            examIdInput.value = '';
        }
        modal.classList.add('is-open');
    }

    // Hide modal
    function hideModal() {
        modal.classList.remove('is-open');
    }

    // Handle form submission
    examForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = examNameInput.value.trim();
        const subject_id = subjectSelect.value;
        const exam_date = examDateInput.value;
        const id = examIdInput.value;

        if (!name || !subject_id || !exam_date) {
            alert('لطفاً تمام فیلدها را پر کنید.');
            return;
        }

        const examData = { name, subject_id, exam_date };
        let error;

        if (id) {
            // Update existing exam
            const { error: updateError } = await supabase
                .from('exams')
                .update(examData)
                .eq('id', id);
            error = updateError;
        } else {
            // Insert new exam
            const { error: insertError } = await supabase
                .from('exams')
                .insert([examData]);
            error = insertError;
        }

        if (error) {
            console.error('Error saving exam:', error);
            alert('خطا در ذخیره آزمون.');
        } else {
            hideModal();
            fetchExams();
        }
    });

    // Handle clicks on edit and delete buttons
    examsTableBody.addEventListener('click', async (e) => {
        const editButton = e.target.closest('.btn-edit');
        const deleteButton = e.target.closest('.btn-delete');

        if (editButton) {
            const exam = {
                id: editButton.dataset.id,
                name: editButton.dataset.name,
                subject_id: editButton.dataset.subjectId,
                date: editButton.dataset.date,
            };
            showModal(exam);
        }

        if (deleteButton) {
            const id = deleteButton.dataset.id;
            if (confirm('آیا از حذف این آزمون مطمئن هستید؟ (تمام نمرات مربوط به آن نیز حذف خواهند شد)')) {
                const { error } = await supabase
                    .from('exams')
                    .delete()
                    .eq('id', id);

                if (error) {
                    console.error('Error deleting exam:', error);
                    alert('خطا در حذف آزمون.');
                } else {
                    fetchExams();
                }
            }
        }
    });

    // Event Listeners
    addExamBtn.addEventListener('click', () => showModal());
    cancelBtn.addEventListener('click', hideModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal();
        }
    });

    // Initial Load
    checkAccessRole().then(() => {
        populateSubjectsDropdown();
        fetchExams();
    });
});
