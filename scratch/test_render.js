async function testRender() {
  try {
    const response = await fetch('http://localhost:3001/api/portfolio/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: '01',
        data: {
          hero: { name: 'Test User', title: 'Developer', tagline: 'Hello world' },
          about: { bio: 'This is a test bio' },
          projects: [],
          skills: { technical_skills: [], languages: [], frameworks: [], tools: [] },
          experience: [],
          education: [],
          contact: { email: 'test@example.com' }
        }
      })
    });

    const status = response.status;
    const text = await response.text();
    console.log('Status:', status);
    console.log('Response:', text);
  } catch (err) {
    console.error('Fetch Error:', err.message);
  }
}

testRender();
