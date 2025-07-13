document.addEventListener('DOMContentLoaded', () => {
    const supabaseUrl = 'https://lholzspyazziknxqopmi.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2x6c3B5YXp6aWtueHFvcG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMjc0MTAsImV4cCI6MjA1NzYwMzQxMH0.uku06OF-WapBhuV-A_rJBXu3x24CKKkSTM0SnmPIOOE';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // DOM Elements
    const studentFilter = document.getElementById('student-filter');
    const subjectFilter = document.getElementById('subject-filter');
    const examFilter = document.getElementById('exam-filter');
    const applyFilterBtn = document.getElementById('apply-filter-btn');
    const scoresTableBody = document.querySelector('#scores-table tbody');
    const loadingMessage = document.getElementById('loading-message');
    const chartCanvas = document.getElementById('scores-chart');
    const exportAllBtn = document.getElementById('export-all-btn');

    let scoresChart;
    let allScoresData = [];

    // Check user role
    async function checkAccessRole() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = '/login.html';
            return false;
        }
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (!['admin', 'teacher', 'consultant'].includes(profile?.role)) {
            alert('شما دسترسی لازم برای مشاهده این صفحه را ندارید.');
            window.location.href = '/home.html';
            return false;
        }
        return true;
    }

    // Populate all filter dropdowns
    async function populateFilters() {
        // Fetch students
        const { data: students } = await supabase.from('profiles').select('id, name').eq('role', 'student');
        if (students) students.forEach(s => studentFilter.add(new Option(s.name, s.id)));

        // Fetch subjects
        const { data: subjects } = await supabase.from('subjects').select('id, name');
        if (subjects) subjects.forEach(s => subjectFilter.add(new Option(s.name, s.id)));

        // Fetch exams
        const { data: exams } = await supabase.from('exams').select('id, name');
        if (exams) exams.forEach(e => examFilter.add(new Option(e.name, e.id)));
    }

    // Fetch and render data based on filters
    async function renderReport() {
        loadingMessage.textContent = 'در حال بارگذاری داده‌ها...';
        loadingMessage.style.display = 'block';
        scoresTableBody.innerHTML = '';

        let query = supabase.from('scores').select(`
            score,
            profiles (id, name),
            exams (id, name, subject_id, subjects (id, name))
        `);

        // Apply filters to the query
        if (studentFilter.value !== 'all') {
            query = query.eq('student_id', studentFilter.value);
        }
        if (subjectFilter.value !== 'all') {
            query = query.eq('exams.subject_id', subjectFilter.value);
        }
        if (examFilter.value !== 'all') {
            query = query.eq('exam_id', examFilter.value);
        }

        const { data, error } = await query;
        if (error) {
            loadingMessage.textContent = 'خطا در دریافت داده‌ها.';
            console.error(error);
            return;
        }
        
        allScoresData = data;

        if (data.length === 0) {
            loadingMessage.textContent = 'هیچ داده‌ای برای فیلتر انتخاب شده یافت نشد.';
            if (scoresChart) scoresChart.destroy();
            return;
        }

        loadingMessage.style.display = 'none';
        
        // Render table
        data.forEach(item => {
            const row = scoresTableBody.insertRow();
            row.innerHTML = `
                <td>${item.profiles.name}</td>
                <td>${item.exams.subjects.name}</td>
                <td>${item.exams.name}</td>
                <td>${item.score}</td>
            `;
        });

        // Render chart
        renderChart(data);
    }

    // Render the bar chart
    function renderChart(data) {
        if (scoresChart) {
            scoresChart.destroy();
        }
        const labels = data.map(item => `${item.profiles.name} (${item.exams.name})`);
        const scores = data.map(item => item.score);

        scoresChart = new Chart(chartCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'نمرات',
                    data: scores,
                    backgroundColor: 'rgba(38, 166, 154, 0.6)',
                    borderColor: 'rgba(38, 166, 154, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // Export data to Excel
    function exportToExcel(data, filename) {
        if (data.length === 0) {
            alert("هیچ داده‌ای برای خروجی گرفتن وجود ندارد.");
            return;
        }
        const flattenedData = data.map(item => ({
            "نام دانش آموز": item.profiles.name,
            "درس": item.exams.subjects.name,
            "آزمون": item.exams.name,
            "نمره": item.score
        }));
        const worksheet = XLSX.utils.json_to_sheet(flattenedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "گزارش نمرات");
        XLSX.writeFile(workbook, `${filename}.xlsx`);
    }

    // Event Listeners
    applyFilterBtn.addEventListener('click', renderReport);
    exportAllBtn.addEventListener('click', () => exportToExcel(allScoresData, "گزارش_کامل_نمرات"));

    // Initial Load
    checkAccessRole().then(hasAccess => {
        if (hasAccess) {
            populateFilters();
        }
    });
});
