// Глобальные ссылки
let currentUser = null;
let tasksRef = null;
let liftsRef = null;
let usersRef = null;
let tasksUnsubscribe = null;

// Инициализация
async function init() {
    currentUser = await getCurrentUser();
    
    // Проверка роли
    const role = await getUserRole(currentUser.uid);
    if (role !== 'master') {
        window.location.href = 'mechanic.html';
        return;
    }
    
    document.getElementById('masterName').innerText = currentUser.email;
    
    // Ссылки на данные в Firebase
    tasksRef = db.ref('tasks');
    liftsRef = db.ref('lifts');
    usersRef = db.ref('users');
    
    // Подписка на реальные обновления
    subscribeToTasks();
    subscribeToLifts();
    
    // Инициализация UI
    initTabs();
    initCreateForm();
    setupEventListeners();
}

// Подписка на задачи в реальном времени
function subscribeToTasks() {
    tasksUnsubscribe = tasksRef.on('value', (snapshot) => {
        const tasksData = snapshot.val();
        const tasks = tasksData ? Object.entries(tasksData).map(([id, task]) => ({ id, ...task })) : [];
        
        renderDashboard(tasks);
        renderTasksList(tasks);
    });
}

// Подписка на лифты
function subscribeToLifts() {
    liftsRef.on('value', (snapshot) => {
        const liftsData = snapshot.val();
        const lifts = liftsData ? Object.entries(liftsData).map(([id, lift]) => ({ id, ...lift })) : [];
        renderLifts(lifts);
        updateLiftSelect(lifts);
    });
}

// Рендер дашборда
function renderDashboard(tasks) {
    const active = tasks.filter(t => t.status === 'assigned' || t.status === 'in_progress').length;
    const pending = tasks.filter(t => t.status === 'pending_review').length;
    const overdue = tasks.filter(t => t.status === 'overdue').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    
    document.getElementById('activeCount').innerText = active;
    document.getElementById('pendingCount').innerText = pending;
    document.getElementById('overdueCount').innerText = overdue;
    document.getElementById('completedCount').innerText = completed;
    
    const recent = [...tasks].sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0,5);
    const container = document.getElementById('recentTasksList');
    if (container) {
        container.innerHTML = recent.map(task => `
            <div class="task-item">
                <div><strong>${task.liftAddress}</strong><br><small>${task.type} | ${task.mechanicName}</small></div>
                <span class="task-status status-${task.status.replace('_','-')}">${getStatusText(task.status)}</span>
                <button onclick="viewTask('${task.id}')" class="btn-secondary">Детали</button>
            </div>
        `).join('');
    }
}

// Рендер списка заданий
function renderTasksList(tasks) {
    const filter = document.getElementById('statusFilter')?.value || 'all';
    const mechanicFilter = document.getElementById('mechanicFilter')?.value || 'all';
    const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
    
    let filtered = tasks.filter(t => {
        if (filter !== 'all' && t.status !== filter) return false;
        if (mechanicFilter !== 'all' && t.mechanicId !== mechanicFilter) return false;
        if (search && !t.liftAddress.toLowerCase().includes(search)) return false;
        return true;
    });
    
    const container = document.getElementById('tasksList');
    if (!container) return;
    container.innerHTML = filtered.map(task => `
        <div class="task-item">
            <div>
                <strong>${task.liftAddress}</strong><br>
                <small>${task.type} | ${task.mechanicName} | Срок: ${new Date(task.dueDate).toLocaleString()}</small>
            </div>
            <span class="task-status status-${task.status.replace('_','-')}">${getStatusText(task.status)}</span>
            <div>
                <button onclick="viewTask('${task.id}')" class="btn-secondary">Просмотр</button>
                ${task.status === 'pending_review' ? `<button onclick="approveTask('${task.id}')" class="btn-primary" style="background:#10b981;">✅ Принять</button>` : ''}
            </div>
        </div>
    `).join('');
}

// Просмотр задания
window.viewTask = async function(taskId) {
    const snapshot = await tasksRef.child(taskId).once('value');
    const task = snapshot.val();
    if (!task) return;
    
    const checklistHtml = task.checklistResults ? `
        <h4>Результаты чек-листа:</h4>
        <ul>
            ${Object.entries(task.checklistResults).map(([item, done]) => `<li>${done ? '✅' : '❌'} ${item}</li>`).join('')}
        </ul>
    ` : '';
    
    const modalHtml = `
        <div id="taskModal" class="modal">
            <div class="modal-content">
                <span class="modal-close" onclick="closeModal()">&times;</span>
                <h2>Задание #${taskId.slice(0,8)}</h2>
                <p><strong>Лифт:</strong> ${task.liftAddress}</p>
                <p><strong>Механик:</strong> ${task.mechanicName}</p>
                <p><strong>Тип ТО:</strong> ${task.type}</p>
                <p><strong>Срок:</strong> ${new Date(task.dueDate).toLocaleString()}</p>
                <p><strong>Статус:</strong> ${getStatusText(task.status)}</p>
                <p><strong>Описание:</strong> ${task.description || 'Нет'}</p>
                ${checklistHtml}
                ${task.report ? `<hr><h3>Отчет механика:</h3><p>${task.report.comment}</p><p>Фото: ${task.photos?.join(', ') || 'нет'}</p>` : '<p><em>Отчет еще не предоставлен</em></p>'}
                ${task.status === 'pending_review' ? `<button onclick="approveTask('${taskId}'); closeModal();" class="btn-primary">✅ Принять работу</button>
                <button onclick="rejectTask('${taskId}'); closeModal();" class="btn-danger" style="background:#dc2626;">❌ Отправить на доработку</button>` : ''}
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

// Принять задание
window.approveTask = async function(taskId) {
    await tasksRef.child(taskId).update({
        status: 'completed',
        updatedAt: Date.now()
    });
    alert('Работа принята!');
};

// Отклонить задание
window.rejectTask = async function(taskId) {
    await tasksRef.child(taskId).update({
        status: 'in_progress',
        report: null,
        photos: [],
        checklistResults: null,
        updatedAt: Date.now()
    });
    alert('Задание отправлено на доработку');
};

// Создание нового задания
function initCreateForm() {
    const form = document.getElementById('createTaskForm');
    if (!form) return;
    
    // Загружаем механиков из Firebase
    usersRef.orderByChild('role').equalTo('mechanic').once('value', (snapshot) => {
        const mechanics = [];
        snapshot.forEach((child) => {
            mechanics.push({
                id: child.key,
                name: child.val().name || child.val().email,
                email: child.val().email
            });
        });
        
        const mechanicSelect = document.getElementById('mechanicSelect');
        mechanicSelect.innerHTML = mechanics.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const liftId = document.getElementById('liftSelect').value;
        const liftSnapshot = await liftsRef.child(liftId).once('value');
        const lift = liftSnapshot.val();
        
        const mechanicId = document.getElementById('mechanicSelect').value;
        const mechanicSnapshot = await usersRef.child(mechanicId).once('value');
        const mechanic = mechanicSnapshot.val();
        
        const newTask = {
            liftId: liftId,
            liftAddress: lift.address,
            mechanicId: mechanicId,
            mechanicName: mechanic.name || mechanic.email,
            type: document.getElementById('toType').value,
            dueDate: document.getElementById('dueDate').value,
            status: 'assigned',
            description: document.getElementById('description').value,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        await tasksRef.push(newTask);
        alert('Задание создано и синхронизировано в облаке!');
        form.reset();
        document.querySelector('[data-tab="tasks"]').click();
    });
}

// Рендер лифтов
function renderLifts(lifts) {
    const container = document.getElementById('liftsList');
    if (!container) return;
    container.innerHTML = lifts.map(lift => `
        <div class="lift-card">
            <h3>${lift.address}</h3>
            <p>№ ${lift.liftNumber} | ${lift.type}</p>
            <button onclick="deleteLift('${lift.id}')" class="btn-danger">Удалить</button>
        </div>
    `).join('');
}

window.deleteLift = async function(id) {
    if (confirm('Удалить лифт?')) {
        await liftsRef.child(id).remove();
    }
};

function updateLiftSelect(lifts) {
    const select = document.getElementById('liftSelect');
    if (select) {
        select.innerHTML = lifts.map(lift => `<option value="${lift.id}">${lift.address} (${lift.liftNumber})</option>`).join('');
    }
}

document.getElementById('addLiftBtn')?.addEventListener('click', async () => {
    const newAddress = prompt('Введите адрес лифта:');
    if (newAddress) {
        await liftsRef.push({
            address: newAddress,
            liftNumber: `Л-${Math.floor(Math.random() * 999)}`,
            type: 'пассажирский',
            createdAt: Date.now()
        });
    }
});

function getStatusText(status) {
    const map = { assigned: 'Назначено', in_progress: 'В работе', pending_review: 'На проверке', completed: 'Завершено', overdue: 'Просрочено' };
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
            if (tab === 'create') initCreateForm();
        });
    });
}

function setupEventListeners() {
    document.getElementById('statusFilter')?.addEventListener('change', () => {
        tasksRef.once('value', (snapshot) => {
            const tasks = Object.values(snapshot.val() || {});
            renderTasksList(tasks);
        });
    });
    
    document.getElementById('searchInput')?.addEventListener('input', () => {
        tasksRef.once('value', (snapshot) => {
            const tasks = Object.values(snapshot.val() || {});
            renderTasksList(tasks);
        });
    });
}

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await auth.signOut();
    window.location.href = 'login.html';
});

// Запуск
init();