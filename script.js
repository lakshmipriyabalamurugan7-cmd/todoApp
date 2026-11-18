
const taskInput = document.getElementById("taskInput");
const taskDateTime = document.getElementById("taskDateTime");
const taskPriority = document.getElementById("taskPriority");
const addBtn = document.getElementById("addBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const taskList = document.getElementById("taskList");
const taskCount = document.getElementById("taskCount");
const clearCompleted = document.getElementById("clearCompleted");

const filters = document.querySelectorAll(".filter");
const themeToggle = document.getElementById("themeToggle");

const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const dailyQuote = document.getElementById("dailyQuote");


// =========================
// LOCAL STORAGE
// =========================

let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

let currentFilter = "all";
let editingTaskId = null;

tasks = tasks.map(task => ({
    ...task,
    priority: task.priority || "Medium",
    notified: task.notified || false
}));


// =========================
// DAILY MOTIVATION
// =========================

const quotes = [
    "Believe in yourself. You are stronger than you think!",
    "Small steps every day lead to big results.",
    "Dream big, work hard, and stay focused.",
    "Success starts with self-discipline.",
    "Every day is a new chance to improve yourself.",
    "Don't stop when you are tired. Stop when you are done.",
    "Your future is created by what you do today.",
    "Stay positive, work hard, and make it happen.",
    "Progress is better than perfection.",
    "Never give up on something you really want."
];

function displayDailyQuote() {

    const today = new Date();

    const dayNumber = Math.floor(
        Date.UTC(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        ) / 86400000
    );

    const quoteIndex = dayNumber % quotes.length;

    dailyQuote.textContent = quotes[quoteIndex];
}

displayDailyQuote();


// =========================
// REAL ALARM SOUND
// =========================

let audioContext = null;
let alarmInterval = null;

function enableAlarmAudio() {

    const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

    if (!audioContext && AudioContextClass) {
        audioContext = new AudioContextClass();
    }

    if (audioContext && audioContext.state === "suspended") {
        audioContext.resume();
    }
}

// Enable audio after first user interaction
document.addEventListener("click", enableAlarmAudio, { once: true });
document.addEventListener("keydown", enableAlarmAudio, { once: true });


function playAlarmTone(frequency, startTime) {

    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "triangle";

    oscillator.frequency.setValueAtTime(
        frequency,
        startTime
    );

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(0.35, startTime + 0.04);
    gain.gain.setValueAtTime(0.35, startTime + 0.18);
    gain.gain.linearRampToValueAtTime(0.001, startTime + 0.35);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.36);
}


function playAlarmSound() {

    if (!audioContext) {
        console.log("Audio is not initialized. Click the page first.");
        return;
    }

    audioContext.resume().then(() => {

        if (alarmInterval) return;

        function ringPattern() {

            if (audioContext.state !== "running") return;

            const now = audioContext.currentTime;

            playAlarmTone(880, now);
            playAlarmTone(660, now + 0.4);
            playAlarmTone(880, now + 0.8);
            playAlarmTone(660, now + 1.2);
        }

        ringPattern();

        // Repeat alarm until stopped
        alarmInterval = setInterval(ringPattern, 1800);

    }).catch(error => {
        console.log("Alarm sound error:", error);
    });
}


function stopAlarmSound() {

    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
}


// =========================
// ESCAPE TASK TEXT
// =========================

function escapeHTML(text) {

    return String(text).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}


// =========================
// DISPLAY TASKS
// =========================

function displayTasks() {

    taskList.innerHTML = "";

    let filteredTasks = tasks;

    if (currentFilter === "active") {
        filteredTasks = tasks.filter(task => !task.completed);
    }

    if (currentFilter === "completed") {
        filteredTasks = tasks.filter(task => task.completed);
    }

    filteredTasks.forEach(task => {

        const li = document.createElement("li");

        if (task.completed) {
            li.classList.add("completed");
        }

        const reminderHTML = task.reminder
            ? `<small class="reminder-time">
                ⏰ ${escapeHTML(new Date(task.reminder).toLocaleString())}
               </small>`
            : "";

        const priority = task.priority || "Medium";
        const priorityClass = priority.toLowerCase();

        li.innerHTML = `
            <input
                type="checkbox"
                ${task.completed ? "checked" : ""}
                onchange="toggleTask(${Number(task.id)})"
            >

            <div class="task-content">

                <span class="task-text">
                    ${escapeHTML(task.text)}
                </span>

                <span class="priority priority-${priorityClass}">
                    ${escapeHTML(priority)} Priority
                </span>

                ${reminderHTML}

            </div>

            <div class="task-actions">

                <button
                    class="edit-btn"
                    onclick="editTask(${Number(task.id)})"
                >
                    Edit
                </button>

                <button
                    class="delete-btn"
                    onclick="deleteTask(${Number(task.id)})"
                >
                    Delete
                </button>

            </div>
        `;

        taskList.appendChild(li);
    });

    updateTaskCount();
    updateProgress();
}


// =========================
// ADD / UPDATE TASK
// =========================

function addTask() {

    const text = taskInput.value.trim();
    const reminder = taskDateTime.value;
    const priority = taskPriority.value;

    if (text === "") {
        alert("Please enter a task!");
        taskInput.focus();
        return;
    }

    if (
        reminder &&
        new Date(reminder).getTime() <= Date.now() &&
        editingTaskId === null
    ) {
        alert("Please select a future reminder time!");
        return;
    }

    if (editingTaskId !== null) {

        tasks = tasks.map(task => {

            if (task.id === editingTaskId) {

                return {
                    ...task,
                    text: text,
                    reminder: reminder || null,
                    priority: priority,
                    notified: reminder === task.reminder
                        ? task.notified
                        : false
                };
            }

            return task;
        });

        editingTaskId = null;

        addBtn.textContent = "Add Task";
        cancelEditBtn.hidden = true;

    } else {

        const newTask = {
            id: Date.now(),
            text: text,
            completed: false,
            reminder: reminder || null,
            priority: priority,
            notified: false
        };

        tasks.push(newTask);
    }

    saveTasks();

    resetForm();
    displayTasks();
}


// =========================
// EDIT TASK
// =========================

function editTask(id) {

    const task = tasks.find(task => task.id === id);

    if (!task) return;

    editingTaskId = id;

    taskInput.value = task.text;
    taskPriority.value = task.priority || "Medium";
    taskDateTime.value = task.reminder || "";

    addBtn.textContent = "Update Task";
    cancelEditBtn.hidden = false;

    taskInput.focus();
}


// =========================
// CANCEL EDIT
// =========================

function cancelEdit() {

    editingTaskId = null;

    resetForm();

    addBtn.textContent = "Add Task";
    cancelEditBtn.hidden = true;
}


function resetForm() {

    taskInput.value = "";
    taskDateTime.value = "";
    taskPriority.value = "Medium";
}


// =========================
// COMPLETE TASK
// =========================

function toggleTask(id) {

    tasks = tasks.map(task => {

        if (task.id === id) {
            task.completed = !task.completed;
        }

        return task;
    });

    saveTasks();
    displayTasks();
}


// =========================
// DELETE TASK
// =========================

function deleteTask(id) {

    if (editingTaskId === id) {
        cancelEdit();
    }

    tasks = tasks.filter(task => task.id !== id);

    saveTasks();
    displayTasks();
}


// =========================
// CLEAR COMPLETED
// =========================

function clearCompletedTasks() {

    if (editingTaskId !== null) {

        const editingTask = tasks.find(
            task => task.id === editingTaskId
        );

        if (editingTask && editingTask.completed) {
            cancelEdit();
        }
    }

    tasks = tasks.filter(task => !task.completed);

    saveTasks();
    displayTasks();
}


// =========================
// TASK COUNT
// =========================

function updateTaskCount() {

    const activeTasks =
        tasks.filter(task => !task.completed).length;

    taskCount.textContent =
        `${activeTasks} ${activeTasks === 1 ? "task" : "tasks"} left`;
}


// =========================
// TASK PROGRESS
// =========================

function updateProgress() {

    const totalTasks = tasks.length;

    const completedTasks =
        tasks.filter(task => task.completed).length;

    const percentage = totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

    progressText.textContent =
        `${completedTasks} of ${totalTasks} completed`;

    progressFill.style.width = `${percentage}%`;
}


// =========================
// SAVE TASKS
// =========================

function saveTasks() {

    localStorage.setItem(
        "tasks",
        JSON.stringify(tasks)
    );
}


// =========================
// FILTER TASKS
// =========================

filters.forEach(filter => {

    filter.addEventListener("click", () => {

        filters.forEach(button => {
            button.classList.remove("active");
        });

        filter.classList.add("active");

        currentFilter = filter.dataset.filter;

        displayTasks();
    });

});


// =========================
// BUTTON EVENTS
// =========================

addBtn.addEventListener("click", addTask);

taskInput.addEventListener("keydown", event => {

    if (event.key === "Enter") {
        addTask();
    }

});

cancelEditBtn.addEventListener("click", cancelEdit);

clearCompleted.addEventListener(
    "click",
    clearCompletedTasks
);


// =========================
// DARK MODE
// =========================

function enableDarkMode() {

    document.body.classList.add("dark");

    themeToggle.textContent = "☀️";

    localStorage.setItem("darkMode", "enabled");
}


function disableDarkMode() {

    document.body.classList.remove("dark");

    themeToggle.textContent = "🌙";

    localStorage.setItem("darkMode", "disabled");
}


themeToggle.addEventListener("click", () => {

    if (document.body.classList.contains("dark")) {
        disableDarkMode();
    } else {
        enableDarkMode();
    }

});


const savedTheme = localStorage.getItem("darkMode");

if (savedTheme === "enabled") {
    enableDarkMode();
}


// =========================
// REQUEST NOTIFICATION
// =========================

function requestNotificationPermission() {

    if (
        "Notification" in window &&
        Notification.permission === "default"
    ) {
        Notification.requestPermission();
    }
}


// =========================
// REMINDER CHECKER
// =========================

function checkReminders() {

    const now = Date.now();

    tasks.forEach(task => {

        if (
            task.reminder &&
            !task.completed &&
            !task.notified
        ) {

            const reminderTime =
                new Date(task.reminder).getTime();

            if (now >= reminderTime) {

                task.notified = true;

                saveTasks();

                showReminder(task);
            }
        }

    });

}


// =========================
// SHOW REMINDER
// =========================

function showReminder(task) {

    playAlarmSound();

    if (
        "Notification" in window &&
        Notification.permission === "granted"
    ) {

        new Notification("⏰ Todo Reminder", {
            body: task.text
        });

    }

    // Remove previous popup if it exists
    const oldPopup = document.getElementById("alarmPopup");

    if (oldPopup) {
        oldPopup.remove();
    }

    // Create alarm popup
    const popup = document.createElement("div");

    popup.id = "alarmPopup";

    popup.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.65);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;

    popup.innerHTML = `
        <div style="
            background: white;
            padding: 35px;
            border-radius: 18px;
            text-align: center;
            width: 320px;
            max-width: 90%;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        ">

            <div style="font-size: 55px;">⏰</div>

            <h2 style="margin: 15px 0; color: #764ba2;">
                Time's Up!
            </h2>

            <p style="margin-bottom: 25px; color: #444;">
                ${escapeHTML(task.text)}
            </p>

            <button id="stopAlarmBtn" style="
                background: #ff4545;
                color: white;
                border: none;
                padding: 13px 30px;
                border-radius: 10px;
                font-size: 15px;
                font-weight: bold;
                cursor: pointer;
            ">
                🔕 Stop Alarm
            </button>

        </div>
    `;

    document.body.appendChild(popup);

    document.getElementById("stopAlarmBtn")
        .addEventListener("click", () => {

            stopAlarmSound();
            popup.remove();

        });

}


// =========================
// START REMINDER TIMER
// =========================

setInterval(checkReminders, 1000);


// =========================
// INITIAL DISPLAY
// =========================

saveTasks();
displayTasks();
requestNotificationPermission();
