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
    const limitInput = document.getElementById('card-limit');
    const graceInput = document.getElementById('card-grace');
    const typeInput = document.getElementById('card-type');
    
    if (!nameInput.value || !limitInput.value || !graceInput.value) {
        return alert('Заполните все поля для создания карты');
    }
    
    cards.push({
        id: Date.now().toString(),
        name: nameInput.value,
        limit: parseFloat(limitInput.value),
        graceDays: parseInt(graceInput.value),
        type: typeInput.value
    });
    
    nameInput.value = ''; limitInput.value = ''; graceInput.value = '';
    saveData();
}

function deleteCard(id) {
    if (confirm('Удалить карту? Все привязанные к ней расходы также будут удалены.')) {
        cards = cards.filter(c => c.id !== id);
        transactions = transactions.filter(t => t.cardId !== id);
        saveData();
    }
}

function calculateGraceDeadline(dateStr, graceDays, cardType) {
    const parts = dateStr.split('-');
    let year = parseInt(parts[0]);
    let month = parseInt(parts[1]) - 1;
    let day = parseInt(parts[2]);

    let baseDate;
    if (cardType === 'month') {
        baseDate = new Date(year, month, 1, 12, 0, 0);
        baseDate.setDate(baseDate.getDate() + graceDays - 1);
    } else {
        baseDate = new Date(year, month, day, 12, 0, 0);
        baseDate.setDate(baseDate.getDate() + graceDays - 1);
    }
    return baseDate.toISOString().split('T')[0];
}

function calculateMinPaymentDate(purchaseDateStr) {
    const parts = purchaseDateStr.split('-');
    let year = parseInt(parts[0]);
    let month = parseInt(parts[1]) - 1; 
    let day = parseInt(parts[2]);

    let targetYear = year;
    let targetMonth = month;
    
    if (day >= 30) {
        targetMonth += 1;
        if (targetMonth > 11) { targetMonth = 0; targetYear += 1; }
    }
    
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
    const calculatedDeadline = calculateGraceDeadline(dateValue, card.graceDays, card.type);
    
    transactions.push({
        id: Date.now().toString(),
        cardId: cardId,
        cardName: card.name,
        amount: amount,
        date: dateValue,
        deadline: calculatedDeadline,
        minPaymentAmount: Math.round(amount * 0.035),
        minPaymentDeadline: calculateMinPaymentDate(dateValue)
    });
    
    document.getElementById('tx-amount').value = '';
    saveData();
}

function editTransaction(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    const newAmount = prompt(`Редактирование расхода.\nВведите новую сумму (текущая: ${tx.amount} ₽):`, tx.amount);
    if (newAmount === null) return;
    const parsedAmount = parseFloat(newAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return alert('Некорректная сумма');

    const newDate = prompt(`Введите новую дату в формате ГГГГ-ММ-ДД (текущая: ${tx.date}):`, tx.date);
    if (newDate === null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return alert('Неверный формат даты');

    const card = cards.find(c => c.id === tx.cardId);
    const cardType = card ? card.type : 'purchase';
    const cardGrace = card ? card.graceDays : 120;

    tx.amount = parsedAmount;
    tx.date = newDate;
    tx.deadline = calculateGraceDeadline(newDate, cardGrace, cardType);
    tx.minPaymentAmount = Math.round(parsedAmount * 0.035);
    tx.minPaymentDeadline = calculateMinPaymentDate(newDate);

    saveData();
}

function deleteTransaction(id) {
    if (confirm('Удалить эту запись о расходе?')) {
        transactions = transactions.filter(t => t.id !== id);
        saveData();
    }
}

function renderAll() {
    // Селектор карт
    const txCardSelect = document.getElementById('tx-card');
    txCardSelect.innerHTML = cards.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    // Калькуляция задолженностей по картам
    const cardStats = {};
    cards.forEach(c => {
        cardStats[c.id] = { totalSpent: 0, totalMinPay: 0, earliestDeadline: null, minPayDeadline: null };
    });
    
    transactions.forEach(t => {
        if (cardStats[t.cardId]) {
            cardStats[t.cardId].totalSpent += t.amount;
            cardStats[t.cardId].totalMinPay += t.minPaymentAmount;
            
            if (!cardStats[t.cardId].earliestDeadline || new Date(t.deadline) < new Date(cardStats[t.cardId].earliestDeadline)) {
                cardStats[t.cardId].earliestDeadline = t.deadline;
            }
            if (!cardStats[t.cardId].minPayDeadline || new Date(t.minPaymentDeadline) < new Date(cardStats[t.cardId].minPayDeadline)) {
                cardStats[t.cardId].minPayDeadline = t.minPaymentDeadline;
            }
        }
    });

    // Список карт в управлении
    const cardsManageList = document.getElementById('cards-manage-list');
    if(cards.length === 0) {
        cardsManageList.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">Карт пока нет.</p>`;
    } else {
        cardsManageList.innerHTML = cards.map(c => {
            const spent = cardStats[c.id] ? cardStats[c.id].totalSpent : 0;
            const remainingLimit = c.limit - spent;
            return `
                <div class="card card-manage-item">
                    <span><strong>${c.name}</strong><br>
                    <small style="color: var(--text-muted);">Лимит: ${c.limit.toLocaleString()} ₽ | Доступно: ${remainingLimit.toLocaleString()} ₽</small></span>
                    <button class="btn-danger-card" onclick="deleteCard('${c.id}')">Удалить</button>
                </div>
            `;
        }).join('');
    }

    // Общий долг
    const totalDebt = transactions.reduce((sum, t) => sum + t.amount, 0);
    document.getElementById('total-debt').innerText = totalDebt.toLocaleString('ru-RU') + ' ₽';

    // РЕНДЕРИНГ СВОДНОГО ТАЙМЛАЙНА ПО КАРТАМ
    const timelineList = document.getElementById('timeline-list');
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const activeCardsData = cards.map(c => {
        const stats = cardStats[c.id];
        return { card: c, stats: stats };
    }).filter(item => item.stats && item.stats.totalSpent > 0)
      .sort((a, b) => {
          if (!a.stats.earliestDeadline) return 1;
          if (!b.stats.earliestDeadline) return -1;
          return new Date(a.stats.earliestDeadline) - new Date(b.stats.earliestDeadline);
      });

    if(activeCardsData.length === 0) {
        timelineList.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">Нет активных задолженностей по картам.</p>`;
    } else {
        timelineList.innerHTML = activeCardsData.map(item => {
            const c = item.card;
            const s = item.stats;
            const diffDays = Math.ceil((new Date(s.earliestDeadline) - today) / (1000 * 60 * 60 * 24));
            const remainingLimit = c.limit - s.totalSpent;
            
            let statusClass = '';
            if (diffDays <= 7) statusClass = 'status-danger';
            else if (diffDays <= 30) statusClass = 'status-warning';
            
            return `
                <div class="card payment-item ${statusClass}">
                    <div class="payment-info">
                        <h4>${c.name}</h4>
                        <p>🔹 Обязательный мин. платеж: <strong>${s.totalMinPay.toLocaleString('ru-RU')} ₽</strong> до ${formatDate(s.minPayDeadline)}<br>
                        💳 Остаток лимита: <strong>${remainingLimit.toLocaleString('ru-RU')} ₽</strong> из ${c.limit.toLocaleString()} ₽</p>
                    </div>
                    <div class="payment-amount">
                        ${s.totalSpent.toLocaleString('ru-RU')} ₽
                        <span class="days-left ${diffDays <= 7 ? 'danger-text' : (diffDays <= 30 ? 'warning-text' : 'success-text')}">
                            Полный возврат до ${formatDate(s.earliestDeadline)} (${diffDays < 0 ? 'Просрочено' : 'Осталось дней: ' + diffDays})
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Детализация расходов (Таблица)
    const tableBody = document.getElementById('transactions-table-body');
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    
    if(transactions.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Трат не зафиксировано</td></tr>`;
    } else {
        tableBody.innerHTML = sortedTxs.map(t => `
            <tr>
                <td><strong>${t.cardName}</strong><br><span style="color:var(--text-muted); font-size:0.75rem;">от ${formatDate(t.date)}</span></td>
                <td>${t.amount.toLocaleString('ru-RU')} ₽</td>
