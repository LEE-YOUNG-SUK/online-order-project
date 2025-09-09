function getDailyOrders(date, company) {
  // company 파라미터 추가 (선택적)
  try {
    // 기본 쿼리 구조
    let query;
    
    // company 파라미터가 있고 "전체"가 아닌 경우
    if (company && company !== "전체") {
      // 날짜와 거래처 모두 필터링
      query = {
        "structuredQuery": {
          "from": [{"collectionId": "orders"}],
          "where": {
            "compositeFilter": {
              "op": "AND",
              "filters": [
                {
                  "fieldFilter": {
                    "field": { "fieldPath": "date" },
                    "op": "EQUAL",
                    "value": { "stringValue": date }
                  }
                },
                {
                  "fieldFilter": {
                    "field": { "fieldPath": "company" },
                    "op": "EQUAL",
                    "value": { "stringValue": company }
                  }
                }
              ]
            }
          },
          "orderBy": [
            {
              "field": { "fieldPath": "product" },
              "direction": "ASCENDING"
            }
          ]
        }
      };
    } else {
      // 날짜만 필터링 (기존 로직)
      query = {
        "structuredQuery": {
          "from": [{"collectionId": "orders"}],
          "where": {
            "fieldFilter": {
              "field": { "fieldPath": "date" },
              "op": "EQUAL",
              "value": { "stringValue": date }
            }
          },
          "orderBy": [
            {
              "field": { "fieldPath": "company" },
              "direction": "ASCENDING"
            },
            {
              "field": { "fieldPath": "product" },
              "direction": "ASCENDING"
            }
          ]
        }
      };
    }
    
    const response = callFirestoreApi(':runQuery', 'POST', query);
    const results = (response && Array.isArray(response)) 
      ? response.map(item => item.document ? formatFirestoreDocument(item.document) : null).filter(Boolean) 
      : [];
    
    // 로깅 (디버깅용)
    console.log(`getDailyOrders called - date: ${date}, company: ${company || '전체'}, results: ${results.length}`);
    
    return results;
    
  } catch (error) {
    console.error('getDailyOrders error:', error);
    throw new Error(`주문 조회 실패: ${error.toString()}`);
  }
}