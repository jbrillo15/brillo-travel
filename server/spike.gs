/**
 * Phase 0 spike only. Proves a page hosted on GitHub Pages can POST to an
 * Apps Script web app bound to the STAGING sheet and get JSON back.
 * Replaced by Code.gs in Phase 1. Never deploy this to the prod sheet.
 *
 * Script Properties required: API_TOKEN (32+ random chars), ENV = staging.
 */

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, api: 1, code: 'BAD_REQUEST', message: 'Body is not JSON' });
  }

  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('API_TOKEN');
  if (!token || body.token !== token) {
    return json_({ ok: false, api: 1, code: 'AUTH', message: 'Token missing or wrong' });
  }

  return json_({
    ok: true,
    api: 1,
    env: props.getProperty('ENV') || 'unset',
    sheet: SpreadsheetApp.getActive().getName(),
    // Echo lets the spike page check that Japanese text and emoji round-trip (EC-15).
    echo: body.echo === undefined ? null : body.echo,
    receivedAt: new Date().toISOString()
  });
}

function doGet() {
  return json_({ ok: false, api: 1, code: 'BAD_REQUEST', message: 'Use POST' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
