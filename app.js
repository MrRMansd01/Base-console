// Initialize Supabase client
const supabaseUrl = 'https://lholzspyazziknxqopmi.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2x6c3B5YXp6aWtueHFvcG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTc0MjYxNjgsImV4cCI6MjAyMzAwMjE2OH0.00000000000000000000000000000000'
const supabase = createClient(supabaseUrl, supabaseKey)

// DOM Elements
const taskModal = document.getElementById('taskModal')
const addTaskBtn = document.querySelector('.add-task-btn')
const submitTaskBtn = document.querySelector('.submit-task-btn')
const tasksContainer = document.querySelector('.tasks-container')
const taskInput = document.querySelector('.task-input')
const taskCount = document.querySelector('.task-count')
const clearCompletedBtn = document.querySelector('.clear-completed-btn')
const searchInput = document.querySelector('.search-input')
const userNameElement = document.querySelector('.user-info h2')
const dailyTasksOverlay = document.getElementById('dailyTasksOverlay')
const dailyTasksList = document.querySelector('.daily-tasks-list')
const selectedDateSpan = document.querySelector('.selected-date')
const closeOverlayBtn = document.querySelector('.close-overlay')
const totalCountSpan = document.querySelector('.total-count')
const completedCountSpan = document.querySelector('.completed-count')
const pendingCountSpan = document.querySelector('.pending-count')
const statNumbers = document.querySelectorAll('.stat-number')

// State
let tasks = []
let currentUser = null
let selectedDate = new Date()
let activeImportance = 'important' // Default importance

// Function to fetch current user
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) throw error
        
        if (user) {
            // Fetch user profile from users table
            const { data, error: profileError } = await supabase
                .from('users')
                .select('name')
                .eq('id', user.id)
                .single()
            
            if (profileError) throw profileError
            
            currentUser = { ...user, ...data }
            userNameElement.textContent = data.name || 'User'
        }
    } catch (error) {
        console.error('Error fetching user:', error)
        userNameElement.textContent = 'User'
    }
}

// Add this after getCurrentUser function
async function updateUserName(newName) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError

        if (user) {
            const { error } = await supabase
                .from('users')
                .update({ name: newName })
                .eq('id', user.id)

            if (error) throw error
            
            userNameElement.textContent = newName
        }
    } catch (error) {
        console.error('Error updating user name:', error)
    }
}

// Add click event to username to allow editing
userNameElement.addEventListener('click', () => {
    const currentName = userNameElement.textContent
    const newName = prompt('Enter your name:', currentName)
    
    if (newName && newName !== currentName) {
        updateUserName(newName)
    }
})

// Event Listeners
addTaskBtn.addEventListener('click', () => {
    taskModal.classList.add('active')
    initializeDatePicker()
    // Reset task form
    taskInput.value = ''
    document.querySelectorAll('.importance-btn').forEach(btn => btn.classList.remove('active'))
    document.querySelector('.importance-btn.important').classList.add('active')
    activeImportance = 'important'
})

window.addEventListener('click', (e) => {
    if (e.target === taskModal) {
        taskModal.classList.remove('active')
    }
})

submitTaskBtn.addEventListener('click', async () => {
    const description = taskInput.value.trim()
    if (!description) {
        alert('لطفا توضیحات تسک را وارد کنید')
        return
    }

    // Get selected date
    const selectedDateObj = new Date(selectedDate)
    
    // Get selected time
    const timeStart = getTimeValue(document.querySelector('.time-picker:first-child'))
    const timeEnd = getTimeValue(document.querySelector('.time-picker:last-child'))
    
    // Get selected importance
    const importance = document.querySelector('.importance-btn.active')?.classList[1] || activeImportance

    try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
            alert('لطفا ابتدا وارد سیستم شوید')
            return
        }
        
        const { data, error } = await supabase
            .from('tasks')
            .insert([
                {
                    description,
                    date: selectedDateObj.toISOString(),
                    time_start: timeStart,
                    time_end: timeEnd,
                    color: getColorForImportance(importance),
                    is_completed: false,
                    user_id: user.id
                }
            ])

        if (error) {
            console.error('Error inserting task:', error)
            alert('خطا در ایجاد تسک. لطفا دوباره تلاش کنید.')
            return
        }

        // Close modal and reload tasks
        taskInput.value = ''
        taskModal.classList.remove('active')
        await loadTasks()
        
        alert('تسک با موفقیت ایجاد شد')
    } catch (error) {
        console.error('Error creating task:', error)
        alert('خطا در ایجاد تسک. لطفا دوباره تلاش کنید.')
    }
})

clearCompletedBtn.addEventListener('click', async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
            alert('لطفا ابتدا وارد سیستم شوید')
            return
        }
        
        const { error } = await supabase
            .from('tasks')
            .delete()
            .match({ is_completed: true, user_id: user.id })

        if (error) throw error
        
        await loadTasks()
        alert('تسک‌های تکمیل شده با موفقیت حذف شدند')
    } catch (error) {
        console.error('Error clearing completed tasks:', error)
        alert('خطا در حذف تسک‌های تکمیل شده. لطفا دوباره تلاش کنید.')
    }
})

searchInput.addEventListener('input', debounce(async (e) => {
    const searchTerm = e.target.value.toLowerCase()
    filterTasks(searchTerm)
}, 300))

// Functions
async function loadTasks() {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
            console.log('No authenticated user')
            renderTasks([])
            updateTaskCount()
            updateStatistics()
            return
        }
        
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) throw error

        tasks = data || []
        renderTasks(tasks)
        updateTaskCount()
        updateStatistics()
    } catch (error) {
        console.error('Error loading tasks:', error)
        alert('خطا در بارگیری تسک‌ها. لطفا صفحه را رفرش کنید.')
    }
}

function renderTasks(tasksToRender) {
    if (tasksToRender.length === 0) {
        tasksContainer.innerHTML = '<div class="no-tasks">هیچ تسکی وجود ندارد</div>'
        return
    }
    
    tasksContainer.innerHTML = tasksToRender.map(task => `
        <div class="task-item" data-id="${task.id}">
            <div class="task-content">
                <input type="checkbox" ${task.is_completed ? 'checked' : ''} 
                       onchange="toggleTaskComplete('${task.id}', this.checked)">
                <span style="text-decoration: ${task.is_completed ? 'line-through' : 'none'}">
                    ${task.description}
                </span>
            </div>
            <div class="task-meta">
                <span class="task-time">${formatTime(task.time_start)} - ${formatTime(task.time_end)}</span>
                <span class="task-status" style="background-color: ${task.color}"></span>
                <button class="delete-task-btn" onclick="deleteTask('${task.id}')">حذف</button>
            </div>
        </div>
    `).join('')
}

// Add this function for deleting tasks
async function deleteTask(taskId) {
    try {
        const { error } = await supabase
            .from('tasks')
            .delete()
            .match({ id: taskId })

        if (error) throw error
        
        await loadTasks()
        alert('تسک با موفقیت حذف شد')
    } catch (error) {
        console.error('Error deleting task:', error)
        alert('خطا در حذف تسک. لطفا دوباره تلاش کنید.')
    }
}

// Make sure this function is globally accessible
window.toggleTaskComplete = async function(taskId, isCompleted) {
    try {
        const { error } = await supabase
            .from('tasks')
            .update({ is_completed: isCompleted })
            .match({ id: taskId })

        if (error) throw error
        await loadTasks()
    } catch (error) {
        console.error('Error updating task:', error)
        alert('خطا در بروزرسانی وضعیت تسک. لطفا دوباره تلاش کنید.')
    }
}

// Make sure deleteTask is globally accessible
window.deleteTask = deleteTask;

function filterTasks(searchTerm) {
    const filteredTasks = tasks.filter(task =>
        task.description.toLowerCase().includes(searchTerm)
    )
    renderTasks(filteredTasks)
}

function updateTaskCount() {
    const activeCount = tasks.filter(task => !task.is_completed).length
    taskCount.textContent = `${activeCount} تسک`
}

function updateStatistics() {
    // Update the statistics
    const completedTasks = tasks.filter(task => task.is_completed).length
    const pendingTasks = tasks.length - completedTasks
    
    // Update the stat cards
    statNumbers[0].textContent = completedTasks
    statNumbers[1].textContent = pendingTasks
    
    // Calculate total study hours (if needed)
    let totalHours = 0
    tasks.forEach(task => {
        if (task.time_start && task.time_end) {
            const startTime = new Date(`2000-01-01T${task.time_start}`)
            const endTime = new Date(`2000-01-01T${task.time_end}`)
            const diffHours = (endTime - startTime) / (1000 * 60 * 60)
            totalHours += diffHours
        }
    })
    
    statNumbers[2].textContent = `${totalHours.toFixed(1)} ساعت`
}

function getColorForImportance(importance) {
    const colors = {
        completed: '#4CAF50',
        urgent: '#f44336',
        important: '#ffc107'
    }
    return colors[importance] || colors.important
}

function formatTime(timeString) {
    if (!timeString) return ''
    try {
        return new Date(`2000-01-01T${timeString}`)
            .toLocaleTimeString('fa-IR', { hour: 'numeric', minute: '2-digit' })
    } catch (e) {
        console.error('Error formatting time:', e)
        return timeString
    }
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout)
            func(...args)
        }
        clearTimeout(timeout)
        timeout = setTimeout(later, wait)
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await getCurrentUser()
    await loadTasks()
    updateDateTime()
    setInterval(updateDateTime, 60000)
})

function updateDateTime() {
    const now = new Date()
    const dayElement = document.querySelector('.day')
    const dateElement = document.querySelector('.full-date')
    
    dayElement.textContent = now.toLocaleDateString('fa-IR', { weekday: 'long' })
    dateElement.textContent = now.toLocaleDateString('fa-IR', { 
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    })
}

// Date Picker Functionality
function initializeDatePicker() {
    const monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"]
    let currentDate = new Date()

    const updateCalendar = () => {
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
        const firstDayIndex = firstDay.getDay() || 7 // Convert Sunday from 0 to 7
        
        document.querySelector('.current-month').textContent = 
            `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`

        const daysContainer = document.querySelector('.days')
        daysContainer.innerHTML = ''

        // Add empty cells for days before the first day of the month
        for (let i = 1; i < firstDayIndex; i++) {
            const emptyDay = document.createElement('span')
            daysContainer.appendChild(emptyDay)
        }

        // Add the days of the month
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dayElement = document.createElement('span')
            dayElement.textContent = day
            
            if (selectedDate && 
                selectedDate.getDate() === day && 
                selectedDate.getMonth() === currentDate.getMonth() &&
                selectedDate.getFullYear() === currentDate.getFullYear()) {
                dayElement.classList.add('selected')
            }
            
            dayElement.addEventListener('click', async () => {
                document.querySelectorAll('.days span').forEach(span => span.classList.remove('selected'))
                dayElement.classList.add('selected')
                selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
            })
            
            daysContainer.appendChild(dayElement)
        }
    }

    // Initialize navigation buttons
    document.querySelector('.nav-btn.prev').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1)
        updateCalendar()
    })

    document.querySelector('.nav-btn.next').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1)
        updateCalendar()
    })

    // Initialize time pickers
    const initializeTimePicker = (container) => {
        const hourSelect = container.querySelector('.hour-select')
        const minuteSelect = container.querySelector('.minute-select')
        
        // Clear existing options
        hourSelect.innerHTML = ''
        minuteSelect.innerHTML = ''
        
        // Populate hours
        for (let i = 1; i <= 12; i++) {
            const option = document.createElement('option')
            option.value = i
            option.textContent = i.toString().padStart(2, '0')
            hourSelect.appendChild(option)
        }
        
        // Populate minutes
        for (let i = 0; i < 60; i++) {
            const option = document.createElement('option')
            option.value = i
            option.textContent = i.toString().padStart(2, '0')
            minuteSelect.appendChild(option)
        }
    }

    document.querySelectorAll('.time-picker').forEach(initializeTimePicker)

    // Initialize importance buttons
    document.querySelectorAll('.importance-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.importance-btn').forEach(b => b.classList.remove('active'))
            btn.classList.add('active')
            activeImportance = btn.classList[1]
        })
    })

    // Initialize calendar
    updateCalendar()
}

function getTimeValue(timePickerElement) {
    const hour = timePickerElement.querySelector('.hour-select').value
    const minute = timePickerElement.querySelector('.minute-select').value
    const ampm = timePickerElement.querySelector('.ampm-select').value
    
    let hour24 = parseInt(hour)
    if (ampm === 'PM' && hour24 < 12) hour24 += 12
    if (ampm === 'AM' && hour24 === 12) hour24 = 0
    
    return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

// Add these new functions for handling daily tasks
async function showDailyTasks(date) {
    try {
        const formattedDate = date.toLocaleDateString('fa-IR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        selectedDateSpan.textContent = formattedDate

        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
            alert('لطفا ابتدا وارد سیستم شوید')
            return
        }

        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)

        const { data: dailyTasks, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', startOfDay.toISOString())
            .lte('date', endOfDay.toISOString())
            .order('time_start', { ascending: true })

        if (error) throw error

        renderDailyTasks(dailyTasks || [])
        updateTaskSummary(dailyTasks || [])
        dailyTasksOverlay.classList.add('active')
    } catch (error) {
        console.error('Error fetching daily tasks:', error)
        alert('خطا در بارگیری تسک‌های روزانه. لطفا دوباره تلاش کنید.')
    }
}

function renderDailyTasks(tasks) {
    if (tasks.length === 0) {
        dailyTasksList.innerHTML = '<div class="no-tasks">هیچ تسکی برای این روز وجود ندارد</div>'
        return
    }

    dailyTasksList.innerHTML = tasks.map(task => `
        <div class="daily-task-item">
            <div class="task-content">
                <input type="checkbox" ${task.is_completed ? 'checked' : ''} 
                       onchange="toggleTaskComplete('${task.id}', this.checked)">
                <span style="text-decoration: ${task.is_completed ? 'line-through' : 'none'}">
                    ${task.description}
                </span>
            </div>
            <div class="task-meta">
                <span class="task-time">${formatTime(task.time_start)} - ${formatTime(task.time_end)}</span>
                <span class="task-status" style="background-color: ${task.color}"></span>
                <button class="delete-task-btn" onclick="deleteTask('${task.id}')">حذف</button>
            </div>
        </div>
    `).join('')
}

function updateTaskSummary(tasks) {
    const total = tasks.length
    const completed = tasks.filter(task => task.is_completed).length
    const pending = total - completed

    totalCountSpan.textContent = total
    completedCountSpan.textContent = completed
    pendingCountSpan.textContent = pending
}

// Event Listeners for Overlay
closeOverlayBtn.addEventListener('click', () => {
    dailyTasksOverlay.classList.remove('active')
})

dailyTasksOverlay.addEventListener('click', (e) => {
    if (e.target === dailyTasksOverlay) {
        dailyTasksOverlay.classList.remove('active')
    }
})

// Initialize filter buttons 
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const filterType = btn.classList[1]; // completed, urgent, important
        
        // Filter tasks based on the selected type
        let filteredTasks = [...tasks];
        
        if (filterType === 'completed') {
            filteredTasks = tasks.filter(task => task.is_completed);
        } else if (filterType === 'urgent') {
            filteredTasks = tasks.filter(task => !task.is_completed && task.color === getColorForImportance('urgent'));
        } else if (filterType === 'important') {
            filteredTasks = tasks.filter(task => !task.is_completed && task.color === getColorForImportance('important'));
        }
        
        renderTasks(filteredTasks);
    });
});