// ===========================
// STUDY PLANNER APPLICATION
// ===========================

// Data Management
const StudyPlanner = {
    subjects: [],
    tasks: [],
    timers: {}, // Store timer intervals

    // Initialize app
    init() {
        this.loadFromStorage();
        this.attachEventListeners();
        this.displayQuote();
        this.renderSubjects();
        this.renderTodaysTasks();
        this.updateProgress();
        this.renderPomodoroStats();
        
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        // Update quote daily
        this.scheduleQuoteUpdate();
    },

    // ===========================
    // STORAGE MANAGEMENT
    // ===========================

    loadFromStorage() {
        const savedSubjects = localStorage.getItem('studySubjects');
        const savedTasks = localStorage.getItem('studyTasks');

        if (savedSubjects) {
            this.subjects = JSON.parse(savedSubjects);
            // Initialize timer data for each subject
            this.subjects.forEach(subject => {
                if (!subject.sessionsCompleted) {
                    subject.sessionsCompleted = 0;
                }
                if (!subject.timerState) {
                    subject.timerState = {
                        running: false,
                        paused: false,
                        timeRemaining: 25 * 60,
                        isBreak: false,
                        totalTimeRemaining: 25 * 60
                    };
                }
            });
        }
        if (savedTasks) {
            this.tasks = JSON.parse(savedTasks);
        }
    },

    saveSubjectsToStorage() {
        localStorage.setItem('studySubjects', JSON.stringify(this.subjects));
    },

    saveTasksToStorage() {
        localStorage.setItem('studyTasks', JSON.stringify(this.tasks));
    },

    // ===========================
    // SUBJECT MANAGEMENT
    // ===========================

    addSubject() {
        const nameInput = document.getElementById('subject-name');
        const dateInput = document.getElementById('exam-date');
        const priorityInput = document.getElementById('priority');

        const name = nameInput.value.trim();
        const examDate = dateInput.value;
        const priority = priorityInput.value;

        if (!name || !examDate) {
            alert('Please fill in all fields');
            return;
        }

        const subject = {
            id: Date.now(),
            name,
            examDate,
            priority,
            createdAt: new Date().toISOString(),
            sessionsCompleted: 0,
            timerState: {
                running: false,
                paused: false,
                timeRemaining: 25 * 60,
                isBreak: false,
                totalTimeRemaining: 25 * 60
            }
        };

        this.subjects.push(subject);
        this.saveSubjectsToStorage();
        this.sortSubjectsByDate();
        this.renderSubjects();
        this.renderTodaysTasks();
        this.renderPomodoroStats();
        this.updateProgress();

        // Clear inputs
        nameInput.value = '';
        dateInput.value = '';
        priorityInput.value = 'Medium';
    },

    deleteSubject(id) {
        if (confirm('Are you sure you want to delete this subject?')) {
            // Clear timer if running
            if (this.timers[id]) {
                clearInterval(this.timers[id]);
                delete this.timers[id];
            }
            
            this.subjects = this.subjects.filter(subject => subject.id !== id);
            this.saveSubjectsToStorage();
            this.renderSubjects();
            this.renderTodaysTasks();
            this.renderPomodoroStats();
            this.updateProgress();
        }
    },

    sortSubjectsByDate() {
        this.subjects.sort((a, b) => {
            return new Date(a.examDate) - new Date(b.examDate);
        });
    },

    calculateDaysLeft(examDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const exam = new Date(examDate);
        exam.setHours(0, 0, 0, 0);
        const diff = exam - today;
        const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return daysLeft;
    },

    // ===========================
    // RENDERING FUNCTIONS
    // ===========================

    renderSubjects() {
        const container = document.getElementById('subjects-container');
        
        if (this.subjects.length === 0) {
            container.innerHTML = '<p class="empty-state">No subjects added yet. Start by adding your first subject!</p>';
            return;
        }

        container.innerHTML = this.subjects.map(subject => {
            const daysLeft = this.calculateDaysLeft(subject.examDate);
            const isUrgent = daysLeft <= 3 && daysLeft > 0;
            const isPassed = daysLeft <= 0;
            const examDateFormatted = new Date(subject.examDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            const timerState = subject.timerState;
            const minutes = Math.floor(timerState.timeRemaining / 60);
            const seconds = timerState.timeRemaining % 60;
            const timerDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            const sessionLabel = timerState.isBreak ? '☕ Break Time' : '🍅 Work Session';
            
            const timerClass = `subject-timer ${timerState.running ? 'running' : ''} ${timerState.isBreak ? 'break' : ''}`;
            const startBtnDisabled = timerState.running ? 'disabled' : '';
            const pauseBtnDisabled = !timerState.running ? 'disabled' : '';

            return `
                <div class="subject-card priority-${subject.priority.toLowerCase()}">
                    <div class="subject-header">
                        <h3 class="subject-name">${subject.name}</h3>
                        <span class="priority-badge ${subject.priority.toLowerCase()}">${subject.priority}</span>
                    </div>
                    <div class="subject-details">
                        <div class="detail-line">
                            <span class="detail-label">📅 Exam Date:</span>
                            <span>${examDateFormatted}</span>
                        </div>
                        <div class="detail-line">
                            <span class="detail-label">⏳ Days Left:</span>
                            <span class="countdown ${isUrgent ? 'urgent' : ''} ${isPassed ? 'hidden' : ''}">
                                ${isPassed ? '⌛ Exam passed' : (daysLeft === 0 ? '🚨 Today!' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`)}
                            </span>
                        </div>
                    </div>

                    <!-- Pomodoro Timer Section -->
                    <div class="${timerClass}">
                        <div class="timer-display">
                            <div class="timer-time" id="timer-${subject.id}">${timerDisplay}</div>
                            <div class="timer-status">${sessionLabel}</div>
                        </div>
                        <div class="timer-controls">
                            <button 
                                class="timer-btn timer-btn-start" 
                                onclick="StudyPlanner.startPomodoro(${subject.id})"
                                ${startBtnDisabled}
                            >
                                ▶ Start
                            </button>
                            <button 
                                class="timer-btn timer-btn-pause" 
                                onclick="StudyPlanner.pausePomodoro(${subject.id})"
                                ${pauseBtnDisabled}
                            >
                                ⏸ Pause
                            </button>
                            <button 
                                class="timer-btn timer-btn-reset" 
                                onclick="StudyPlanner.resetPomodoro(${subject.id})"
                            >
                                ↻ Reset
                            </button>
                        </div>
                        <div class="sessions-completed">
                            <span>🎉 Sessions Completed</span>
                            <span class="session-count">${subject.sessionsCompleted}</span>
                        </div>
                    </div>

                    <div class="subject-actions">
                        <button class="btn-delete" onclick="StudyPlanner.deleteSubject(${subject.id})">
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    // ===========================
    // POMODORO TIMER MANAGEMENT
    // ===========================

    startPomodoro(subjectId) {
        const subject = this.subjects.find(s => s.id === subjectId);
        if (!subject || subject.timerState.running) return;

        subject.timerState.running = true;
        subject.timerState.paused = false;

        // Clear any existing timer
        if (this.timers[subjectId]) {
            clearInterval(this.timers[subjectId]);
        }

        // Start countdown timer
        this.timers[subjectId] = setInterval(() => {
            subject.timerState.timeRemaining--;

            // Update display
            this.updateTimerDisplay(subjectId);

            // Session complete
            if (subject.timerState.timeRemaining <= 0) {
                this.completePomodoro(subjectId);
            }
        }, 1000);

        this.renderSubjects();
    },

    pausePomodoro(subjectId) {
        const subject = this.subjects.find(s => s.id === subjectId);
        if (!subject || !subject.timerState.running) return;

        subject.timerState.running = false;
        subject.timerState.paused = true;

        if (this.timers[subjectId]) {
            clearInterval(this.timers[subjectId]);
        }

        this.renderSubjects();
    },

    resetPomodoro(subjectId) {
        const subject = this.subjects.find(s => s.id === subjectId);
        if (!subject) return;

        // Stop timer if running
        if (this.timers[subjectId]) {
            clearInterval(this.timers[subjectId]);
            delete this.timers[subjectId];
        }

        // Reset to work session
        subject.timerState.running = false;
        subject.timerState.paused = false;
        subject.timerState.isBreak = false;
        subject.timerState.timeRemaining = 25 * 60;
        subject.timerState.totalTimeRemaining = 25 * 60;

        this.saveSubjectsToStorage();
        this.renderSubjects();
    },

    completePomodoro(subjectId) {
        const subject = this.subjects.find(s => s.id === subjectId);
        if (!subject) return;

        if (this.timers[subjectId]) {
            clearInterval(this.timers[subjectId]);
            delete this.timers[subjectId];
        }

        if (!subject.timerState.isBreak) {
            // Work session complete, start break
            subject.timerState.sessionsCompleted = (subject.sessionsCompleted || 0) + 1;
            subject.sessionsCompleted++;

            // Show notification
            this.showNotification(`Great work! 🎉 Take a 5-minute break for ${subject.name}`);

            // Start break
            subject.timerState.isBreak = true;
            subject.timerState.running = false;
            subject.timerState.timeRemaining = 5 * 60;
            subject.timerState.totalTimeRemaining = 5 * 60;

            this.saveSubjectsToStorage();
            this.renderSubjects();
            this.renderPomodoroStats();
        } else {
            // Break complete
            this.showNotification(`Break's over! Ready to continue studying? 💪`);

            // Reset to work session
            subject.timerState.isBreak = false;
            subject.timerState.running = false;
            subject.timerState.timeRemaining = 25 * 60;
            subject.timerState.totalTimeRemaining = 25 * 60;

            this.saveSubjectsToStorage();
            this.renderSubjects();
        }
    },

    updateTimerDisplay(subjectId) {
        const subject = this.subjects.find(s => s.id === subjectId);
        if (!subject) return;

        const timerElement = document.getElementById(`timer-${subjectId}`);
        if (!timerElement) return;

        const minutes = Math.floor(subject.timerState.timeRemaining / 60);
        const seconds = subject.timerState.timeRemaining % 60;
        timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    },

    showNotification(message) {
        // Use browser notification if available
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Study Planner', {
                body: message,
                icon: '📚'
            });
        }

        // Also show in-page alert
        alert(message);
    },

    renderPomodoroStats() {
        const container = document.getElementById('pomodoro-stats-container');
        
        // Filter subjects with completed sessions
        const subjectsWithSessions = this.subjects.filter(s => s.sessionsCompleted > 0);

        if (subjectsWithSessions.length === 0) {
            container.innerHTML = '<p class="empty-state">Start Pomodoro sessions to track your progress!</p>';
            return;
        }

        // Sort by sessions completed (descending)
        subjectsWithSessions.sort((a, b) => b.sessionsCompleted - a.sessionsCompleted);

        container.innerHTML = subjectsWithSessions.map(subject => `
            <div class="stat-card">
                <div class="stat-subject">${subject.name}</div>
                <div class="stat-sessions">🍅 ${subject.sessionsCompleted}</div>
            </div>
        `).join('');
    },

    // ===========================

    generateStudyPlan() {
        if (this.subjects.length === 0) {
            alert('Please add at least one subject before generating a study plan!');
            return;
        }

        const planContainer = document.getElementById('study-plan-container');
        const plan = this.createStudySchedule();

        if (plan.length === 0) {
            planContainer.innerHTML = '<p class="empty-state">All exams have passed or are today. Plan generation not available.</p>';
            return;
        }

        planContainer.innerHTML = plan.map(day => `
            <div class="study-plan-item">
                <div class="plan-day">📅 ${day.date}</div>
                ${day.sessions.map(session => `
                    <div class="plan-subject">
                        <strong>${session.subject}</strong>
                        <div class="plan-duration">⏱️ ${session.duration} minutes</div>
                    </div>
                `).join('')}
            </div>
        `).join('');

        // Update today's tasks based on plan
        this.updateTodaysTasksFromPlan();
    },

    createStudySchedule() {
        const today = new Date();
        const schedule = [];
        const dayMap = new Map();

        // Filter subjects with future exam dates
        const futureSubjects = this.subjects.filter(subject => {
            const daysLeft = this.calculateDaysLeft(subject.examDate);
            return daysLeft > 0;
        });

        if (futureSubjects.length === 0) {
            return [];
        }

        // Create weighted study load
        const studyLoad = [];

        futureSubjects.forEach(subject => {
            const daysLeft = this.calculateDaysLeft(subject.examDate);
            let weight = 0;

            // Weight based on priority and days left
            if (subject.priority === 'High') weight = 3;
            else if (subject.priority === 'Medium') weight = 2;
            else weight = 1;

            // More weight for subjects with fewer days
            if (daysLeft <= 3) weight *= 2;
            else if (daysLeft <= 7) weight *= 1.5;

            // Add subject multiple times based on weight
            for (let i = 0; i < weight; i++) {
                studyLoad.push(subject);
            }
        });

        // Distribute study sessions across available days
        let currentDay = new Date(today);
        let studyIndex = 0;

        // Create a 30-day study schedule
        for (let i = 0; i < 30 && studyLoad.length > 0; i++) {
            const dateKey = currentDay.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });

            if (!dayMap.has(dateKey)) {
                dayMap.set(dateKey, []);
            }

            // Distribute 2-3 study sessions per day
            const sessionsPerDay = Math.min(2 + Math.floor(Math.random()), studyLoad.length);

            for (let j = 0; j < sessionsPerDay; j++) {
                if (studyIndex < studyLoad.length) {
                    const subject = studyLoad[studyIndex];
                    const duration = 45 + Math.random() * 30; // 45-75 minutes

                    dayMap.get(dateKey).push({
                        subject: subject.name,
                        duration: Math.round(duration),
                        priority: subject.priority
                    });

                    studyIndex++;
                }
            }

            currentDay.setDate(currentDay.getDate() + 1);
        }

        // Convert map to array
        return Array.from(dayMap.entries()).map(([date, sessions]) => ({
            date,
            sessions
        }));
    },

    updateTodaysTasksFromPlan() {
        const today = new Date().toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });

        // Get today's plan
        const planContainer = document.getElementById('study-plan-container');
        const planItems = planContainer.querySelectorAll('.study-plan-item');

        let todaysSessionsFromPlan = [];
        planItems.forEach(item => {
            const dateText = item.querySelector('.plan-day').textContent.replace('📅 ', '');
            if (dateText === today) {
                const subjects = item.querySelectorAll('.plan-subject');
                subjects.forEach(subjectElement => {
                    const subjectName = subjectElement.querySelector('strong').textContent;
                    const durationText = subjectElement.querySelector('.plan-duration').textContent;
                    const duration = durationText.match(/\d+/)[0];

                    todaysSessionsFromPlan.push({
                        id: `${subjectName}-${Date.now()}`,
                        subject: subjectName,
                        duration: duration,
                        completed: false,
                        date: today
                    });
                });
            }
        });

        // Merge with existing tasks
        if (todaysSessionsFromPlan.length > 0) {
            this.tasks = this.tasks.filter(task => task.date !== today);
            this.tasks.push(...todaysSessionsFromPlan);
            this.saveTasksToStorage();
            this.renderTodaysTasks();
        }
    },

    // ===========================
    // TODAY'S TASKS
    // ===========================

    renderTodaysTasks() {
        const container = document.getElementById('todays-tasks-container');
        const today = new Date().toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });

        // Filter tasks for today
        const todaysTasks = this.tasks.filter(task => {
            if (!task.date) {
                // Auto-assign date to today if not set
                task.date = today;
            }
            return task.date === today;
        });

        if (todaysTasks.length === 0) {
            container.innerHTML = '<p class="empty-state">No tasks for today. Generate a study plan to get started!</p>';
            return;
        }

        container.innerHTML = todaysTasks.map(task => `
            <div class="task-item ${task.completed ? 'completed' : ''}">
                <div class="task-info">
                    <div class="task-subject">${task.subject}</div>
                    <div class="task-duration">⏱️ ${task.duration} minutes</div>
                </div>
                <button 
                    class="checkbox-btn ${task.completed ? 'completed' : ''}" 
                    onclick="StudyPlanner.toggleTaskCompletion('${task.id}')"
                >
                    ${task.completed ? '✓ Done' : 'Mark Done'}
                </button>
            </div>
        `).join('');

        this.saveTasksToStorage();
        this.updateProgress();
    },

    toggleTaskCompletion(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            this.saveTasksToStorage();
            this.renderTodaysTasks();
        }
    },

    // ===========================
    // PROGRESS TRACKING
    // ===========================

    updateProgress() {
        const today = new Date().toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });

        const todaysTasks = this.tasks.filter(task => task.date === today);
        const completedTasks = todaysTasks.filter(task => task.completed);

        const total = todaysTasks.length;
        const completed = completedTasks.length;
        const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const progressPercentage = document.getElementById('progress-percentage');

        progressBar.style.width = percentage + '%';
        progressText.textContent = `${completed} / ${total} tasks completed`;
        progressPercentage.textContent = percentage + '%';
    },

    // ===========================
    // MOTIVATIONAL QUOTES
    // ===========================

    quotes: [
        {
            text: "Success is the sum of small efforts repeated day in and day out.",
            author: "Robert Collier"
        },
        {
            text: "The only way to do great work is to love what you do.",
            author: "Steve Jobs"
        },
        {
            text: "Don't watch the clock; do what it does. Keep going.",
            author: "Sam Levenson"
        },
        {
            text: "The future depends on what you do today.",
            author: "Mahatma Gandhi"
        },
        {
            text: "Excellence is not a skill, it's an attitude.",
            author: "Ralph Marston"
        },
        {
            text: "You are capable of amazing things.",
            author: "Unknown"
        },
        {
            text: "Study is the food of the mind.",
            author: "Diogenes Laërtius"
        },
        {
            text: "Knowledge is power.",
            author: "Francis Bacon"
        },
        {
            text: "The expert in anything was once a beginner.",
            author: "Helen Hayes"
        },
        {
            text: "Your limitation—it's only your imagination. Push beyond it.",
            author: "Unknown"
        },
        {
            text: "Great things never came from comfort zones.",
            author: "Unknown"
        },
        {
            text: "Success doesn't just find you. You have to go out and get it.",
            author: "Unknown"
        },
        {
            text: "The only impossible journey is the one you never begin.",
            author: "Tony Robbins"
        },
        {
            text: "Learning is not attained by chance, it must be sought for with ardor and attended to with diligence.",
            author: "Abigail Adams"
        },
        {
            text: "Believe you can and you're halfway there.",
            author: "Theodore Roosevelt"
        }
    ],

    displayQuote() {
        const quoteIndex = this.getQuoteIndexForDay();
        const quote = this.quotes[quoteIndex];
        
        document.getElementById('daily-quote').textContent = `"${quote.text}"`;
        document.getElementById('quote-author').textContent = `— ${quote.author}`;
    },

    getQuoteIndexForDay() {
        const today = new Date();
        const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
        return dayOfYear % this.quotes.length;
    },

    scheduleQuoteUpdate() {
        // Update quote at midnight
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const timeUntilMidnight = tomorrow - now;

        setTimeout(() => {
            this.displayQuote();
            // Schedule next update for tomorrow
            this.scheduleQuoteUpdate();
        }, timeUntilMidnight);
    },

    // ===========================
    // EVENT LISTENERS
    // ===========================

    attachEventListeners() {
        // Add Subject
        document.getElementById('add-subject-btn').addEventListener('click', () => {
            this.addSubject();
        });

        // Allow Enter key in subject name input
        document.getElementById('subject-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addSubject();
            }
        });

        // Generate Study Plan
        document.getElementById('generate-plan-btn').addEventListener('click', () => {
            this.generateStudyPlan();
        });

        // Set today's date as minimum for exam date input
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('exam-date').setAttribute('min', today);
    }
};

// ===========================
// INITIALIZE APPLICATION
// ===========================

document.addEventListener('DOMContentLoaded', () => {
    StudyPlanner.init();
});
