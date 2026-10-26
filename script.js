var cards = JSON.parse(localStorage.getItem('cards')) || [];
var transactions = JSON.parse(localStorage.getItem('transactions')) || [];

if (document.getElementById('tx-date')) {
    document.getElementById('tx-date').valueAsDate = new Date();
}

var now = new Date();
if (document.getElementById('report-start')) {
    document.getElementById('report-start').valueAsDate = new Date(now.getFullYear(), now.getMonth(), 1);
}
if (document.getElementById('report-end')) {
    document.getElementById('report-end').valueAsDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
}

function saveData() {
    localStorage.setItem('cards', JSON.stringify(cards));
    localStorage.setItem('transactions', JSON.stringify(transactions));
    renderAll();
}

// НАЙДЕНО И ИСПРАВЛЕНО: Безопасное форматирование даты из ГГГГ-ММ-ДД в ДД.ММ.ГГГГ
function cleanFormatDate(dateStr) {
    if (!dateStr) return '-';
    var cleanStr = dateStr.split('T')[0];
    var arr = cleanStr.split('-');
    if (arr.length !== 3) return dateStr;
    return [arr[2], arr[1], arr[0]].join('.');
}
function calculateGraceDeadline(dateStr, graceDays, cardType) {
    var parts = dateStr.split('-');
    var year = parseInt(parts[0]);
    var month = parseInt(parts[1]) - 1;
    var day = parseInt(parts[2]);
    var baseDate;
    if (cardType === 'month') {
        baseDate = new Date(year, month, 1, 12, 0, 0);
    } else {
        baseDate = new Date(year, month, day, 12, 0, 0);
    }
    baseDate.setDate(baseDate.getDate() + graceDays - 1);
    return baseDate.toISOString().split('T')[0];
}

function calculateMinPaymentDate(purchaseDateStr) {
    var parts = purchaseDateStr.split('-');
    var year = parseInt(parts[0]);
    var month = parseInt(parts[1]) - 1; 
    var day = parseInt(parts[2]);
    var targetYear = year;
    var targetMonth = month;
    if (day >= 30) {
        targetMonth += 1;
        if (targetMonth > 11) { targetMonth = 0; targetYear += 1; }
    }
    if (targetMonth === 1) {
        var isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
        return [targetYear, '02', isLeap ? '29' : '28'].join('-');
    }
    var monthFormatted = String(targetMonth + 1).padStart(2, '0');
    return [targetYear, monthFormatted, '30'].join('-');
}

function addCard() {
    var name = document.getElementById('card-name').value;
    var limit = document.getElementById('card-limit').value;
    var grace = document.getElementById('card-grace').value;
    var type = document.getElementById('card-type').value;
    if (!name || !limit || !grace) return alert('Заполните поля');
    cards.push({ id: Date.now().toString(), name: name, limit: parseFloat(limit), graceDays: parseInt(grace), type: type });
    document.getElementById('card-name').value = '';
    document.getElementById('card-limit').value = '';
    document.getElementById('card-grace').value = '';
    saveData();
}

function deleteCard(id) {
    if (confirm('Удалить карту?')) {
        cards = cards.filter(function(c) { return c.id !== id; });
        transactions = transactions.filter(function(t) { return t.cardId !== id; });
        saveData();
    }
}

function addTransaction() {
    var cardId = document.getElementById('tx-card').value;
    var amount = parseFloat(document.getElementById('tx-amount').value);
    var dateValue = document.getElementById('tx-date').value;
    if (!cardId || isNaN(amount) || !dateValue) return alert('Заполните данные');
    var card = cards.find(function(c) { return c.id === cardId; });
    transactions.push({
        id: Date.now().toString(), cardId: cardId, cardName: card.name, amount: amount, date: dateValue,
        deadline: calculateGraceDeadline(dateValue, card.graceDays, card.type),
        minPaymentAmount: Math.round(amount * 0.035), minPaymentDeadline: calculateMinPaymentDate(dateValue)
    });
    document.getElementById('tx-amount').value = '';
    saveData();
}

function editTransaction(id) {
    var tx = transactions.find(function(t) { return t.id === id; });
    if (!tx) return;
    var newAmount = prompt('Сумма:', tx.amount);
    if (newAmount === null) return;
    var newDate = prompt('Дата (ГГГГ-ММ-ДД):', tx.date);
    if (newDate === null || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return alert('Ошибка');
    var card = cards.find(function(c) { return c.id === tx.cardId; });
    tx.amount = parseFloat(newAmount);
    tx.date = newDate;
    tx.deadline = calculateGraceDeadline(newDate, card.graceDays, card.type);
    tx.minPaymentAmount = Math.round(tx.amount * 0.035);
    tx.minPaymentDeadline = calculateMinPaymentDate(newDate);
    saveData();
}

function deleteTransaction(id) {
    if (confirm('Удалить расход?')) {
        transactions = transactions.filter(function(t) { return t.id !== id; });
        saveData();
    }
}

function generateReport() {
    var sVal = document.getElementById('report-start').value;
    var eVal = document.getElementById('report-end').value;
    var resultDiv = document.getElementById('report-result');
    if (!sVal || !eVal) return alert('Выберите даты');
    var startDate = new Date(sVal); var endDate = new Date(eVal); endDate.setHours(23,59,59,999);
    var filtered = transactions.filter(function(t) { var d = new Date(t.date); return d >= startDate && d <= endDate; });
    if (filtered.length === 0) { resultDiv.innerHTML = '<p style="color:var(--text-muted); margin-top:15px;">Трат нет.</p>'; return; }
    var rData = {};
    filtered.forEach(function(t) {
        if (!rData[t.cardId]) rData[t.cardId] = { name: t.cardName, total: 0, count: 0 };
        rData[t.cardId].total += t.amount; rData[t.cardId].count++;
    });
    var total = filtered.reduce(function(s, t) { return s + t.amount; }, 0);
    var html = ['<div style="margin-top:15px; border-top:1px dashed #ccc; padding-top:10px;"><h4>Сводный отчет</h4><table><thead><tr><th>Карта</th><th>Трат</th><th style="text-align:right;">Сумма</th></tr></thead><tbody>'];
    for (var cid in rData) { html.push('<tr><td>' + rData[cid].name + '</td><td>' + rData[cid].count + '</td><td style="text-align:right;">' + rData[cid].total.toLocaleString('ru-RU') + ' ₽</td></tr>'); }
    html.push('<tr style="font-weight:bold;"><td>ИТОГО:</td><td>' + filtered.length + '</td><td style="text-align:right;">' + total.toLocaleString('ru-RU') + ' ₽</td></tr></tbody></table></div>');
    resultDiv.innerHTML = html.join('');
}
function renderAll() {
    var txCardSelect = document.getElementById('tx-card');
    if (txCardSelect) {
        txCardSelect.innerHTML = cards.map(function(c) { return ['<option value="', c.id, '">', c.name, '</option>'].join(''); }).join('');
    }
    var cardStats = {};
    cards.forEach(function(c) { cardStats[c.id] = { totalSpent: 0, totalMinPay: 0, earliestDeadline: null, minPayDeadline: null }; });
    transactions.forEach(function(t) {
        if (cardStats[t.cardId]) {
            cardStats[t.cardId].totalSpent += t.amount;
            cardStats[t.cardId].totalMinPay += t.minPaymentAmount;
            if (!cardStats[t.cardId].earliestDeadline || new Date(t.deadline) < new Date(cardStats[t.cardId].earliestDeadline)) { cardStats[t.cardId].earliestDeadline = t.deadline; }
            if (!cardStats[t.cardId].minPayDeadline || new Date(t.minPaymentDeadline) < new Date(cardStats[t.cardId].minPayDeadline)) { cardStats[t.cardId].minPayDeadline = t.minPaymentDeadline; }
        }
    });

    var cardsManageList = document.getElementById('cards-manage-list');
    if (cardsManageList) {
        cardsManageList.innerHTML = cards.length === 0 ? '<p style="color:var(--text-muted); font-size:0.9rem;">Карт пока нет.</p>' : cards.map(function(c) {
            var spent = cardStats[c.id] ? cardStats[c.id].totalSpent : 0;
            return ['<div class="card-manage-item"><span><strong>', c.name, '</strong><br><small style="color: var(--text-muted);">Лимит: ', c.limit.toLocaleString(), ' ₽ | Доступно: ', (c.limit - spent).toLocaleString(), ' ₽</small></span><button class="btn-danger-card" onclick="deleteCard(\'', c.id, '\')">Удалить</button></div>'].join('');
        }).join('');
    }

    var totalDebtEl = document.getElementById('total-debt');
    if (totalDebtEl) {
        totalDebtEl.innerText = transactions.reduce(function(sum, t) { return sum + t.amount; }, 0).toLocaleString('ru-RU') + ' ₽';
    }

    var timelineList = document.getElementById('timeline-list');
    if (timelineList) {
        var today = new Date(); today.setHours(0,0,0,0);
        var activeCards = cards.map(function(c) { return { card: c, stats: cardStats[c.id] }; })
            .filter(function(item) { return item.stats && item.stats.totalSpent > 0; })
            .sort(function(a, b) { return new Date(a.stats.earliestDeadline) - new Date(b.stats.earliestDeadline); });

        timelineList.innerHTML = activeCards.length === 0 ? '<p style="color:var(--text-muted); font-size:0.9rem;">Нет активных задолженностей.</p>' : activeCards.map(function(item) {
            var c = item.card; var s = item.stats;
            var diffDays = Math.ceil((new Date(s.earliestDeadline) - today) / (1000 * 60 * 60 * 24));
            var statusClass = diffDays <= 7 ? 'status-danger' : (diffDays <= 30 ? 'status-warning' : '');
            var diffClass = diffDays <= 7 ? 'danger-text' : (diffDays <= 30 ? 'warning-text' : 'success-text');
            return ['<div class="card payment-item ', statusClass, '"><div class="payment-info"><h4>', c.name, '</h4><p>🔹 Мин. платеж: <strong>', s.totalMinPay.toLocaleString('ru-RU'), ' ₽</strong> до ', cleanFormatDate(s.minPayDeadline), '<br>💳 Доступно: <strong>', (c.limit - s.totalSpent).toLocaleString('ru-RU'), ' ₽</strong> из ', c.limit.toLocaleString(), '</p></div><div class="payment-amount">', s.totalSpent.toLocaleString('ru-RU'), ' ₽<span class="days-left ', diffClass, '">Грейс до ', cleanFormatDate(s.earliestDeadline), ' (Ост. дней: ', diffDays, ')</span></div></div>'].join('');
        }).join('');
    }

    var tableBody = document.getElementById('transactions-table-body');
    if (tableBody) {
        var sortedTxs = [...transactions].sort(function(a, b) { return new Date(a.deadline) - new Date(b.deadline); });
        tableBody.innerHTML = transactions.length === 0 ? '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Трат нет</td></tr>' : sortedTxs.map(function(t) {
            var rangeStr = Math.round(t.amount * 0.02).toLocaleString('ru-RU') + '–' + Math.round(t.amount * 0.05).toLocaleString('ru-RU') + ' ₽';
            return ['<tr><td><strong>', t.cardName, '</strong><br><small style="color:var(--text-muted);">от ', cleanFormatDate(t.date), '</small></td><td>', t.amount.toLocaleString('ru-RU'), ' ₽</td><td>', rangeStr, '<br><small style="color:var(--text-muted);">до ', cleanFormatDate(t.minPaymentDeadline), '</small></td><td class="td-actions"><button class="btn-action edit-icon" onclick="editTransaction(\'', t.id, '\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button><button class="btn-action delete-icon" onclick="deleteTransaction(\'', t.id, '\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td></tr>'].join('');
        }).join('');
    }
}
renderAll();
