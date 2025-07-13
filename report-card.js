document.addEventListener('DOMContentLoaded', () => {
    const supabaseUrl = 'https://lholzspyazziknxqopmi.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2x6c3B5YXp6aWtueHFvcG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMjc0MTAsImV4cCI6MjA1NzYwMzQxMH0.uku06OF-WapBhuV-A_rJBXu3x24CKKkSTM0SnmPIOOE';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // DOM Elements
    const avgScoreEl = document.getElementById('avg-score');
    const examCountEl = document.getElementById('exam-count');
    const maxScoreEl = document.getElementById('max-score');
    const minScoreEl = document.getElementById('min-score');
    const chartCanvas = document.getElementById('progress-chart');
    const scoresTableBody = document.querySelector('#scores-table tbody');
    const loadingMessage = document.getElementById('loading-message');
    
    let progressChart;

    // Fetch and display student's report card
    async function loadReportCard() {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            window.location.href = '/login.html';
            return;
        }

        loadingMessage.textContent = 'در حال بارگذاری کارنامه...';
        
        const { data: scores, error } = await supabase
            .from('scores')
            .select(`
                score,
                exams ( name, exam_date, subjects (name) )
            `)
            .eq('student_id', user.id)
            .order('exams(exam_date)', { ascending: true });

        if (error) {
            loadingMessage.textContent = 'خطا در بارگذاری اطلاعات.';
            console.error('Error fetching scores:', error);
            return;
        }

        if (scores.length === 0) {
            loadingMessage.textContent = 'شما هنوز در هیچ آزمونی شرکت نکرده‌اید.';
            return;
        }

        loadingMessage.style.display = 'none';
        
        // Populate table
        scores.forEach(item => {
            const row = scoresTableBody.insertRow();
            row.innerHTML = `
                <td>${item.exams.subjects.name}</td>
                <td>${item.exams.name}</td>
                <td>${new Date(item.exams.exam_date).toLocaleDateString('fa-IR')}</td>
                <td>${item.score}</td>
            `;
        });
        
        // Calculate and display summary stats
        const scoreValues = scores.map(s => s.score);
        const totalExams = scoreValues.length;
        const sumOfScores = scoreValues.reduce((acc, score) => acc + score, 0);
        const avgScore = (sumOfScores / totalExams).toFixed(2);
        const maxScore = Math.max(...scoreValues);
        const minScore = Math.min(...scoreValues);

        examCountEl.textContent = totalExams;
        avgScoreEl.textContent = avgScore;
        maxScoreEl.textContent = maxScore;
        minScoreEl.textContent = minScore;
        
        // Render progress chart
        renderProgressChart(scores);
    }

    // Render the line chart for progress
    function renderProgressChart(data) {
        if (progressChart) {
            progressChart.destroy();
        }

        const labels = data.map(item => `${item.exams.subjects.name} - ${item.exams.name}`);
        const scores = data.map(item => item.score);

        progressChart = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'روند نمرات',
                    data: scores,
                    fill: true,
                    backgroundColor: 'rgba(38, 166, 154, 0.2)',
                    borderColor: 'rgba(38, 166, 154, 1)',
                    tension: 0.1
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
                }
            }
        });
    }

    // Initial Load
    loadReportCard();
});
