/* =========================================================
   TO-DO LIST APPLICATION - Main JavaScript
   Saves tasks in the browser using localStorage.
   ========================================================= */

(() => {
    "use strict";

    const STORAGE_KEY = "toDoListTasks";
    let tasks = [];
    let editingTaskId = null;
    let pendingDeleteId = null;
    let pendingDeleteAll = false;
    let datePicker = null;

    const $ = (id) => document.getElementById(id);

    function createId() {
        return (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char]));
    }

    function showMessage(type, message) {
        const success = $("lblsuccess");
        const error = $("lblerror");
        if (!success || !error) return;

        success.style.display = "none";
        error.style.display = "none";

        const target = type === "success" ? success : error;
        target.textContent = message;
        target.style.display = "block";

        window.clearTimeout(showMessage.timer);
        showMessage.timer = window.setTimeout(() => {
            target.style.display = "none";
        }, 2800);
    }

    function saveTasks() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        } catch (error) {
            showMessage("error", "Could not save tasks in this browser.");
            console.error("Saving tasks failed:", error);
        }
    }

    function loadTasks() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            tasks = Array.isArray(saved) ? saved : [];
        } catch (error) {
            tasks = [];
            console.error("Loading tasks failed:", error);
        }
    }

    function formatDate(dateString) {
        if (!dateString) return "No due date";
        const date = new Date(`${dateString}T00:00:00`);
        if (Number.isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function priorityClass(priority) {
        return `priority-${String(priority || "low").toLowerCase()}`;
    }

    function renderTasks() {
        const list = $("taskList");
        const actions = $("taskActions");
        if (!list) return;

        const search = ($("searchBar")?.value || "").trim().toLowerCase();
        const visibleTasks = tasks.filter((task) => {
            const text = `${task.title} ${task.description} ${task.priority}`.toLowerCase();
            return text.includes(search);
        });

        list.innerHTML = "";

        if (visibleTasks.length === 0) {
            if (tasks.length === 0) {
                list.innerHTML = '<li class="list-group-item text-center text-muted">No tasks yet. Add your first task above.</li>';
            } else if (search) {
                list.innerHTML = '<li class="list-group-item text-center text-muted">No matching tasks found.</li>';
            }
        } else {
            visibleTasks.forEach((task) => {
                const item = document.createElement("li");
                item.className = "list-group-item task-item";
                item.dataset.taskId = task.id;

                const safeTitle = escapeHTML(task.title);
                const safeDescription = escapeHTML(task.description);
                const safePriority = escapeHTML(task.priority || "Low");
                const safeDate = escapeHTML(formatDate(task.dueDate));
                const checked = task.completed ? "checked" : "";
                const completedClass = task.completed ? "task-completed" : "";

                item.innerHTML = `
                    <div class="task-row">
                        <label class="task-check-wrap">
                            <input class="task-check" type="checkbox" ${checked}
                                   aria-label="Mark ${safeTitle} as completed">
                        </label>
                        <div class="task-details ${completedClass}">
                            <div class="task-title">${safeTitle}</div>
                            ${safeDescription ? `<div class="task-description">${safeDescription}</div>` : ""}
                            <div class="task-meta">
                                <span class="task-priority ${priorityClass(task.priority)}">${safePriority} Priority</span>
                                <span class="task-date">${safeDate}</span>
                            </div>
                        </div>
                        <div class="task-buttons">
                            <button type="button" class="btn btn-sm btn-outline-primary task-edit" aria-label="Edit task">Edit</button>
                            <button type="button" class="btn btn-sm btn-outline-danger task-delete" aria-label="Delete task">Delete</button>
                        </div>
                    </div>
                `;

                item.querySelector(".task-check").addEventListener("change", () => {
                    task.completed = !task.completed;
                    saveTasks();
                    renderTasks();
                });

                item.querySelector(".task-edit").addEventListener("click", () => beginEdit(task.id));
                item.querySelector(".task-delete").addEventListener("click", () => askDelete(task.id));
                list.appendChild(item);
            });
        }

        if (actions) {
            actions.style.display = tasks.length > 0 ? "block" : "none";
        }
    }

    function resetForm() {
        $("addForm")?.reset();
        editingTaskId = null;

        const submit = $("submitBtn");
        const edit = $("editTask");
        if (submit) {
            submit.value = "Add";
            submit.disabled = true;
            submit.style.display = "";
        }
        if (edit) edit.style.display = "none";

        const title = $("maintitle");
        if (title) title.textContent = "Add your tasks below :";
    }

    function enableSubmit(input, buttonId) {
        const button = $(buttonId);
        if (button) button.disabled = !input.value.trim();
    }

    function addOrUpdateTask(event) {
        event?.preventDefault();

        const titleInput = $("item");
        const descriptionInput = $("description");
        const priorityInput = $("priority");
        const dueDateInput = $("dueDate");

        const title = titleInput?.value.trim() || "";
        const description = descriptionInput?.value.trim() || "";
        const priority = priorityInput?.value || "Low";
        const dueDate = dueDateInput?.value || "";

        if (!title) {
            showMessage("error", "Please enter a task name.");
            titleInput?.focus();
            return;
        }

        const duplicate = tasks.some((task) =>
            task.title.toLowerCase() === title.toLowerCase() &&
            task.id !== editingTaskId
        );

        if (duplicate) {
            showDuplicateDialog();
            return;
        }

        if (editingTaskId) {
            const task = tasks.find((entry) => entry.id === editingTaskId);
            if (task) {
                task.title = title;
                task.description = description;
                task.priority = priority;
                task.dueDate = dueDate;
            }
            showMessage("success", "Task updated successfully.");
        } else {
            tasks.unshift({
                id: createId(),
                title,
                description,
                priority,
                dueDate,
                completed: false,
                createdAt: new Date().toISOString()
            });
            showMessage("success", "Task added successfully.");
        }

        saveTasks();
        renderTasks();
        resetForm();
    }

    function beginEdit(id) {
        const task = tasks.find((entry) => entry.id === id);
        if (!task) return;

        editingTaskId = id;
        $("item").value = task.title;
        $("description").value = task.description || "";
        $("priority").value = task.priority || "";
        $("dueDate").value = task.dueDate || "";

        if ($("submitBtn")) $("submitBtn").style.display = "none";
        if ($("editTask")) $("editTask").style.display = "inline-block";
        if ($("maintitle")) $("maintitle").textContent = "Edit your task :";

        $("item")?.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function showDialog(id) {
        const dialog = $(id);
        if (dialog) {
            dialog.style.display = "flex";
            dialog.setAttribute("aria-hidden", "false");
        }
    }

    function hideDialog(id) {
        const dialog = $(id);
        if (dialog) {
            dialog.style.display = "none";
            dialog.setAttribute("aria-hidden", "true");
        }
    }

    function askDelete(id) {
        pendingDeleteId = id;
        const task = tasks.find((entry) => entry.id === id);
        if ($("confirm-msg")) {
            $("confirm-msg").textContent = `Are you sure you want to delete "${task?.title || "this task"}"?`;
        }
        showDialog("custom-confirm");
    }

    function deleteSelectedTask() {
        if (!pendingDeleteId) return;
        tasks = tasks.filter((task) => task.id !== pendingDeleteId);
        pendingDeleteId = null;
        saveTasks();
        renderTasks();
        hideDialog("custom-confirm");
        showMessage("success", "Task deleted.");
    }

    function askDeleteAll() {
        if (tasks.length === 0) {
            showMessage("error", "There are no tasks to clear.");
            return;
        }
        pendingDeleteAll = true;
        if ($("confirm-msg-all")) {
            $("confirm-msg-all").textContent = "Are you sure you want to delete all tasks? This cannot be undone.";
        }
        showDialog("custom-confirm-all");
    }

    function deleteAllTasks() {
        if (!pendingDeleteAll) return;
        tasks = [];
        pendingDeleteAll = false;
        saveTasks();
        renderTasks();
        hideDialog("custom-confirm-all");
        showMessage("success", "All tasks have been cleared.");
        resetForm();
    }

    function showDuplicateDialog() {
        showDialog("duplicate-task");
    }

    function sortByPriority(order) {
        const rank = { High: 3, Medium: 2, Low: 1 };
        tasks.sort((a, b) => {
            const difference = (rank[a.priority] || 0) - (rank[b.priority] || 0);
            return order === "lowToHigh" ? difference : -difference;
        });
        saveTasks();
        renderTasks();
        closeDropdown();
    }

    function sortByDueDate(order) {
        const value = (task) => task.dueDate ? new Date(`${task.dueDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
        tasks.sort((a, b) => {
            const difference = value(a) - value(b);
            return order === "late" ? -difference : difference;
        });
        saveTasks();
        renderTasks();
        closeDropdown();
    }

    function myFunction() {
        $("myDropdown")?.classList.toggle("show");
    }

    function closeDropdown() {
        $("myDropdown")?.classList.remove("show");
    }

    function clearAllTasks() {
        askDeleteAll();
    }

    function initDatePicker() {
        if (typeof window.flatpickr === "function" && $("dueDate")) {
            datePicker = window.flatpickr("#dueDate", {
                dateFormat: "Y-m-d",
                minDate: "today",
                allowInput: true
            });
        }
    }

    function setupDialogs() {
        $("confirm-yes")?.addEventListener("click", deleteSelectedTask);
        $("confirm-no")?.addEventListener("click", () => hideDialog("custom-confirm"));
        $("confirm-cancel")?.addEventListener("click", () => hideDialog("custom-confirm"));

        $("confirm-yes-all")?.addEventListener("click", deleteAllTasks);
        $("confirm-no-all")?.addEventListener("click", () => {
            pendingDeleteAll = false;
            hideDialog("custom-confirm-all");
        });
        $("confirm-cancel-all")?.addEventListener("click", () => {
            pendingDeleteAll = false;
            hideDialog("custom-confirm-all");
        });

        $("duplicate-ok")?.addEventListener("click", () => hideDialog("duplicate-task"));
        $("duplicate-cancel")?.addEventListener("click", () => hideDialog("duplicate-task"));

        ["custom-confirm", "custom-confirm-all", "duplicate-task"].forEach((id) => {
            $(id)?.addEventListener("click", (event) => {
                if (event.target === $(id)) hideDialog(id);
            });
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                hideDialog("custom-confirm");
                hideDialog("custom-confirm-all");
                hideDialog("duplicate-task");
                closeDropdown();
            }
        });
    }

    function setupVoiceCommands() {
        const button = $("voice-command-button");
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!button) return;

        if (!SpeechRecognition) {
            button.title = "Voice commands are not supported in this browser. Try Chrome.";
            button.addEventListener("click", () => {
                showMessage("error", "Voice commands are not supported in this browser.");
            });
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "en-IN";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        button.addEventListener("click", () => {
            try {
                recognition.start();
                showMessage("success", "Listening... Speak your task command.");
            } catch (error) {
                showMessage("error", "Voice recognition is already running. Please try again.");
            }
        });

        recognition.addEventListener("result", (event) => {
            const spoken = event.results[0][0].transcript.trim();
            handleVoiceCommand(spoken);
        });

        recognition.addEventListener("error", () => {
            showMessage("error", "Could not recognize your voice. Please try again.");
        });
    }

    function handleVoiceCommand(command) {
        const text = command.trim();
        const lower = text.toLowerCase();

        if (lower.startsWith("add ")) {
            const taskTitle = text.slice(4).replace(/\s+due\s+.+$/i, "").replace(/\s+priority\s+(low|medium|high)$/i, "").trim();
            const priorityMatch = lower.match(/\bpriority\s+(low|medium|high)\b/);
            const dateMatch = lower.match(/\bdue\s+(\d{4}-\d{2}-\d{2})\b/);

            if (!taskTitle) {
                showMessage("error", "Please say the task name after 'Add'.");
                return;
            }

            const input = $("item");
            if (input) input.value = taskTitle;
            if ($("priority")) $("priority").value = priorityMatch ? priorityMatch[1][0].toUpperCase() + priorityMatch[1].slice(1) : "Low";
            if ($("dueDate")) $("dueDate").value = dateMatch ? dateMatch[1] : "";
            if ($("description")) $("description").value = "";
            addOrUpdateTask();
            return;
        }

        if (lower.startsWith("delete task ")) {
            const target = lower.slice("delete task ".length).trim();
            const match = tasks.find((task) => task.title.toLowerCase() === target);
            if (match) askDelete(match.id);
            else showMessage("error", `Task "${target}" was not found.`);
            return;
        }

        if (lower.startsWith("edit task ")) {
            const remainder = text.slice("edit task ".length);
            const split = remainder.split(/\s+to\s+/i);
            const match = tasks.find((task) => task.title.toLowerCase() === split[0].trim().toLowerCase());
            if (match) {
                beginEdit(match.id);
                if (split[1]) {
                    const newTitle = split[1].split(/\s+due date\s+|\s+priority\s+/i)[0].trim();
                    if (newTitle) $("item").value = newTitle;
                }
                showMessage("success", "Task loaded for editing. Review it and press Update.");
            } else {
                showMessage("error", "The task to edit was not found.");
            }
            return;
        }

        showMessage("error", "Command not recognized. Try: Add study due 2026-12-01 priority High.");
    }

    function init() {
        loadTasks();
        initDatePicker();
        setupDialogs();
        setupVoiceCommands();

        $("addForm")?.addEventListener("submit", addOrUpdateTask);
        $("item")?.addEventListener("input", () => enableSubmit($("item"), "submitBtn"));
        $("searchBar")?.addEventListener("input", renderTasks);
        $("modeToggle")?.addEventListener("change", (event) => {
            document.body.classList.toggle("dark-mode", event.target.checked);
            try {
                localStorage.setItem("toDoListDarkMode", event.target.checked ? "1" : "0");
            } catch (_) {}
        });

        const savedTheme = localStorage.getItem("toDoListDarkMode") === "1";
        if ($("modeToggle")) $("modeToggle").checked = savedTheme;
        document.body.classList.toggle("dark-mode", savedTheme);

        renderTasks();
        enableSubmit($("item") || { value: "" }, "submitBtn");
    }

    // Functions used by inline HTML event attributes.
    window.enableSubmit = enableSubmit;
    window.myFunction = myFunction;
    window.sortByPriority = sortByPriority;
    window.sortByDueDate = sortByDueDate;
    window.clearAllTasks = clearAllTasks;
    window.init = init;

    document.addEventListener("DOMContentLoaded", init);
})();
