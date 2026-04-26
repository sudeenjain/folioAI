async function testFullFlow() {
  try {
    // 1. Generate session
    const genRes = await fetch('http://localhost:3001/api/portfolio/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: '01',
        confirmedSections: {
          hero: { name: 'Flow Test', title: 'QA Engineer', tagline: 'Testing the flow' },
          about: { bio: 'Bio' },
          projects: [],
          skills: {},
          experience: [],
          education: [],
          contact: { email: 'test@test.com' }
        }
      })
    });
    const { sessionId } = await genRes.json();
    console.log('Session ID:', sessionId);

    // 2. Preview
    const prevRes = await fetch(`http://localhost:3001/api/portfolio/preview/${sessionId}`);
    console.log('Preview Status:', prevRes.status);
    const html = await prevRes.text();
    console.log('Preview HTML starts with:', html.substring(0, 100));
  } catch (err) {
    console.error('Flow Error:', err.message);
  }
}

testFullFlow();
