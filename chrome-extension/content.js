function extractData() {
  const name = document.querySelector('.text-heading-xlarge')?.innerText || '';
  const headline = document.querySelector('.text-body-medium.break-words')?.innerText || '';
  const about = document.querySelector('#about')?.parentElement?.querySelector('.display-flex.ph5.pv3')?.innerText || '';
  
  const experience = Array.from(document.querySelectorAll('#experience ~ .pvs-list__outer-container > ul > li')).map(li => {
    const title = li.querySelector('.mr1.t-bold span')?.innerText || '';
    const company = li.querySelector('.t-14.t-normal span')?.innerText || '';
    const duration = li.querySelector('.t-14.t-normal.t-black--light span')?.innerText || '';
    return { title, company, duration };
  });

  return { name, headline, about, experience };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extract") {
    sendResponse(extractData());
  }
});
