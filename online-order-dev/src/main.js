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
    const adminResultsContainer = document.getElementById('admin-results-container');
    const adminSaveStatus = document.getElementById('admin-save-status');
    const adminEditControls = document.getElementById('admin-edit-controls');
    const adminEditBtn = document.getElementById('admin-edit-btn');
    const adminSaveBtn = document.getElementById('admin-save-btn');
    const adminCancelBtn = document.getElementById('admin-cancel-btn');

    // ✅ [수정] UI 요소 재정의
    const companySelect = document.getElementById('company-select');
    const dailyDatePicker = document.getElementById('daily-date-picker');
    const detailedSearchBtn = document.getElementById('detailed-search-btn');
    const navPeriodOrdersBtn = document.getElementById('nav-period-orders');
    const navMonthlyOrdersBtn = document.getElementById('nav-monthly-orders');


    // --- 헬퍼 함수 ---
    const showLoader = (show) => loadingOverlay.classList.toggle('hidden', !show);
    const formatDate = (date) => date.toISOString().slice(0, 10);

    function initializeDates() {
        const today = new Date();
        
        // 일반 사용자 날짜 초기화
        if (startDateInput && endDateInput) {
            const tomorrow = new Date();
            tomorrow.setDate(today.getDate() + 1);
            const sevenDaysLater = new Date();
            sevenDaysLater.setDate(today.getDate() + 7);
            startDateInput.value = formatDate(tomorrow);
            endDateInput.value = formatDate(sevenDaysLater);

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
        
        // 관리자 날짜 초기화
        if (dailyDatePicker) {
            dailyDatePicker.value = formatDate(today);
        }
    }
    
    // --- 로그인/로그아웃 ---
    loginButton.addEventListener('click', handleLogin);
    passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
    
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

    // --- 일반 사용자 기능 (생략) ---
    function showApp() { /* ... 기존 코드와 동일 ... */ }
    async function handleQuery() { /* ... 기존 코드와 동일 ... */ }
    function renderTable(days, orders) { /* ... 기존 코드와 동일 ... */ }
    function getProductsByTier(tier) { /* ... 기존 코드와 동일 ... */ }
    function updateSummary() { /* ... 기존 코드와 동일 ... */ }
    async function handleSave() { /* ... 기존 코드와 동일 ... */ }
    function handleReset() { /* ... 기존 코드와 동일 ... */ }
    function toggleActionButtons(enabled) { /* ... 기존 코드와 동일 ... */ }


    // --- 관리자 기능 ---
    function showAdminDashboard() {
        loginContainer.classList.add('hidden');
        adminContainer.classList.remove('hidden');
        adminUserInfo.textContent = `관리자: ${currentUser.company} (${currentUser.id})`;
        
        // 이벤트 리스너 한 번만 등록
        adminLogoutButton.addEventListener('click', handleLogout);
        detailedSearchBtn.addEventListener('click', handleDetailedSearch);
        adminEditBtn.addEventListener('click', () => toggleAdminEditMode(true));
        adminCancelBtn.addEventListener('click', () => toggleAdminEditMode(false));
        adminSaveBtn.addEventListener('click', handleAdminSave);
        
        // 페이지 이동 이벤트
        navPeriodOrdersBtn.addEventListener('click', () => window.location.href = '/period-orders.html');
        navMonthlyOrdersBtn.addEventListener('click', () => window.location.href = '/monthly-orders.html');
        
        initializeAdminView();
    }

    function initializeAdminView() {
        initializeDates();
        populateCompanyDropdown();
        clearAdminResults();
    }

    const clearAdminResults = () => {
        adminResultsContainer.innerHTML = '<p class="text-center text-gray-500">조회 버튼을 눌러 현황을 확인하세요.</p>';
        adminEditBtn.classList.add('hidden');
        adminSaveStatus.textContent = '';
        if (adminEditMode) toggleAdminEditMode(false);
    };
    
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

    // ✅ [추가] 상세 검색 이벤트 핸들러
    async function handleDetailedSearch() {
        const date = dailyDatePicker.value;
        const company = companySelect.value;

        if (!date) {
            alert('조회할 날짜를 선택해주세요.');
            return;
        }

        showLoader(true);
        clearAdminResults();
        try {
            // ✅ [수정] 새로운 통합 서버 함수 호출
            const groups = await callAppsScript('getGroupedOrdersByDate', [date, company]);
            renderGroupedReport(groups); // 그룹화된 결과 렌더링
            adminSaveStatus.textContent = `조회 완료: ${date} / ${company}`;
        } catch (error) {
            renderAdminError(error);
        } finally {
            showLoader(false);
        }
    }

    // ✅ [이름 변경] renderTodayGroupReport -> renderGroupedReport
    function renderGroupedReport(groups) {
        adminSaveStatus.textContent = '';
        if (!groups || groups.length === 0) {
            adminResultsContainer.innerHTML = '<p class="text-center text-gray-500">해당 조건의 주문이 없습니다.</p>';
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

    async function handleAdminSave() {
        const modifiedCells = adminResultsContainer.querySelectorAll('.cell-modified');
        if (modifiedCells.length === 0) {
            alert("변경된 내용이 없습니다.");
            return;
        }
        if (!confirm(`${modifiedCells.length}개의 항목이 수정되었습니다. 저장하시겠습니까?`)) return;

        showLoader(true);
        const ordersToUpdate = [];
        const date = dailyDatePicker.value; // ✅ [추가] 현재 조회된 날짜 가져오기

        modifiedCells.forEach(cell => {
            const row = cell.closest('.company-row');
            ordersToUpdate.push({
                docId: cell.dataset.docId,
                newQuantity: Number(cell.querySelector('input').value),
                oldValue: Number(cell.dataset.oldValue),
                company: row.dataset.companyName,
                userId: row.dataset.userId,
                product: cell.dataset.product,
                date: date // ✅ [추가] 수정된 날짜 정보 전달
            });
        });

        try {
            // ✅ [수정] 일반화된 서버 함수 호출
            const result = await callAppsScript('updateOrdersAndStatus', [ordersToUpdate, currentUser.id]);
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
            handleDetailedSearch(); // ✅ [수정] 저장 후 현재 조건으로 다시 조회
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