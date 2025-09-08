// ✅ 1단계에서 새로 복사한 Apps Script 웹 앱 URL을 여기에 붙여넣으세요.
const API_URL = "https://script.google.com/macros/s/AKfycbw4KW8_y7PV2-L5NUiFaG_Z_XL0Oy9M5f2Hd5bqMWeqSeqd77FnDnm5fxPUbzNwKb5H/exec";

// Apps Script 함수를 JSONP(GET) 방식으로 호출하는 새로운 공용 함수
export function callAppsScript(functionName, args = []) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());

    window[callbackName] = (response) => {
      delete window[callbackName];
      document.body.removeChild(script);
      if (response.status === 'success') {
        resolve(response.data);
      } else {
        reject(new Error(response.message));
      }
    };

    const argsString = encodeURIComponent(JSON.stringify(args));
    const url = `${API_URL}?fn=${functionName}&args=${argsString}&callback=${callbackName}`;

    const script = document.createElement('script');
    script.src = url;
    script.onerror = () => {
        delete window[callbackName];
        document.body.removeChild(script);
        reject(new Error('JSONP request failed'));
    };
    document.body.appendChild(script);
  });
}