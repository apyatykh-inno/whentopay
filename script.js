let cards = JSON.parse(localStorage.getItem('cards')) || [];
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];

document.getElementById('tx-date').valueAsDate = new Date();

function saveData() {
    localStorage.setItem('cards', JSON.stringify(cards));
    localStorage.setItem('transactions', JSON.stringify(transactions));
    renderAll();
}

function addCard() {
    const nameInput = document.getElementById('card-name');
    const graceInput = document.getElementById('card-grace');
    if (!nameInput.value || !graceInput.value) return alert('Заполните все поля карты');
    
    cards.push({
        id: Date.now().toString(),
        name: nameInput.value,
        graceDays: parseInt(graceInput.value)
    });
    nameInput.value = ''; graceInput.value = '';
    saveData();
}

function deleteCard(id) {
    if (confirm('Удалить карту? Все привязанные к ней расходы также будут удалены.')) {
        cards = cards.filter(c => c.id !== id);
        transactions = transactions.filter(t => t.cardId !== id);
        saveData();
    }
}

// Функция автоматического расчета дедлайна минимального платежа (30-е число текущего/следующего месяца)
function calculateMinPaymentDate(purchaseDateStr) {
    const pDate = new Date(purchaseDateStr);
    let targetYear = pDate.getFullYear();
    let targetMonth = pDate.getMonth(); // Текущий месяц покупки
    
    // Если покупка сделана 30-го или 31-го числа, минимальный платеж переносится на 30-е число следующего месяца
    if (pDate.getDate() >= 30) {
        targetMonth += 1;
        if (targetMonth > 11) {
            targetMonth = 0;
            targetYear += 1;
        }
    }
    
    // Февраль контролируем отдельно (у него нет 30-го числа, ставим последний день февраля)
    if (targetMonth === 1) {
        const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
        return `${targetYear}-02-${isLeap ? '29' : '28'}`;
    }
    
    const monthFormatted = String(targetMonth + 1).padStart(2, '0');
    return `${targetYear}-${monthFormatted}-30`;
}

function addTransaction() {
    const cardId = document.getElementById('tx-card').value;
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const dateValue = document.getElementById('tx-date').value;
    
    if (!cardId || isNaN(amount) || !dateValue) return alert('Заполните корректно данные о покупке');
    
    const card = cards.find(c => c.id === cardId);
    const purchaseDate = new Date(dateValue);
    const deadlineDate = new Date(purchaseDate);
    deadlineDate.setDate(purchaseDate.getDate() + card.graceDays);
    
    transactions.push({
        id: Date.now().toString(),
        cardId: cardId,
        cardName: card.name,
        amount: amount,
        date: dateValue,
        deadline: deadlineDate.toISOString().split('T')[0],
        minPaymentAmount: Math.round(amount * 0.035), // Среднее значение 3.5%
        minPaymentDeadline: calculateMinPaymentDate(dateValue)
    });
    
    document.getElementById('tx-amount').value = '';
    saveData();
}

// ФУНКЦИЯ ИЗМЕНЕНИЯ РАСХОДА
function editTransaction(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    const newAmount = prompt(`Редактирование расхода.\nВведите новую сумму (текущая: ${tx.amount} ₽):`, tx.amount);
    if (newAmount === null) return; // Отмена
    
    const parsedAmount = parseFloat(newAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return alert('Введена некорректная сумма');

    const newDate = prompt(`Введите новую дату покупки в формате ГГГГ-ММ-СС (текущая: ${tx.date}):`, tx.date);
    if (newDate === null) return;
    
    const checkDate = new Date(newDate);
    if (isNaN(checkDate.getTime())) return alert('Неверный формат даты');

    // Пересчитываем параметры на основе новой даты и суммы
    const card = cards.find(c => c.id === tx.cardId);
    const purchaseDate = new Date(newDate);
    const deadlineDate = new Date(purchaseDate);
    deadlineDate.setDate(purchaseDate.getDate() + (card ? card.graceDays : 120));

    tx.amount = parsedAmount;
    tx.date = newDate;
    tx.deadline = deadlineDate.toISOString().split('T')[0];
    tx.minPaymentAmount = Math.round(parsedAmount * 0.035);
    tx.minPaymentDeadline = calculateMinPaymentDate(newDate);

    saveData();
}

// ФУНКЦИЯ УДАЛЕНИЯ РАСХОДА
function deleteTransaction(id) {
    if (confirm('Вы действительно хотите удалить эту запись о расходе?')) {
        transactions = transactions.filter(t => t.id !== id);
        saveData();
    }
}

function renderAll() {
    const txCardSelect = document.getElementById('tx-card');
    txCardSelect.innerHTML = cards.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    const cardsManageList = document.getElementById('cards-manage-list');
    if(cards.length === 0) {
        cardsManageList.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">Карт пока нет.</p>`;
    } else {
        cardsManageList.innerHTML = cards.map(c => `
            <div class="card card-manage-item">
                <span><strong>${c.name}</strong> (${c.graceDays} дн. грейс)</span>
                <button class="btn-danger-card" onclick="deleteCard('${c.id}')">Удалить карту</button>
            </div>
        `).join('');
    }

    const totalDebt = transactions.reduce((sum, t) => sum + t.amount, 0);
    document.getElementById('total-debt').innerText = totalDebt.toLocaleString('ru-RU') + ' ₽';

    const timelineList = document.getElementById('timeline-list');
    const today = new Date();
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    
    if(sortedTxs.length === 0) {
        timelineList.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">Ближайших выплат нет.</p>`;
    } else {
        timelineList.innerHTML = sortedTxs.map(t => {
            const diffDays = Math.ceil((new Date(t.deadline) - today) / (1000 * 60 * 60 * 24));
            let statusClass = ''; let textClass = 'success-text';
            
            if (diffDays <= 7) statusClass = 'status-danger';
            else if (diffDays <= 30) statusClass = 'status-warning';
            
            return `
                <div class="card payment-item ${statusClass}">
                    <div class="payment-info">
                        <h4>${t.cardName}</h4>
                        <p>Покупка от ${formatDate(t.date)}<br>
                        🔹 Обязательный мин. платеж: <strong>${t.minPaymentAmount.toLocaleString('ru-RU')} ₽</strong> до ${formatDate(t.minPaymentDeadline)}</p>
                    </div>
                    <div class="payment-amount">
                        ${t.amount.toLocaleString('ru-RU')} ₽
                        <span class="days-left ${diffDays <= 7 ? 'danger-text' : (diffDays <= 30 ? 'warning-text' : 'success-text')}">
                            Полный возврат до ${formatDate(t.deadline)} (${diffDays < 0 ? 'Просрочено' : 'Осталось дней: ' + diffDays})
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    const tableBody = document.getElementById('transactions-table-body');
    if(transactions.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Трат не зафиксировано</td></tr>`;
    } else {
        tableBody.innerHTML = sortedTxs.map(t => `
            <tr>
                <td><strong>${t.cardName}</strong><br><span style="color:var(--text-muted); font-size:0.75rem;">от ${formatDate(t.date)}</span></td>
                <td>${t.amount.toLocaleString('ru-RU')} ₽</td>
                <td>${t.minPaymentAmount.toLocaleString('ru-RU')} ₽<br><span style="color:var(--text-muted); font-size:0.75rem;">до ${formatDate(t.minPaymentDeadline)}</span></td>
                <td>${formatDate(t.deadline)}</td>
                <td class="td-actions">
                    <button class="btn-action edit" onclick="editTransaction('${t.id}')">Изм.</button>
                    <button class="btn-action delete" onclick="deleteTransaction('${t.id}')">Уд.</button>
                </td>
            </tr>
        `).join('');
    }
}

function formatDate(dateString) {
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? dateString : d.toLocaleDateString('ru-RU');
}

renderAll();
