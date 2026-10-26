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

// ИСПРАВЛЕНО И ВОССТАНОВЛЕНО: Оригинальный безопасный парсинг даты
function cleanFormatDate(dateStr) {
    if (!dateStr) return '-';
    var cleanStr = String(dateStr).split('T')[0];
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
        var febDay = isLeap ? '29' : '28';
        return [targetYear, '02', febDay].join('-');
    }
    
    var monthFormatted = String(targetMonth + 1).padStart(2, '0');
    return [targetYear, monthFormatted, '30'].join('-');
}

function addCard() {
    var nameInput = document.getElementById('card-name');
    var limitInput = document.getElementById('card-limit');
    var graceInput = document.getElementById('card-grace');
    var typeInput = document.getElementById('card-type');
    
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
    if (confirm('Удалить карту? Все расходы по ней также будут удалены.')) {
        cards = cards.filter(function(c) { return c.id !== id; });
        transactions = transactions.filter(function(t) { return t.cardId !== id; });
        saveData();
    }
}

function addTransaction() {
    var cardId = document.getElementById('tx-card').value;
    var amount = parseFloat(document.getElementById('tx-amount').value);
    var dateValue = document.getElementById('tx-date').value;
    
    if (!cardId || isNaN(amount) || !dateValue) return alert('Заполните корректно данные о покупке');
    
    var card = cards.find(function(c) { return c.id === cardId; });
    var calculatedDeadline = calculateGraceDeadline(dateValue, card.graceDays, card.type);
    
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
    var tx = transactions.find(function(t) { return t.id === id; });
    if (!tx) return;

    var newAmount = prompt('Редактирование расхода.\nВведите новую сумму:', tx.amount);
    if (newAmount === null) return;
    var parsedAmount = parseFloat(newAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return alert('Некорректная сумма');

    var newDate = prompt('Введите новую дату в формате ГГГГ-ММ-ДД:', tx.date);
    if (newDate === null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return alert('Неверный формат даты');

    var card = cards.find(function(c) { return c.id === tx.cardId; });

    tx.amount = parsedAmount;
    tx.date = newDate;
    tx.deadline = calculateGraceDeadline(newDate, card.graceDays, card.type);
    tx.minPaymentAmount = Math.round(parsedAmount * 0.035);
    tx.minPaymentDeadline = calculateMinPaymentDate(newDate);

    saveData();
}

function deleteTransaction(id) {
    if (confirm('Удалить эту запись о расходе?')) {
        transactions = transactions.filter(function(t) { return t.id !== id; });
        saveData();
    }
}

function generateReport() {
    var startVal = document.getElementById('report-start').value;
    var endVal = document.getElementById('report-end').value;
    var resultDiv = document.getElementById('report-result');
    
    if (!startVal || !endVal) return alert('Выберите начальную и конечную дату периода');
    
    var startDate = new Date(startVal);
    var endDate = new Date(endVal);
    endDate.setHours(23, 59, 59, 999);
    
    var filteredTxs = transactions.filter(function(t) {
        var txDate = new Date(t.date);
        return txDate >= startDate && txDate <= endDate;
    });
    
    if (filteredTxs.length === 0) {
        resultDiv.innerHTML = '<p style="color:var(--text-muted); margin-top:15px;">За выбранный период трат не найдено.</p>';
        return;
    }
    
    var reportData = {};
    filteredTxs.forEach(function(t) {
        if (!reportData[t.cardId]) {
            reportData[t.cardId] = { cardName: t.cardName, total: 0, itemsCount: 0 };
        }
        reportData[t.cardId].total += t.amount;
        reportData[t.cardId].itemsCount += 1;
    });
    
    var totalPeriodSpent = filteredTxs.reduce(function(sum, t) { return sum + t.amount; }, 0);
    
    var html = [
        '<div style="margin-top:20px; border-top:1px dashed #ccc; padding-top:15px;">',
        '<h4>Результат отчета с ', cleanFormatDate(startVal), ' по ', cleanFormatDate(endVal), '</h4>',
        '<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.9rem;">',
        '<thead><tr style="border-bottom:2px solid #ccc; text-align:left;">',
        '<th style="padding:6px;">Название карты</th>',
        '<th style="padding:6px; text-align:center;">Кол-во трат</th>',
        '<th style="padding:6px; text-align:right;">Сумма трат</th>',
        '</tr></thead><tbody>'
    ];
    
    for (var cardId in reportData) {
        var r = reportData[cardId];
        html.push('<tr><td style="padding:6px;"><strong>' + r.cardName + '</strong></td><td style="padding:6px; text-align:center;">' + r.itemsCount + '</td><td style="padding:6px; text-align:right;">' + r.total.toLocaleString('ru-RU') + ' ₽</td></tr>');
    }
    
    html.push('<tr style="font-weight:bold; background:rgba(0,0,0,0.05);"><td style="padding:6px;">ИТОГО ЗА ПЕРИОД:</td><td style="padding:6px; text-align:center;">' + filteredTxs.length + '</td><td style="padding:6px; text-align:right; color:#e74c3c;">' + totalPeriodSpent.toLocaleString('ru-RU') + ' ₽</td></tr></tbody></table></div>');
    resultDiv.innerHTML = html.join('');
}
function renderAll() {
    var txCardSelect = document.getElementById('tx-card');
    if (txCardSelect) {
        txCardSelect.innerHTML = cards.map(function(c) { 
            return ['<option value="', c.id, '">', c.name, '</option>'].join(''); 
        }).join('');
    }
    
    var cardStats = {};
    cards.forEach(function(c) {
        cardStats[c.id] = { totalSpent: 0, totalMinPay: 0, earliestDeadline: null, minPayDeadline: null };
    });
    
    transactions.forEach(function(t) {
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

    var cardsManageList = document.getElementById('cards-manage-list');
    if (cardsManageList) {
        if (cards.length === 0) {
            cardsManageList.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">Карт пока нет.</p>';
        } else {
            cardsManageList.innerHTML = cards.map(function(c) {
                var spent = cardStats[c.id] ? cardStats[c.id].totalSpent : 0;
                var remainingLimit = c.limit - spent;
                return ['<div class="card card-manage-item"><span><strong>', c.name, '</strong><br><small style="color: var(--text-muted);">Лимит: ', c.limit.toLocaleString(), ' ₽ | Доступно: ', remainingLimit.toLocaleString(), ' ₽</small></span><button class="btn-danger-card" onclick="deleteCard(\'', c.id, '\')">Удалить</button></div>'].join('');
            }).join('');
        }
    }

    var totalDebtEl = document.getElementById('total-debt');
    var totalDebt = transactions.reduce(function(sum, t) { return sum + t.amount; }, 0);
    if (totalDebtEl) {
        totalDebtEl.innerText = totalDebt.toLocaleString('ru-RU') + ' ₽';
    }

    var timelineList = document.getElementById('timeline-list');
    if (timelineList) {
        var today = new Date();
        today.setHours(0,0,0,0);
        
        var activeCardsData = cards.map(function(c) {
            return { card: c, stats: cardStats[c.id] };
        }).filter(function(item) { return item.stats && item.stats.totalSpent > 0; })
          .sort(function(a, b) {
              if (!a.stats.earliestDeadline) return 1;
              if (!b.stats.earliestDeadline) return -1;
              return new Date(a.stats.earliestDeadline) - new Date(b.stats.earliestDeadline);
          });

        if (activeCardsData.length === 0) {
            timelineList.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">Нет активных задолженностей по картам.</p>';
        } else {
            timelineList.innerHTML = activeCardsData.map(function(item) {
                var c = item.card;
                var s = item.stats;
                var diffDays = Math.ceil((new Date(s.earliestDeadline) - today) / (1000 * 60 * 60 * 24));
                var remainingLimit = c.limit - s.totalSpent;
                
                var statusClass = '';
                if (diffDays <= 7) statusClass = 'status-danger';
                else if (diffDays <= 30) statusClass = 'status-warning';
                
                var statusText = diffDays < 0 ? 'Просрочено' : 'Осталось дней: ' + diffDays;
                var diffClass = diffDays <= 7 ? 'danger-text' : (diffDays <= 30 ? 'warning-text' : 'success-text');
                
                return ['<div class="card payment-item ', statusClass, '"><div class="payment-info"><h4>', c.name, '</h4><p>🔹 Обязательный мин. платеж: <strong>', s.totalMinPay.toLocaleString('ru-RU'), ' ₽</strong> до ', cleanFormatDate(s.minPayDeadline), '<br>💳 Остаток лимита: <strong>', remainingLimit.toLocaleString('ru-RU'), ' ₽</strong> из ', c.limit.toLocaleString(), ' ₽</p></div><div class="payment-amount">', s.totalSpent.toLocaleString('ru-RU'), ' ₽<span class="days-left ', diffClass, '">Полный возврат до ', cleanFormatDate(s.earliestDeadline), ' (', statusText, ')</span></div></div>'].join('');
            }).join('');
        }
    }

    var tableBody = document.getElementById('transactions-table-body');
    if (tableBody) {
        var sortedTxs = [...transactions].sort(function(a, b) { return new Date(a.deadline) - new Date(b.deadline); });
        
        if (transactions.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Трат не зафиксировано</td></tr>';
        } else {
            tableBody.innerHTML = sortedTxs.map(function(t) {
                var minRange = Math.round(t.amount * 0.02);
                var maxRange = Math.round(t.amount * 0.05);
                var rangeStr = minRange.toLocaleString('ru-RU') + '–' + maxRange.toLocaleString('ru-RU') + ' ₽';

                return [
                    '<tr>',
                        '<td><strong>', t.cardName, '</strong><br><span style="color:var(--text-muted); font-size:0.75rem;">от ', cleanFormatDate(t.date), '</span></td>',
                        '<td>', t.amount.toLocaleString('ru-RU'), ' ₽</td>',
                        '<td>', rangeStr, '<br><span style="color:var(--text-muted); font-size:0.75rem;">до ', cleanFormatDate(t.minPaymentDeadline), '</span></td>',
                        '<td class="td-actions">',
                            '<button class="btn-action edit-icon" title="Изменить" onclick="editTransaction(\'', t.id, '\')">',
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>',
                            '</button>',
                            '<button class="btn-action delete-icon" title="Удалить" onclick="deleteTransaction(\'', t.id, '\')">',
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
                            '</button>',
                        '</td>',
                    '</tr>'
                ].join('');
            }).join('');
        }
    }
}

renderAll();
