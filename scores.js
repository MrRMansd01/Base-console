document.addEventListener('DOMContentLoaded', () => {
    const supabaseUrl = 'https://lholzspyazziknxqopmi.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2x6c3B5YXp6aWtueHFvcG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMjc0MTAsImV4cCI6MjA1NzYwMzQxMH0.uku06OF-WapBhuV-A_rJBXu3x24CKKkSTM0SnmPIOOE';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // DOM Elements
    const subjectSelect = document.getElementById('subject-select');
    const examSelect = document.getElementById('exam-select');
    const studentsTableContainer = document.getElementById('students-table-container');
    const studentsTableBody = document.querySelector('#students-table tbody');
    const loadingMessage = document.getElementById('loading-message');
    const scoresForm = document.getElementById('scores-form');

    // Check user role (Admin, Teacher, or Consultant)
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

        if (error || !['admin', 'teacher', 'consultant'].includes(profile.role)) {
            alert('شما دسترسی لازم برای مشاهده این صفحه را ندارید.');
            window.location.href = '/home.html';
        }
    }

    // Fetch subjects to populate the first dropdown
    async function populateSubjectsDropdown() {
        const { data: subjects, error } = await supabase.from('subjects').select('id, name');
        if (error) return console.error('Error fetching subjects:', error);

        subjects.forEach(subject => {
            const option = new Option(subject.name, subject.id);
            subjectSelect.appendChild(option);
        });
    }

    // Fetch exams based on the selected subject
    subjectSelect.addEventListener('change', async () => {
        const subjectId = subjectSelect.value;
        examSelect.innerHTML = '<option value="">انتخاب آزمون...</option>';
        examSelect.disabled = true;
        studentsTableContainer.style.display = 'none';
        loadingMessage.textContent = 'لطفا یک آزمون را انتخاب کنید.';
        
        if (!subjectId) return;

        const { data: exams, error } = await supabase
            .from('exams')
            .select('id, name')
            .eq('subject_id', subjectId);

        if (error) return console.error('Error fetching exams:', error);

        exams.forEach(exam => {
            const option = new Option(exam.name, exam.id);
            examSelect.appendChild(option);
        });
        examSelect.disabled = false;
    });

    // Fetch students and scores when an exam is selected
    examSelect.addEventListener('change', async () => {
        const examId = examSelect.value;
        if (!examId) {
            studentsTableContainer.style.display = 'none';
            loadingMessage.textContent = 'لطفا یک آزمون را انتخاب کنید.';
            return;
        }

        loadingMessage.textContent = 'در حال بارگذاری لیست دانش‌آموزان...';
        studentsTableContainer.style.display = 'block';
        studentsTableBody.innerHTML = '';

        // Fetch all students and existing scores for this exam in parallel
        const [studentsResponse, scoresResponse] = await Promise.all([
            supabase.from('profiles').select('id, name, username').eq('role', 'student'),
            supabase.from('scores').select('student_id, score').eq('exam_id', examId)
        ]);

        if (studentsResponse.error) return console.error('Error fetching students:', studentsResponse.error);
        if (scoresResponse.error) return console.error('Error fetching scores:', scoresResponse.error);
        
        const students = studentsResponse.data;
        const scoresMap = new Map(scoresResponse.data.map(s => [s.student_id, s.score]));

        if (students.length === 0) {
            loadingMessage.textContent = 'هیچ دانش‌آموزی در سیستم یافت نشد.';
        } else {
            loadingMessage.style.display = 'none';
            students.forEach(student => {
                const existingScore = scoresMap.get(student.id) || '';
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${student.name}</td>
                    <td>${student.username || 'N/A'}</td>
                    <td>
                        <input 
                            type="number" 
                            class="score-input"
                            name="score-${student.id}"
                            data-student-id="${student.id}"
                            value="${existingScore}"
                            min="0" 
                            max="100" 
                            step="0.25"
                            placeholder="وارد کنید">
                    </td>
                `;
                studentsTableBody.appendChild(row);
            });
        }
    });

    // Handle form submission to save all scores
    scoresForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const examId = examSelect.value;
        if (!examId) {
            alert('لطفا یک آزمون را انتخاب کنید.');
            return;
        }

        const scoreInputs = document.querySelectorAll('.score-input');
        const scoresToUpsert = [];

        scoreInputs.forEach(input => {
            const student_id = input.dataset.studentId;
            const scoreValue = input.value;
            // Only add scores that are entered
            if (scoreValue !== null && scoreValue !== '') {
                scoresToUpsert.push({
                    exam_id: examId,
                    student_id: student_id,
                    score: parseFloat(scoreValue)
                });
            }
        });

        if (scoresToUpsert.length === 0) {
            alert('هیچ نمره‌ای برای ذخیره وارد نشده است.');
            return;
        }

        // Upsert handles both inserting new scores and updating existing ones
        const { error } = await supabase.from('scores').upsert(scoresToUpsert, {
            onConflict: 'exam_id, student_id'
        });

        if (error) {
            console.error('Error saving scores:', error);
            alert('خطا در ذخیره نمرات.');
        } else {
            alert('نمرات با موفقیت ذخیره شدند.');
        }
    });

    // Initial Load
    checkAccessRole().then(() => {
        populateSubjectsDropdown();
    });
});
