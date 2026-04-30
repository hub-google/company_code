/**
 * 職域代碼管理系統 - 後端 API (GAS)
 */

const PROPERTIES = PropertiesService.getScriptProperties();
const SOURCE_FILE_ID = PROPERTIES.getProperty('SOURCE_SHEET_ID');
const TARGET_FILE_ID = PROPERTIES.getProperty('TARGET_SHEET_ID');
function doGet(e) {
  const action = e.parameter.action;
  const user = e.parameter.user;
  const key = e.parameter.key;
  
  try {
    if (action === 'login') {
      return response(login(user, key));
    }
    
    if (action === 'getDashboardData') {
      const data = getSourceData();
      return response(getDashboardData(data, user));
    }
    
    if (action === 'getSubmitHistory') {
      return response(getSubmitHistory(user));
    }
    
    return response({ success: false, message: 'Invalid action' });
  } catch (err) {
    return response({ success: false, message: err.toString() });
  }
}

function doPost(e) {
  const action = e.parameter.action;
  try {
    const postData = JSON.parse(e.postData.contents);
    if (action === 'submitData') {
      return response(submitData(postData.user, postData.items));
    }
  } catch (err) {
    return response({ success: false, message: err.toString() });
  }
}

function getSourceData() {
  const file = DriveApp.getFileById(SOURCE_FILE_ID);
  
  const tempSheet = Drive.Files.copy({
    title: "TEMP_FOR_READ_" + new Date().getTime(),
    mimeType: MimeType.GOOGLE_SHEETS
  }, SOURCE_FILE_ID);
  
  const ss = SpreadsheetApp.openById(tempSheet.id);
  const sheets = ss.getSheets();
  const allData = {};
  
  sheets.forEach(sh => {
    const name = sh.getName().toLowerCase().trim();
    const values = sh.getDataRange().getValues();
    if (values.length > 0) {
      const headers = values[0].map(h => h.toString().toLowerCase().trim());
      Logger.log(`Sheet "${name}" Headers: ${JSON.stringify(headers)}`);
      const rows = values.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        return obj;
      });
      allData[name] = rows;
    }
  });
  
  DriveApp.getFileById(tempSheet.id).setTrashed(true);
  
  return allData;
}

function login(user, key) {
  const data = getSourceData();
  const loginSheet = data['login'] || [];
  const found = loginSheet.find(r => r.user.toString().trim() === user && r.key.toString().trim() === key);
  return { success: !!found, user: found ? found.user : null };
}

function getDashboardData(data, user) {
  const company = data['company'] || [];
  const select = data['select'] || [];
  
  const inquiryList = company.filter(r => r.user.toString().trim() === user);
  const userPolicies = select.filter(r => r.user.toString().trim() === user).map(r => r.no.toString());
  
  const categories = [...new Set(inquiryList.map(r => r.kind))].filter(Boolean);
  
  return {
    success: true,
    inquiryList: inquiryList,
    userPolicies: userPolicies,
    categories: categories,
    allCompany: company
  };
}

function getSubmitHistory(user) {
  const ss = SpreadsheetApp.openById(TARGET_FILE_ID);
  const sheet = ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { success: true, history: [] };
  
  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  const history = values.slice(1)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    })
    .filter(r => r.user.toString().trim() === user)
    .reverse();
    
  return { success: true, history: history };
}

function submitData(user, items) {
  const ss = SpreadsheetApp.openById(TARGET_FILE_ID);
  const sheet = ss.getSheets()[0];
  const timestamp = new Date();
  items.forEach(item => {
    // 欄位順序：time, user, no, kind, code, name
    sheet.appendRow([timestamp, user, item.no, item.kind, item.code, item.name]);
  });
  return { success: true };
}

function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
