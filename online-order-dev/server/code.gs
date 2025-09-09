// =================================================================
// ✨ 온라인 발주 시스템 v1.1.0 - 마스터 모드 개선
// 🔒 기존 기능 100% 보존 + 페이지 라우팅 추가
// =================================================================

const SERVICE_ACCOUNT_CREDS = {
  "type": "",
  "project_id": "",
  "private_key_id": "",
  "private_key": "",
  "client_email": "",
  "client_id": "",
  "auth_uri": "",
  "token_uri": "",
  "auth_provider_x509_cert_url": "",
  "client_x509_cert_url": "",
  "universe_domain": ""
};
const PROJECT_ID = "";
const SPREADSHEET_ID = "";

// ✨ cGoa 라이브러리 대신 직접 인증 토큰을 생성하고 캐시하는 함수
function getAccessToken() {
  const cache = CacheService.getScriptCache();
  const cachedToken = cache.get('firestore_access_token');
  if (cachedToken) {
    return cachedToken;
  }

  const privateKey = SERVICE_ACCOUNT_CREDS.private_key.replace(/\\n/g, '\n');
  const clientEmail = SERVICE_ACCOUNT_CREDS.client_email;
  const scopes = ['https://www.googleapis.com/auth/datastore'];

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: clientEmail,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3500, // 1시간 미만으로 설정
    iat: now
  };

  const toSign = Utilities.base64EncodeWebSafe(JSON.stringify(header)) + '.' + Utilities.base64EncodeWebSafe(JSON.stringify(claimSet));
  
  let signatureBytes;
  try {
      signatureBytes = Utilities.computeRsaSha256Signature(toSign, privateKey);
  } catch (e) {
      Logger.log('Error in computeRsaSha256Signature: ' + e.toString());
      throw new Error('암호화 서명 실패. Apps Script 프로젝트 권한(script.scriptapp)을 재승인했는지 확인해주세요. 오류: ' + e.toString());
  }
  
  const signature = Utilities.base64EncodeWebSafe(signatureBytes);
  const jwt = toSign + '.' + signature;

  const options = {
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', options);
  const result = JSON.parse(response.getContentText());

  if (response.getResponseCode() >= 300) {
    Logger.log('Token fetch error: ' + response.getContentText());
    throw new Error('Access Token 요청 실패: ' + response.getContentText());
  }

  const accessToken = result.access_token;
  cache.put('firestore_access_token', accessToken, 3500); // 1시간 미만 캐시
  return accessToken;
}

// 🆕 개선된 doGet 함수 (라우팅 추가)
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

/**
 * GET/POST 요청을 모두 처리하는 통합 핸들러
 */
function handleRequest(e) {
  try {
    let functionName;
    let args = [];

    // GET 요청 처리 (JSONP 방식)
    if (e.parameter.fn) {
      functionName = e.parameter.fn;
      if (e.parameter.args) {
        args = JSON.parse(e.parameter.args);
      }
    }
    // POST 요청 처리 (기존 API 방식)
    else if (e.postData) {
      const params = JSON.parse(e.postData.contents);
      functionName = params.functionName;
      args = params.args || [];
    }
    // 페이지 서빙 요청 (기존 HTML 페이지 로딩 방식)
    else if (e.parameter.page) {
      return serveHtmlPage(e.parameter.page);
    }
    // 기본 요청은 main 페이지 서빙
    else {
      return serveHtmlPage('main');
    }

    // 함수 실행
    if (functionName && typeof this[functionName] === 'function') {
      const result = this[functionName].apply(null, args);

      // JSONP 콜백이 있는 경우
      if (e.parameter.callback) {
        const jsonpResponse = `${e.parameter.callback}(${JSON.stringify({ status: 'success', data: result })})`;
        return ContentService.createTextOutput(jsonpResponse).setMimeType(ContentService.MimeType.JAVASCRIPT);
      }

      // 일반 JSON 응답
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: result }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      // 페이지 서빙 외의 요청인데 함수 이름이 없을 경우
      if(!functionName) return serveHtmlPage('main');
      throw new Error(`Function '${functionName}' not found`);
    }
  } catch (error) {
    const errorResponse = { status: 'error', message: error.toString() };
    if (e.parameter.callback) {
      const jsonpError = `${e.parameter.callback}(${JSON.stringify(errorResponse)})`;
      return ContentService.createTextOutput(jsonpError).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(errorResponse)).setMimeType(ContentService.MimeType.JSON);
  }
}

function serveHtmlPage(page) {
  const pageMap = {
    'main': { file: 'main', title: '🍱 온라인 발주 시스템'},
    'period': { file: 'period-orders', title: '📅 기간별 주문 조회'},
    'monthly': { file: 'monthly-orders', title: '📊 월간 주문 조회'}
  };
  const pageConfig = pageMap[page] || pageMap['main'];
  return HtmlService.createHtmlOutputFromFile(pageConfig.file)
    .setTitle(pageConfig.title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


// 메인 페이지 생성 헬퍼 함수
function createMainPage() {
  return HtmlService.createHtmlOutputFromFile('main')
    .setTitle("🍱 온라인 발주 시스템")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

// 🆕 현재 스크립트 URL 반환 (페이지 네비게이션용)
function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

// 🆕 기간별 주문 조회 (거래처 필터 포함)
function getPeriodOrdersWithFilter(company, startDate, endDate) {
  try {
    // 입력값 검증
    if (!startDate || !endDate) {
      throw new Error('시작일과 종료일을 모두 입력해주세요.');
    }
    
    // 날짜 유효성 검증
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      throw new Error('시작일은 종료일보다 이전이어야 합니다.');
    }
    
    // 기존 함수 재사용 (안전성 보장)
    return getOrdersByCompany(company, startDate, endDate);
    
  } catch (error) {
    console.error('getPeriodOrdersWithFilter error:', error);
    throw error;
  }
}

// 🆕 월간 주문 조회 (거래처 필터 포함)
function getMonthlyOrdersWithFilter(company, year, month) {
  try {
    // 입력값 검증
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new Error('유효한 연도와 월을 입력해주세요.');
    }
    
    // 기존 함수로 전체 데이터 조회
    const allOrders = getMonthlyOrders(yearNum, monthNum);
    
    // 거래처 필터링
    if (company && company !== '전체') {
      return allOrders.filter(order => order.company === company);
    }
    
    return allOrders;
    
  } catch (error) {
    console.error('getMonthlyOrdersWithFilter error:', error);
    throw error;
  }
}

// ===== 이하 기존 함수들 (수정 없이 그대로 유지) =====

function callFirestoreApi(path, method, payload) {
  const token = getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const options = {
    method: method || 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    muteHttpExceptions: true
  };
  if (payload) options.payload = JSON.stringify(payload);

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  if (responseCode >= 300) {
    Logger.log("Firestore API Error: " + responseText);
    try {
      const jsonResponse = JSON.parse(responseText);
      throw new Error((jsonResponse.error && jsonResponse.error.message) || responseText);
    } catch (e) {
      throw new Error(responseText || "Firestore API 호출 중 알 수 없는 오류 발생");
    }
  }
  return JSON.parse(responseText);
}

function formatFirestoreDocument(doc) {
  const fields = doc.fields;
  const formatted = {
    docId: doc.name.split('/').pop()
  };
  for (const key in fields) {
    const value = fields[key];
    if (value.stringValue !== undefined) formatted[key] = value.stringValue;
    else if (value.integerValue !== undefined) formatted[key] = Number(value.integerValue);
    else if (value.timestampValue !== undefined) formatted[key] = new Date(value.timestampValue).toISOString();
  }
  return formatted;
}

function authenticateUser(userId, password) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("계정");
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (String(row[1]).trim() === userId && String(row[2]).trim() === password) {
        return { success: true, company: row[0], tier: String(row[3]).trim() };
      }
    }
    return { success: false, message: "ID 또는 비밀번호가 일치하지 않습니다." };
  } catch (error) {
    return { success: false, message: "서버 오류: " + error.toString() };
  }
}

function getBusinessDays(startDateStr, endDateStr) {
  const businessDays = [];
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  let currentDate = new Date(startDate.getTime());
  while (currentDate <= endDate) {
    if (currentDate.getDay() !== 0) {
      const yyyy = currentDate.getFullYear();
      const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
      const dd = String(currentDate.getDate()).padStart(2, '0');
      businessDays.push(`${yyyy}-${mm}-${dd} (${weekdays[currentDate.getDay()]})`);
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return businessDays;
}

function saveToSheet(orders) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("백업데이터");
    const timestamp = new Date();
    const rows = orders.map(order => [order.date.split(' ')[0], order.company, order.product, order.quantity, timestamp]);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    return { success: true };
  } catch (error) {
    return { success: false, message: "시트 백업 오류: " + error.toString() };
  }
}

/**
 * [수정됨] 특정 날짜의 주문 내역을 조회합니다.
 * 거래처(company)가 지정된 경우 해당 거래처의 주문만 필터링하여 성능을 최적화합니다.
 * @param {string} date - 조회할 날짜 (YYYY-MM-DD)
 * @param {string} [company] - 필터링할 거래처 이름. '전체'이거나 없으면 모든 거래처를 조회.
 * @returns {Array} 주문 객체 배열
 */
function getDailyOrders(date, company) {
  try {
    // 기본 필터: 날짜 필터는 항상 포함됩니다.
    const filters = [
      {
        "fieldFilter": {
          "field": { "fieldPath": "date" },
          "op": "EQUAL",
          "value": { "stringValue": date }
        }
      }
    ];

    // company 인자가 있고 '전체'가 아닐 경우, 거래처 필터를 동적으로 추가합니다.
    // 이렇게 하면 Firestore에서 직접 필터링하므로 Apps Script의 부하가 줄어 성능이 향상됩니다.
    if (company && company !== '전체') {
      filters.push({
        "fieldFilter": {
          "field": { "fieldPath": "company" },
          "op": "EQUAL",
          "value": { "stringValue": company }
        }
      });
    }

    const query = {
      "structuredQuery": {
        "from": [{"collectionId": "orders"}],
        "where": {
          "compositeFilter": {
            "op": "AND",
            "filters": filters
          }
        },
        "orderBy": [
          { "field": { "fieldPath": "company" }, "direction": "ASCENDING" },
          { "field": { "fieldPath": "product" }, "direction": "ASCENDING" }
        ]
      }
    };

    const response = callFirestoreApi(':runQuery', 'POST', query);
    const results = (response && Array.isArray(response)) 
      ? response.map(item => item.document ? formatFirestoreDocument(item.document) : null).filter(Boolean) 
      : [];
      
    return results;

  } catch (error) {
    console.error('getDailyOrders error:', error.toString());
    // 클라이언트에 더 명확한 에러 메시지를 전달합니다.
    throw new Error(`일일 주문 조회 실패: ${error.message}`);
  }
}

function getMonthlyOrders(year, month) {
  const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month, 1).toISOString().split('T')[0];
  const query = {
    "structuredQuery": { "from": [{"collectionId": "orders"}], "where": { "compositeFilter": { "op": "AND", "filters": [ { "fieldFilter": { "field": { "fieldPath": "date" }, "op": "GREATER_THAN_OR_EQUAL", "value": { "stringValue": startDate } } }, { "fieldFilter": { "field": { "fieldPath": "date" }, "op": "LESS_THAN", "value": { "stringValue": endDate } } } ] } } }
  };
  const response = callFirestoreApi(':runQuery', 'POST', query);
  return (response && Array.isArray(response)) ? response.map(item => item.document ? formatFirestoreDocument(item.document) : null).filter(Boolean) : [];
}

function getAccountList() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("계정");
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    return data.map(row => row[0]).filter(String);
  } catch (e) {
    return [];
  }
}

/**
 * [수정] Firestore에서 특정 기간과 거래처의 주문을 조회합니다.
 * period-orders.html 페이지에서 사용됩니다.
 */
function getOrdersByCompany(company, startDate, endDate) {
  const filters = [
    { "fieldFilter": { "field": { "fieldPath": "date" }, "op": "GREATER_THAN_OR_EQUAL", "value": { "stringValue": startDate } } },
    { "fieldFilter": { "field": { "fieldPath": "date" }, "op": "LESS_THAN_OR_EQUAL", "value": { "stringValue": endDate } } }
  ];
  if (company && company !== '전체') {
    filters.push({ "fieldFilter": { "field": { "fieldPath": "company" }, "op": "EQUAL", "value": { "stringValue": company } } });
  }
  const query = {
    "structuredQuery": { 
      "from": [{"collectionId": "orders"}], 
      "where": { "compositeFilter": { "op": "AND", "filters": filters } }, 
      "orderBy": [ 
        { "field": { "fieldPath": "date" }, "direction": "ASCENDING" }, 
        { "field": { "fieldPath": "company" }, "direction": "ASCENDING" } 
      ] 
    }
  };
  const response = callFirestoreApi(':runQuery', 'POST', query);
  return (response && Array.isArray(response)) ? response.map(item => item.document ? formatFirestoreDocument(item.document) : null).filter(Boolean) : [];
}

/**
 * [대체됨] 특정 날짜의 주문을 그룹별로 조회합니다. 주문이 없는 업체도 포함합니다.
 * @param {string} date - 조회할 날짜 (YYYY-MM-DD)
 * @param {string} [companyFilter] - 필터링할 거래처 이름. '전체'이거나 없으면 모든 거래처를 조회.
 * @returns {Array} 그룹화된 주문 객체 배열
 */
function getGroupedOrdersByDate(date, companyFilter) {
  try {
    // 1. 계정 시트에서 모든 거래처 정보 가져오기
    const accountSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("계정");
    let allAccountData = accountSheet.getRange(2, 1, accountSheet.getLastRow() - 1, 6).getValues();

    // 2. 특정 거래처 필터가 있으면 해당 거래처만 남김
    if (companyFilter && companyFilter !== '전체') {
      allAccountData = allAccountData.filter(row => row[0] === companyFilter);
    }

    // 3. 해당 날짜의 모든 주문 내역을 Firestore에서 한 번에 조회
    const ordersForDate = getDailyOrders(date);

    // 4. 조회된 주문을 빠른 조회를 위해 Map 형태로 변환
    const ordersLookup = new Map();
    ordersForDate.forEach(order => {
      if (!ordersLookup.has(order.company)) {
        ordersLookup.set(order.company, new Map());
      }
      ordersLookup.get(order.company).set(order.product, {
        quantity: order.quantity,
        docId: order.docId
      });
    });

    // 5. 전체 거래처 목록을 기준으로 그룹 데이터 재구성
    const groupedData = {};
    allAccountData.forEach(row => {
      const companyName = row[0];
      if (!companyName) return;

      const groupName = row[4] || '미지정';
      const sortOrder = row[5] || 999;
      const userId = String(row[1]).trim();

      if (!groupedData[groupName]) {
        groupedData[groupName] = { sortOrder: sortOrder, companies: [] };
      }
      
      // 주문이 있든 없든 모든 업체를 추가하고, 주문이 있으면 데이터 삽입
      const companyOrders = ordersLookup.get(companyName) || new Map();
      
      groupedData[groupName].companies.push({
        name: companyName,
        userId: userId,
        orders: Object.fromEntries(companyOrders) // Map을 일반 객체로 변환
      });
    });

    // 6. 정렬 순서에 따라 최종 결과 반환
    return Object.entries(groupedData)
      .sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
      .map(([groupName, data]) => ({ groupName, companies: data.companies }));

  } catch (error) {
    console.error('getGroupedOrdersByDate error:', error.toString());
    throw new Error(`그룹별 주문 조회 실패: ${error.message}`);
  }
}


/**
 * [이름 변경 및 일반화] 주문을 일괄적으로 수정, 생성, 삭제하고 로그를 남깁니다.
 * @param {Array<Object>} ordersToUpdate 변경할 주문 목록
 * @param {string} adminId 작업을 수행한 관리자 ID
 * @returns {{success: boolean, message?: string}} 작업 성공 여부
 */
function updateOrdersAndStatus(ordersToUpdate, adminId) {
  if (!ordersToUpdate || ordersToUpdate.length === 0) {
    return { success: true, message: "변경사항이 없습니다." };
  }

  const accessToken = getAccessToken();
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const writes = [];
  const timestamp = new Date().toISOString();
  
  ordersToUpdate.forEach(item => {
    // ✅ [수정] 이제 클라이언트에서 정확한 날짜를 보내줌
    const { docId, newQuantity, company, product, userId, date } = item;
    
    if (newQuantity !== undefined && newQuantity !== null) {
      if (docId) { 
        if (newQuantity > 0) {
          // 기존 문서 업데이트
          writes.push({
            update: {
              name: `projects/${PROJECT_ID}/databases/(default)/documents/orders/${docId}`,
              fields: { 
                quantity: { integerValue: newQuantity },
                timestamp: { timestampValue: timestamp }
              }
            },
            updateMask: { fieldPaths: ["quantity", "timestamp"] }
          });
        } else { 
          // 수량이 0이면 삭제
          writes.push({ "delete": `projects/${PROJECT_ID}/databases/(default)/documents/orders/${docId}` });
        }
      } else if (newQuantity > 0) { 
        // 새 문서 생성
        const newDocId = `${userId}_${date.replace(/-/g, '')}_${product.replace(/[()]/g, '')}`;
        writes.push({
          update: {
            name: `projects/${PROJECT_ID}/databases/(default)/documents/orders/${newDocId}`,
            fields: {
              userId: { stringValue: userId },
              company: { stringValue: company },
              product: { stringValue: product },
              quantity: { integerValue: newQuantity },
              date: { stringValue: date }, // ✅ 수정된 날짜 사용
              status: { stringValue: "active" },
              timestamp: { timestampValue: timestamp }
            }
          }
        });
      }
    }

    // 로그 기록 (기존과 거의 동일, date만 수정)
    const logId = Utilities.getUuid();
    writes.push({
      update: {
        name: `projects/${PROJECT_ID}/databases/(default)/documents/order_logs/${logId}`,
        fields: {
          adminId: { stringValue: adminId },
          timestamp: { timestampValue: timestamp },
          company: { stringValue: company },
          product: { stringValue: product },
          changeDetail: { stringValue: `수량:${item.oldValue || 0}→${newQuantity || 0}` },
          date: { stringValue: date }, // ✅ 수정된 날짜 사용
          action: { stringValue: newQuantity === 0 && docId ? 'delete' : (docId ? 'update' : 'create') }
        }
      }
    });
  });

  try {
    const batchWriteUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:batchWrite`;
    const response = UrlFetchApp.fetch(batchWriteUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ "writes": writes }),
      muteHttpExceptions: true
    });
    
    const responseText = response.getContentText();
    if (response.getResponseCode() >= 300) throw new Error(responseText);

    return { success: true, message: "성공적으로 저장되었습니다." };
    
  } catch (e) {
    Logger.log("updateOrdersAndStatus Error: " + e.toString());
    return { success: false, message: e.toString() };
  }
}