document.getElementById('extract').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: "extract" }, (response) => {
    if (response) {
      document.getElementById('status').innerText = "Data extracted! Copying to clipboard...";
      navigator.clipboard.writeText(JSON.stringify(response));
      alert("Data copied to clipboard! Paste it into FolioAI.");
    } else {
      document.getElementById('status').innerText = "Failed to extract. Make sure you are on a LinkedIn profile page.";
    }
  });
});
