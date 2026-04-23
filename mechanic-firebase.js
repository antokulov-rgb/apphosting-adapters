let currentUser = null;
let mechanicLogin = null;

async function init() {
    currentUser = await getCurrentUser();
    mechanicLogin = localStorage.getItem('mechanicEmail') || currentUser.email.split('@')[0];
    
    document.getElementById('mechanicName').innerText = currentUser.email;
    
    // Подписка на задания только для этого механика
    const tasksRef = db.ref('tasks');
    tasksRef.orderByChild('mechanicId').equalTo(currentUser.uid).on('value', (snapshot) => {
        const tasksData = snapshot.val();
        const tasks = tasksData ? Object.entries(tasksData).map(([id, task]) => ({ id, ...task })) : [];
        renderMyTasks(tasks);
        renderHistory(tasks);
    });
    
    initTabs();
}

function renderMyTasks(tasks) {
    const filter = document.getElementById('taskStatusFilter')?.value || 'all';
    let filtered = tasks.filter(t => {
        if (filter !== 'all' && t.status !== filter) return false;
        return true;
    });
    
    const container = document.getElementById('myTasksList');
    if (!container) return;
    
    container.innerHTML = filtered.map(task => `
        <div class="task-item">
            <div>
                <strong>${task.liftAddress}</strong><br>
                <small>${task.type} | Срок: ${new Date(task.dueDate).toLocaleString()}</small>
            </div>
            <span class="task-status status-${task.status.replace('_','-')}">${getStatusText(task.status)}</span>
            <div>
                ${task.status === 'assigned' ? `<button onclick="startTask('${task.id}')" class="btn-primary">🔧 Начать ТО</button>` : ''}
                ${task.status === 'in_progress' ? `<button onclick="completeTask('${task.id}')" class="btn-primary">📸 Завершить</button>` : ''}
                <button onclick="viewTask('${task.id}')" class="btn-secondary">Детали</button>
            </div>
        </div>
    `).join('');
}

function renderHistory(tasks) {
    const completed = tasks.filter(t => t.status === 'completed');
    const container = document.getElementById('historyList');
    if (!container) return;
    
    container.innerHTML = completed.map(task => `
        <div class="task-item">
            <div><strong>${task.liftAddress}</strong><br><small>${task.type}</small></div>
            <button onclick="viewTask('${task.id}')" class="btn-secondary">Отчёт</button>
        </div>
    `).join('');
}

window.startTask = async function(taskId) {
    await db.ref(`tasks/${taskId}`).update({
        status: 'in_progress',
        updatedAt: Date.now()
    });
};

window.completeTask = async function(taskId) {
    const comment = prompt('Комментарий о выполненной работе:');
    if (!comment) return;
    
    await db.ref(`tasks/${taskId}`).update({
        status: 'pending_review',
        report: { comment: comment, timestamp: Date.now() },
        updatedAt: Date.now()
    });
    alert('Отчёт отправлен мастеру');
};

window.viewTask = async function(taskId) {
    const snapshot = await db.ref(`tasks/${taskId}`).once('value');
    const task = snapshot.val();
    
    const modalHtml = `
        <div id="taskModal" class="modal">
            <div class="modal-content">
                <span class="modal-close" onclick="closeModal()">&times;</span>
                <h2>Задание</h2>
                <p><strong>Лифт:</strong> ${task.liftAddress}</p>
                <p><strong>Тип ТО:</strong> ${task.type}</p>
                <p><strong>Срок:</strong> ${new Date(task.dueDate).toLocaleString()}</p>
                <p><strong>Статус:</strong> ${getStatusText(task.status)}</p>
                <p><strong>Описание:</strong> ${task.description || 'Нет'}</p>
                ${task.report ? `<hr><h3>Ваш отчёт:</h3><p>${task.report.comment}</p>` : ''}
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

function getStatusText(status) {
    const map = { assigned: 'Назначено', in_progress: 'В работе', pending_review: 'На проверке', completed: 'Завершено' };
    return map[status] || status;
}

function initTabs() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.getElementById(`${tab}Tab`).classList.add('active');
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await auth.signOut();
    localStorage.removeItem('mechanicEmail');
    window.location.href = 'login.html';
});

init();