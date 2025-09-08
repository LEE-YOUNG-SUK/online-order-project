// 우리가 만든 서버 통신 담당 함수를 불러옵니다.
import { callAppsScript } from './api.js';

// Firebase v10 모듈 버전(ESM)을 import 합니다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const firebaseConfig = {
        apiKey: "AIzaSyCfki0WEKqkzCpXWnuHdlx-oxMoCEnwRBU",
        authDomain: "online-order-662f8.firebaseapp.com",
        projectId: "online-order-662f8",
        storageBucket: "online-order-662f8.firebasestorage.app",
        messagingSenderId: "420544357250",
        appId: "1:420544357250:web:4de52c0791e92dedbd659b",
        measurementId: "G-Q42YXLCL33"
    };

    let db;
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        console.log("Firebase가 성공적으로 초기화되었습니다.");
    } catch (e) {
        console.error("Firebase 초기화 실패", e);
        alert("Firebase 초기화에 실패했습니다. 페이지를 새로고침해주세요.");
    }

    // --- UI 요소 전체 선언 ---
    let currentUser = null;
    let adminEditMode = false;
    let originalAdminData = null; 
    const productOrder = ['도시락', '도시락(양많이)', '샐러드'];
    const isLocal = typeof google === 'undefined';

    // 공통
    const loadingOverlay = document.getElementById('loading-overlay');
    const loginContainer = document.getElementById('login-container');
    const loginButton = document.getElementById('login-button');
    const userIdInput = document.getElementById('userId');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    // 일반 유저
    const appContainer = document.getElementById('app-container');
    const userInfo = document.getElementById('user-info');
    const logoutButton = document.getElementById('logout-button');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const queryButton = document.getElementById('query-button');
    const tableHeader = document.getElementById('table-header');
    const tableBody = document.getElementById('table-body');
    const saveButton = document.getElementById('save-button');
    const resetButton = document.getElementById('reset-button');
    const summary = document.getElementById('summary');
    const saveStatus = document.getElementById('save-status');
    // 관리자
    const adminContainer = document.getElementById('admin-container');
    const adminUserInfo = document.getElementById('admin-user-info');
    const adminLogoutButton = document.getElementById('admin-logout-button');
    const dailyDatePicker = document.getElementById('daily-date-picker');
    const dailyQueryBtn = document.getElementById('daily-query-btn');
    const monthlyPicker = document.getElementById('monthly-picker');
    const monthlyQueryBtn = document.getElementById('monthly-query-btn');
    const todayGroupQueryBtn = document.getElementById('today-group-query-btn');
    const companySelect = document.getElementById('company-select');
    const companyStartDateInput = document.getElementById('company-start-date');
    const companyEndDateInput = document.getElementById('company-end-date');
    const companyQueryBtn = document.getElementById('company-query-btn');
    const adminResultsContainer = document.getElementById('admin-results-container');
    const adminSaveStatus = document.getElementById('admin-save-status');
    const adminEditControls = document.getElementById('admin-edit-controls');
    const adminEditBtn = document.getElementById('admin-edit-btn');
    const adminSaveBtn = document.getElementById('admin-save-btn');
    const adminCancelBtn = document.getElementById('admin-cancel-btn');

    // --- 헬퍼 함수 ---
    const showLoader = (show) => loadingOverlay.classList.toggle('hidden', !show);
    const formatDate = (date) => date.toISOString().slice(0, 10);

    function initializeDates() {
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        const sevenDaysLater = new Date();
        sevenDaysLater.setDate(today.getDate() + 7);

        startDateInput.value = formatDate(tomorrow);
        endDateInput.value = formatDate(sevenDaysLater);
        dailyDatePicker.value = formatDate(new Date());
        companyStartDateInput.value = formatDate(tomorrow);
        companyEndDateInput.value = formatDate(sevenDaysLater);

        if (currentUser && currentUser.tier !== 'master') {
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(today.getDate() - 60);
            const fourteenDaysLater = new Date();
            fourteenDaysLater.setDate(today.getDate() + 14);
            const minDate = formatDate(sixtyDaysAgo);
            const maxDate = formatDate(fourteenDaysLater);
            startDateInput.min = endDateInput.min = minDate;
            startDateInput.max = endDateInput.max = maxDate;
        }
    }
    
    // --- 로그인/로그아웃 ---
    loginButton.addEventListener('click', handleLogin);
    passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
    
    // ✅ 이 함수는 이미 잘 수정하셨습니다!
    async function handleLogin() {
        const userId = userIdInput.value.trim();
        const password = passwordInput.value.trim();
        if (!userId || !password) {
            loginError.textContent = '아이디와 비밀번호를 모두 입력해주세요.';
            return;
        }
        showLoader(true);
        try {
            const result = await callAppsScript('authenticateUser', [userId, password]);
            onLoginSuccess(result);
        } catch (error) {
            onLoginFailure(error);
        }
    }

    function onLoginSuccess(result) {
        showLoader(false);
        if (result.success) {
            currentUser = { 
                id: userIdInput.value.trim(),
                company: result.company, 
                tier: result.tier
            };
            sessionStorage.setItem('userInfo', JSON.stringify(currentUser));
            if (currentUser.tier === 'master') { 
                showAdminDashboard();
            } else { 
                showApp();
            }
        } else {
            loginError.textContent = result.message;
        }
    }
    
    function onLoginFailure(error) {
        showLoader(false);
        loginError.textContent = `로그인 오류: ${error.message}`;
    }

    function handleLogout() {
        currentUser = null;
        sessionStorage.removeItem('userInfo');
        appContainer.classList.add('hidden');
        adminContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
        userIdInput.value = '';
        passwordInput.value = '';
        loginError.textContent = '';
    }

    // --- 일반 사용자 기능 ---
    function showApp() {
        loginContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        userInfo.textContent = `${currentUser.company} (${currentUser.id})`;
        logoutButton.addEventListener('click', handleLogout);
        queryButton.addEventListener('click', handleQuery);
        saveButton.addEventListener('click', handleSave);
        resetButton.addEventListener('click', handleReset);
        initializeDates();
    }
    
    // ✅ `google.script.run`을 `callAppsScript`로 수정
    async function handleQuery() {
        const startDateStr = startDateInput.value;
        const endDateStr = endDateInput.value;
        if (!startDateStr || !endDateStr) {
            alert('시작일과 종료일을 모두 선택해주세요.');
            return;
        }
        if (new Date(startDateStr) > new Date(endDateStr)) {
            alert('시작일은 종료일보다 이전이어야 합니다.');
            return;
        }
        showLoader(true);
        saveStatus.textContent = '';

        try {
            const ordersRef = collection(db, 'orders');
            const q = query(ordersRef, 
                where("userId", "==", currentUser.id),
                where("date", ">=", startDateStr),
                where("date", "<=", endDateStr)
            );
            
            const ordersSnapshot = await getDocs(q);
            const existingOrders = {};
            ordersSnapshot.forEach(doc => {
                const data = doc.data();
                if (!existingOrders[data.date]) {
                    existingOrders[data.date] = {};
                }
                existingOrders[data.date][data.product] = {
                    quantity: data.quantity,
                    docId: doc.id
                };
            });
            
            // Apps Script 함수 호출
            const businessDays = await callAppsScript('getBusinessDays', [startDateStr, endDateStr]);
            renderTable(businessDays, existingOrders);

        } catch (error) {
            console.error("조회 오류: ", error);
            alert(`조회 중 오류가 발생했습니다: ${error.message}`);
        } finally {
            showLoader(false);
        }
    }

    function renderTable(days, orders) {
      if (!days || days.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="100%" class="text-center py-8 text-gray-500">선택한 기간에 발주 가능한 날짜가 없습니다.</td></tr>';
          tableHeader.innerHTML = '';
          toggleActionButtons(false);
          return;
      }

      const products = getProductsByTier(currentUser.tier);
      let headerHtml = '<tr><th class="py-3 px-4 text-left text-sm font-semibold text-gray-700">날짜</th>';
      products.forEach(p => headerHtml += `<th class="py-3 px-4 text-center text-sm font-semibold text-gray-700">${p}</th>`);
      headerHtml += '</tr>';
      tableHeader.innerHTML = headerHtml;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let bodyHtml = '';
      days.forEach(dayStr => {
          const date = dayStr.split(' ')[0];
          const cellDate = new Date(date);
          cellDate.setHours(0, 0, 0, 0);
          const isPastDate = cellDate <= today;
          
          bodyHtml += `<tr class="border-b ${isPastDate ? 'bg-gray-50' : ''}" data-date="${date}">`;
          bodyHtml += `<td class="py-3 px-4 font-medium ${isPastDate ? 'text-gray-500' : ''}">${dayStr}</td>`;
          
          products.forEach(product => {
              const order = orders[date] && orders[date][product] ? orders[date][product] : { quantity: 0, docId: '' };
              if (isPastDate) {
                  bodyHtml += `<td class="py-2 px-3 text-center bg-gray-100" data-product="${product}" data-doc-id="${order.docId}" data-old-value="${order.quantity}">
                      <input type="number" min="0" value="${order.quantity}" class="w-24 text-center p-2 border rounded-md bg-gray-100 text-gray-500 cursor-not-allowed" disabled title="과거 날짜는 수정할 수 없습니다">
                  </td>`;
              } else {
                  bodyHtml += `<td class="py-2 px-3 text-center" data-product="${product}" data-doc-id="${order.docId}" data-old-value="${order.quantity}">
                      <input type="number" min="0" value="${order.quantity}" class="w-24 text-center p-2 border rounded-md focus:ring-1 focus:ring-blue-500">
                  </td>`;
              }
          });
          bodyHtml += `</tr>`;
      });
      tableBody.innerHTML = bodyHtml;

      tableBody.querySelectorAll('input[type="number"]:not(:disabled)').forEach(input => {
          input.addEventListener('input', updateSummary);
      });
      updateSummary();
      toggleActionButtons(true);
    }

    function getProductsByTier(tier) {
        if (tier === 'user') return ['도시락', '샐러드'];
        if (tier === 'userbig') return ['도시락', '도시락(양많이)', '샐러드'];
        return ['도시락', '도시락(양많이)', '샐러드'];
    }

    function updateSummary() {
      let total = 0;
      let hasModification = false;
      
      tableBody.querySelectorAll('input[type="number"]').forEach(input => {
          const value = Number(input.value) || 0;
          total += value;
          
          if (!input.disabled) {
              const cell = input.parentElement;
              const isModified = value !== Number(cell.dataset.oldValue);
              cell.classList.toggle('cell-modified', isModified);
              if (isModified) hasModification = true;
          }
      });
      summary.textContent = `📊 발주 요약: 총 ${total}개`;
      saveButton.disabled = !hasModification;
    }

    // ✅ `google.script.run`을 `callAppsScript`로 수정
    async function handleSave() {
        const activeModifiedCells = Array.from(tableBody.querySelectorAll('.cell-modified')).filter(cell => {
            const input = cell.querySelector('input');
            return input && !input.disabled;
        });

        if (activeModifiedCells.length === 0) {
            alert("변경된 내용이 없습니다.");
            return;
        }
        if (!confirm(`${activeModifiedCells.length}개의 항목이 변경되었습니다. 저장하시겠습니까?`)) {
            return;
        }

        showLoader(true);
        saveStatus.textContent = '저장 중...';

        try {
            // Firebase 저장 로직 (이 부분은 수정 없음)
            const batch = writeBatch(db);
            const sheetData = [];
            const timestamp = new Date();

            activeModifiedCells.forEach(cell => {
                const row = cell.parentElement;
                const date = row.dataset.date;
                const product = cell.dataset.product;
                const newValue = Number(cell.querySelector('input').value);
                let docId = cell.dataset.docId;
                const orderData = {
                    userId: currentUser.id, company: currentUser.company, date, product,
                    quantity: newValue, status: 'active', timestamp
                };
                sheetData.push({ ...orderData });

                if (newValue > 0 && docId) { // Update
                    batch.update(doc(db, "orders", docId), { quantity: newValue, timestamp: timestamp });
                } else if (newValue > 0 && !docId) { // Create
                    const newDocRef = doc(collection(db, "orders"));
                    batch.set(newDocRef, orderData);
                } else if (newValue === 0 && docId) { // Delete
                    batch.delete(doc(db, "orders", docId));
                }
            });
            await batch.commit();
            
            // Google Sheet 백업
            const result = await callAppsScript('saveToSheet', [sheetData]);
            
            if(result.success){
                saveStatus.textContent = `✅ 성공적으로 저장 및 백업되었습니다. (${new Date().toLocaleTimeString()})`;
                handleQuery(); // Re-query to update old values
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            saveStatus.textContent = `⚠️ 저장/백업 실패: ${error.message}`;
            console.error("Save Error: ", error);
        } finally {
            showLoader(false);
        }
    }

    function handleReset() {
        if (confirm("모든 변경사항을 취소하고 원래대로 되돌리시겠습니까?")) {
            handleQuery();
        }
    }

    function toggleActionButtons(enabled) {
        saveButton.disabled = !enabled;
        resetButton.disabled = !enabled;
    }

    // --- 관리자 기능 ---
    function showAdminDashboard() {
        loginContainer.classList.add('hidden');
        adminContainer.classList.remove('hidden');
        adminUserInfo.textContent = `관리자: ${currentUser.company} (${currentUser.id})`;
        adminLogoutButton.addEventListener('click', handleLogout);
        dailyQueryBtn.addEventListener('click', handleDailyQuery);
        monthlyQueryBtn.addEventListener('click', handleMonthlyQuery);
        todayGroupQueryBtn.addEventListener('click', handleTodayGroupQuery);
        companyQueryBtn.addEventListener('click', handleCompanyQuery);
        adminEditBtn.addEventListener('click', () => toggleAdminEditMode(true));
        adminCancelBtn.addEventListener('click', () => toggleAdminEditMode(false));
        adminSaveBtn.addEventListener('click', handleAdminSave);
        initializeDates();
        populateCompanyDropdown();
        initializeAdminNavigation();
    }

    // ✅ 조건부 내비게이션으로 수정
    function initializeAdminNavigation() {
        if (isLocal) {
            document.getElementById('nav-period')?.addEventListener('click', () => window.location.href = '/period-orders.html');
            document.getElementById('nav-monthly')?.addEventListener('click', () => window.location.href = '/monthly-orders.html');
        } else {
            google.script.run.withSuccessHandler(function(scriptUrl) {
                document.getElementById('nav-period')?.addEventListener('click', () => window.location.href = scriptUrl + '?page=period');
                document.getElementById('nav-monthly')?.addEventListener('click', () => window.location.href = scriptUrl + '?page=monthly');
            }).getScriptUrl();
        }
    }

    const clearAdminResults = () => {
        adminResultsContainer.innerHTML = '<p class="text-center text-gray-500">조회 버튼을 눌러 현황을 확인하세요.</p>';
        adminEditBtn.classList.add('hidden');
        adminSaveStatus.textContent = '';
        if (adminEditMode) toggleAdminEditMode(false);
    };
    
    // ✅ `google.script.run`을 `callAppsScript`로 수정
    async function populateCompanyDropdown() {
        try {
            const list = await callAppsScript('getAccountList');
            companySelect.innerHTML = '<option value="전체">전체 거래처</option>';
            list.forEach(company => {
                const option = document.createElement('option');
                option.value = company;
                option.textContent = company;
                companySelect.appendChild(option);
            });
        } catch (error) {
            console.error("거래처 목록 로드 실패:", error);
        }
    }

    // ✅ `google.script.run`을 `callAppsScript`로 수정
    async function handleDailyQuery() {
        showLoader(true);
        clearAdminResults();
        try {
            const orders = await callAppsScript('getDailyOrders', [dailyDatePicker.value]);
            renderDailyReport(orders);
        } catch (error) {
            renderAdminError(error);
        } finally {
            showLoader(false);
        }
    }

    // ✅ `google.script.run`을 `callAppsScript`로 수정
    async function handleMonthlyQuery() {
        showLoader(true);
        clearAdminResults();
        try {
            const [year, month] = monthlyPicker.value.split('-');
            const orders = await callAppsScript('getMonthlyOrders', [year, month]);
            renderMonthlyReport(orders);
        } catch (error) {
            renderAdminError(error);
        } finally {
            showLoader(false);
        }
    }

    // ✅ `google.script.run`을 `callAppsScript`로 수정
    async function handleTodayGroupQuery() {
        showLoader(true);
        clearAdminResults();
        try {
            const groups = await callAppsScript('getTodayOrdersByGroup');
            renderTodayGroupReport(groups);
        } catch (error) {
            renderAdminError(error);
        } finally {
            showLoader(false);
        }
    }
    
    // ✅ `google.script.run`을 `callAppsScript`로 수정
    async function handleCompanyQuery() {
        showLoader(true);
        clearAdminResults();
        try {
            const orders = await callAppsScript('getOrdersByCompany', [companySelect.value, companyStartDateInput.value, companyEndDateInput.value]);
            renderCompanyReport(orders);
        } catch (error) {
            renderAdminError(error);
        } finally {
            showLoader(false);
        }
    }

    function renderDailyReport(orders) {
        if (!orders || orders.length === 0) {
            adminResultsContainer.innerHTML = '<p class="text-center text-gray-500">해당 날짜에 주문이 없습니다.</p>';
            return;
        }
        const headers = ['업체명', '상품명', '수량'];
        let tableHtml = `<table class="min-w-full bg-white text-sm"><thead><tr class="bg-gray-100">${headers.map(h => `<th class="py-2 px-3 text-left font-semibold text-gray-600">${h}</th>`).join('')}</tr></thead><tbody>`;
        const summary = {};
        orders.forEach(order => {
            tableHtml += `<tr class="border-b"><td class="py-2 px-3">${order.company}</td><td class="py-2 px-3">${order.product}</td><td class="py-2 px-3 text-center">${order.quantity}</td></tr>`;
            if (!summary[order.product]) summary[order.product] = 0;
            summary[order.product] += order.quantity;
        });
        tableHtml += '</tbody></table>';

        let summaryHtml = '<div class="mt-4 p-4 bg-gray-100 rounded-lg"><h4 class="font-bold mb-2">일간 요약</h4>';
        for (const product in summary) {
            summaryHtml += `<p><strong>${product}:</strong> ${summary[product]}개</p>`;
        }
        summaryHtml += '</div>';
        adminResultsContainer.innerHTML = summaryHtml + tableHtml;
    }

    function renderMonthlyReport(orders) {
        if (!orders || orders.length === 0) {
            adminResultsContainer.innerHTML = '<p class="text-center text-gray-500">해당 월에 주문이 없습니다.</p>';
            return;
        }
        const summary = {};
        orders.forEach(order => {
            if (!summary[order.product]) summary[order.product] = 0;
            summary[order.product] += order.quantity;
        });
        let summaryHtml = '<div class="p-4 bg-gray-100 rounded-lg"><h4 class="font-bold mb-2">월간 요약</h4>';
        for (const product in summary) {
            summaryHtml += `<p><strong>${product}:</strong> ${summary[product]}개</p>`;
        }
        summaryHtml += '</div>';
        adminResultsContainer.innerHTML = summaryHtml;
    }

    function renderCompanyReport(orders) {
        if (!orders || orders.length === 0) {
            adminResultsContainer.innerHTML = '<p class="text-center text-gray-500">해당 조건에 맞는 주문이 없습니다.</p>';
            return;
        }
        const headers = ['날짜', '업체명', '상품명', '수량'];
        let tableHtml = `<table class="min-w-full bg-white text-sm"><thead><tr class="bg-gray-100">${headers.map(h => `<th class="py-2 px-3 text-left font-semibold text-gray-600">${h}</th>`).join('')}</tr></thead><tbody>`;
        orders.forEach(o => {
            tableHtml += `<tr class="border-b"><td class="py-2 px-3">${o.date}</td><td class="py-2 px-3">${o.company}</td><td class="py-2 px-3">${o.product}</td><td class="py-2 px-3 text-center">${o.quantity}</td></tr>`;
        });
        tableHtml += `</tbody></table>`;
        adminResultsContainer.innerHTML = tableHtml;
    }
    
    function renderTodayGroupReport(groups) {
        adminSaveStatus.textContent = '';
        if (!groups || groups.length === 0) {
            adminResultsContainer.innerHTML = '<p class="text-center text-gray-500">금일 주문이 없습니다.</p>';
            adminEditBtn.classList.add('hidden');
            return;
        }

        originalAdminData = JSON.parse(JSON.stringify(groups));
        adminEditBtn.classList.remove('hidden');
        let html = '';
        const headers = ['업체명', ...productOrder];

        groups.forEach(group => {
            html += `<div class="mb-6 group-container" data-group-name="${group.groupName}">
                <h4 class="text-lg font-bold p-2 bg-blue-100 rounded-t-lg">${group.groupName}</h4>
                <table class="min-w-full bg-white">
                <thead class="bg-gray-100"><tr>
                        ${headers.map(h => `<th class="py-2 px-3 text-left text-sm font-semibold text-gray-600">${h}</th>`).join('')}
                    </tr></thead><tbody>`;
            
            group.companies.forEach(company => {
                html += `<tr class="border-b company-row" data-company-name="${company.name}" data-user-id="${company.userId}">
                    <td class="py-2 px-3 font-medium">${company.name}</td>`;
                
                productOrder.forEach(product => {
                    const order = company.orders[product];
                    const quantity = order ? order.quantity : 0;
                    const docId = order ? order.docId : '';
                    html += `<td class="py-2 px-3 text-center data-cell" 
                                data-product="${product}" 
                                data-doc-id="${docId}" 
                                data-old-value="${quantity}">
                                <span>${quantity}</span>
                            </td>`;
                });
                html += `</tr>`;
            });
            html += `</tbody></table></div>`;
        });
        adminResultsContainer.innerHTML = html;
    }

    function toggleAdminEditMode(isEditing) {
        adminEditMode = isEditing;
        adminEditBtn.classList.toggle('hidden', isEditing);
        adminEditControls.classList.toggle('hidden', !isEditing);

        const allCells = adminResultsContainer.querySelectorAll('.data-cell');
        allCells.forEach(cell => {
            if (isEditing) {
                const currentValue = cell.querySelector('span').textContent;
                cell.innerHTML = `<input type="number" min="0" value="${currentValue}" class="w-20 text-center p-1 border rounded-md">`;
            } else {
                const companyName = cell.closest('.company-row').dataset.companyName;
                const groupName = cell.closest('.group-container').dataset.groupName;
                const product = cell.dataset.product;
                
                let originalQuantity = 0;
                const originalGroup = originalAdminData.find(g => g.groupName === groupName);
                if(originalGroup) {
                    const originalCompany = originalGroup.companies.find(c => c.name === companyName);
                    if(originalCompany && originalCompany.orders[product]){
                        originalQuantity = originalCompany.orders[product].quantity;
                    }
                }
                cell.innerHTML = `<span>${originalQuantity}</span>`;
                cell.classList.remove('cell-modified');
            }
        });
        if(isEditing) {
            adminResultsContainer.querySelectorAll('input[type="number"]').forEach(input => {
                input.addEventListener('input', handleAdminCellChange);
            });
        }
    }
    
    function handleAdminCellChange(event) {
        const input = event.target;
        const cell = input.parentElement;
        const newValue = Number(input.value);
        const oldValue = Number(cell.dataset.oldValue);
        cell.classList.toggle('cell-modified', newValue !== oldValue);
    }

    // ✅ `google.script.run`을 `callAppsScript`로 수정
    async function handleAdminSave() {
        const modifiedCells = adminResultsContainer.querySelectorAll('.cell-modified');
        if (modifiedCells.length === 0) {
            alert("변경된 내용이 없습니다.");
            return;
        }
        if (!confirm(`${modifiedCells.length}개의 항목이 수정되었습니다. 저장하시겠습니까?`)) return;

        showLoader(true);
        const ordersToUpdate = [];
        modifiedCells.forEach(cell => {
            const row = cell.closest('.company-row');
            ordersToUpdate.push({
                docId: cell.dataset.docId,
                newQuantity: Number(cell.querySelector('input').value),
                oldValue: Number(cell.dataset.oldValue),
                company: row.dataset.companyName,
                userId: row.dataset.userId,
                product: cell.dataset.product
            });
        });

        try {
            const result = await callAppsScript('updateTodaysOrdersAndStatus', [ordersToUpdate, currentUser.id]);
            onAdminSaveSuccess(result);
        } catch(error) {
            onAdminSaveFailure(error);
        }
    }

    function onAdminSaveSuccess(result) {
        showLoader(false);
        if (result.success) {
            adminSaveStatus.textContent = `✅ ${new Date().toLocaleTimeString()}에 성공적으로 저장 및 기록되었습니다.`;
            toggleAdminEditMode(false);
            handleTodayGroupQuery();
        } else {
            alert("저장에 실패했습니다: " + result.message);
        }
    }

    function onAdminSaveFailure(error) {
        showLoader(false);
        alert("서버 오류로 저장에 실패했습니다: " + error.message);
    }
    
    function renderAdminError(error) {
        showLoader(false);
        adminResultsContainer.innerHTML = `<p class="text-center text-red-500">오류 발생: ${error.message}</p>`;
    }

    // --- 초기화 로직 ---
    const savedUser = sessionStorage.getItem('userInfo');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        if (currentUser.tier === 'master') {
            showAdminDashboard();
        } else {
            showApp();
        }
    }
});