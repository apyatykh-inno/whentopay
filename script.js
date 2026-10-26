// Инициализация локального хранилища в браузере смартфона
let cards = JSON.parse(localStorage.getItem('cards')) || [];
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];

// Установка текущей даты в инпут по умолчанию
document.getElementById('tx-date').valueAsDate = new Date();

// Функция сохранения данных
function saveData() {
    localStorage.setItem('cards', JSON.stringify(cards));
    localStorage.setItem('transactions', JSON.stringify(transactions));
    renderAll();
}

// Управление картами: Добавление
function addCard() {
    const nameInput = document.getElementById('card-name');
    const graceInput = document.getElementById('card-grace');
    
    if (!nameInput.value || !graceInput.value) return alert('Заполните все поля карты');
    
    const newCard = {
        id: Date.now().toString(),
        name: nameInput.value,
        graceDays: parseInt(graceInput.value)
    };
    
    cards.push(newCard);
    nameInput.value = '';
    graceInput.value = '';
    saveData();
}

// Управление картами: Удаление/Закрытие
function deleteCard(id) {
    if (confirm('Вы уверены, что хотите удалить карту? Все привязанные к ней траты также будут удалены.')) {
        cards = cards.filter(c => c.id !== id);
        transactions = transactions.filter(t => t.cardId !== id);
        saveData();
    }
}

// Управление тратами: Добавление
function addTransaction() {
    const cardId = document.getElementById('tx-card').value;
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const dateValue = document.getElementById('tx-date').value;
    
    if (!cardId || !amount || !dateValue) return alert('Заполните данные о покупке');
    
    const card = cards.find(c => c.id === cardId);
    
    // Вычисление автоматического дедлайна грейс-периода
    const purchaseDate = new Date(dateValue);
    const deadlineDate = new Date(purchaseDate);
    deadlineDate.setDate(purchaseDate.getDate() + card.graceDays);
    
    const newTx = {
        id: Date.now().toString(),
        cardId: cardId,
        cardName: card.name,
        amount: amount,
        date: dateValue,
        deadline: deadlineDate.toISOString().split('T')[0]
    };
    
    transactions.push(newTx);
    document.getElementById('tx-amount').value = '';
    saveData();
}

// Основная функция отрисовки интерфейса
function renderAll() {
    // 1. Обновление селектора карт в форме расхода
    const txCardSelect = document.getElementById('tx-card');
    txCardSelect.innerHTML = cards.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    // 2. Рендеринг списка управления картами
    const cardsManageList = document.getElementById('cards-manage-list');
    if(cards.length === 0) {
        cardsManageList.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">Карт пока нет. Добавьте первую карту ниже.</p>`;
    } else {
        cardsManageList.innerHTML = cards.map(c => `
            <div class="card card-manage-item">
                <span><strong>${c.name}</strong> (${c.graceDays} дн. грейс)</span>
                <button class="btn-danger" onclick="deleteCard('${c.id}')">Закрыть</button>
            </div>
        `).join('');
    }

    // 3. Расчет общего долга
    const totalDebt = transactions.reduce((sum, t) => sum + t.amount, 0);
    document.getElementById('total-debt').innerText = totalDebt.toLocaleString('ru-RU') + ' ₽';

    // 4. Расчет и рендеринг Таймлайна дедлайнов (ближайшие выплаты)
    const timelineList = document.getElementById('timeline-list');
    const today = new Date();
    
    // Сортируем транзакции по дате окончания грейса
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    
    if(sortedTxs.length === 0) {
        timelineList.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">Ближайших выплат нет. У вас беспроцентный штиль.</p>`;
    } else {
        timelineList.innerHTML = sortedTxs.map(t => {
            const diffTime = new Date(t.deadline) - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let statusClass = '';
            let textClass = 'success-text';
            let daysText = `Осталось дней: ${diffDays}`;
            
            if (diffDays <= 7) {
                statusClass = 'status-danger';
                textClass = 'danger-text';
            } else if (diffDays <= 30) {
                statusClass = 'status-warning';
                textClass = 'warning-text';
            }
            
            if (diffDays < 0) {
                daysText = `ПРОСРОЧЕНО НА ${Math.abs(diffDays)} ДН.`;
                textClass = 'danger-text';
            }
            
            return `
                <div class="card payment-item ${statusClass}">
                    <div class="payment-info">
                        <h4>${t.cardName}</h4>
                        <p>Покупка от ${formatDate(t.date)}</p>
                    </div>
                    <div class="payment-amount">
                        ${t.amount.toLocaleString('ru-RU')} ₽
                        <span class="days-left ${textClass}">${daysText} (до ${formatDate(t.deadline)})</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 5. Заполнение сводной таблицы детализации расходов
    const tableBody = document.getElementById('transactions-table-body');
    if(transactions.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Трат не зафиксировано</td></tr>`;
    } else {
        tableBody.innerHTML = sortedTxs.map(t => `
            <tr>
                <td><strong>${t.cardName}</strong></td>
                <td>${t.amount.toLocaleString('ru-RU')} ₽</td>
                <td>${formatDate(t.date)}</td>
                <td>${formatDate(t.deadline)}</td>
            </tr>
        `).join('');
    }
}

// Хелпер форматирования даты в читаемый вид (ДД.ММ.ГГГГ)
function formatDate(dateString) {
    const d = new Date(dateString);
    return d.toLocaleDateString('ru-RU');
}

// Запуск первичного рендеринга при открытии страницы
renderAll();
