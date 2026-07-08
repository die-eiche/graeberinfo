const fs = require('fs');

function readAccessToken() {
  if (process.env.DROPBOX_ACCESS_TOKEN) {
    return process.env.DROPBOX_ACCESS_TOKEN.trim();
  }

  const tokenFile = process.env.DROPBOX_TOKEN_FILE;
  if (tokenFile && fs.existsSync(tokenFile)) {
    return fs.readFileSync(tokenFile, 'utf8').trim();
  }

  throw new Error(
    'Kein Dropbox-Token gefunden. Setzen Sie DROPBOX_ACCESS_TOKEN oder DROPBOX_TOKEN_FILE.'
  );
}

async function downloadExcelFile() {
  const accessToken = readAccessToken();
  const filePath = process.env.DROPBOX_FILE_PATH || '/eiche/ehrenamt/EA Dienste 2026.xlsx';

  const response = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({ path: filePath })
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dropbox-Download fehlgeschlagen (${response.status}): ${errorText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

module.exports = {
  readAccessToken,
  downloadExcelFile
};
