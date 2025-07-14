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
    let currentReportData = [];

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
        const { data: students } = await supabase.from('profiles').select('id, name').eq('role', 'student');
        if (students) students.forEach(s => studentFilter.add(new Option(s.name, s.id)));

        const { data: subjects } = await supabase.from('subjects').select('id, name');
        if (subjects) subjects.forEach(s => subjectFilter.add(new Option(s.name, s.id)));

        const { data: exams } = await supabase.from('exams').select('id, name');
        if (exams) exams.forEach(e => examFilter.add(new Option(e.name, e.id)));
    }

    // Fetch and render data based on filters
    async function renderReport() {
        loadingMessage.textContent = 'در حال بارگذاری داده‌ها...';
        loadingMessage.style.display = 'block';
        scoresTableBody.innerHTML = '';
        if (scoresChart) scoresChart.destroy();

        let query = supabase.from('scores').select(`
            score,
            profiles (id, name),
            exams (id, name, exam_date, subjects (id, name))
        `);

        // Handle student and exam filters directly
        if (studentFilter.value !== 'all') {
            query = query.eq('student_id', studentFilter.value);
        }
        if (examFilter.value !== 'all') {
            query = query.eq('exam_id', examFilter.value);
        }

        // **CORRECTED LOGIC for subject filter**
        if (subjectFilter.value !== 'all') {
            // First, get all exam IDs for the selected subject
            const { data: examIds, error: examIdError } = await supabase
                .from('exams')
                .select('id')
                .eq('subject_id', subjectFilter.value);
            
            if (examIdError) {
                loadingMessage.textContent = 'خطا در یافتن آزمون‌های درس.';
                console.error(examIdError);
                return;
            }

            const ids = examIds.map(e => e.id);
            if (ids.length === 0) {
                // If no exams for this subject, then no scores to show
                currentReportData = [];
                loadingMessage.textContent = 'هیچ آزمونی برای این درس یافت نشد.';
                return;
            }
            // Now, filter scores where the exam_id is in our list of IDs
            query = query.in('exam_id', ids);
        }

        const { data, error } = await query;
        
        if (error) {
            loadingMessage.textContent = 'خطا در دریافت داده‌ها.';
            console.error(error);
            return;
        }
        
        data.sort((a, b) => {
            const dateA = a.exams ? new Date(a.exams.exam_date) : 0;
            const dateB = b.exams ? new Date(b.exams.exam_date) : 0;
            return dateB - dateA; 
        });

        currentReportData = data;

        if (data.length === 0) {
            loadingMessage.textContent = 'هیچ داده‌ای برای فیلتر انتخاب شده یافت نشد.';
            return;
        }

        loadingMessage.style.display = 'none';
        
        data.forEach(item => {
            const row = scoresTableBody.insertRow();
            row.innerHTML = `
                <td>${item.profiles?.name || 'دانش‌آموز حذف شده'}</td>
                <td>${item.exams?.subjects?.name || 'درس حذف شده'}</td>
                <td>${item.exams?.name || 'آزمون حذف شده'}</td>
                <td>${item.score}</td>
            `;
        });

        renderChart(data);
    }

    // Helper function to determine the max Y-axis value for the chart
    function getChartMaxY(scores) {
        if (!scores || scores.length === 0) return 100;
        const maxScore = Math.max(...scores);
        if (maxScore <= 10) return 10;
        if (maxScore <= 20) return 20;
        if (maxScore <= 40) return 40;
        if (maxScore <= 100) return 100;
        return Math.ceil(maxScore / 10) * 10;
    }

    // Render the bar chart
    function renderChart(data) {
        if (scoresChart) {
            scoresChart.destroy();
        }
        const labels = data.map(item => `${item.profiles?.name || 'ناشناس'} (${item.exams?.name?.substring(0,10) || 'حذف شده'}...)`);
        const scores = data.map(item => item.score);
        
        const maxY = getChartMaxY(scores);

        scoresChart = new Chart(chartCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'نمرات',
                    data: scores,
                    backgroundColor: 'rgba(38, 166, 154, 0.6)',
                    borderColor: 'rgba(38, 166, 154, 1)',
                    borderWidth: 1,
                    borderRadius: 5,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { 
                    y: { 
                        beginAtZero: true, 
                        max: maxY
                    } 
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (context) => {
                                const item = data[context[0].dataIndex];
                                return `${item.profiles?.name || 'ناشناس'} - ${item.exams?.subjects?.name || 'نامشخص'}`;
                            },
                            label: (context) => {
                                const item = data[context.dataIndex];
                                return `آزمون: ${item.exams?.name || 'حذف شده'} | نمره: ${item.score}`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Export data to Excel
    function exportToExcel(data, filename) {
        if (!data || data.length === 0) {
            alert("هیچ داده‌ای برای خروجی گرفتن وجود ندارد.");
            return;
        }
        const flattenedData = data.map(item => ({
            "نام دانش آموز": item.profiles?.name || 'دانش‌آموز حذف شده',
            "درس": item.exams?.subjects?.name || 'درس حذف شده',
            "آزمون": item.exams?.name || 'آزمون حذف شده',
            "نمره": item.score
        }));
        const worksheet = XLSX.utils.json_to_sheet(flattenedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "گزارش نمرات");
        XLSX.writeFile(workbook, `${filename}.xlsx`);
    }

    // Event Listeners
    applyFilterBtn.addEventListener('click', renderReport);
    exportAllBtn.addEventListener('click', () => exportToExcel(currentReportData, "گزارش_فیلتر_شده"));
    
    // Initial Load
    checkAccessRole().then(hasAccess => {
        if (hasAccess) {
            populateFilters();
        }
    });
});
