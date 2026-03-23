// Test script for chatbot API
const axios = require('axios');

async function testChatbot() {
  try {
    console.log('Testing chatbot API...');

    // Test welcome message
    const welcomeResponse = await axios.post('http://localhost:5000/api/chatbot/chat', {
      message: 'start'
    });
    console.log('Welcome message:', welcomeResponse.data.response);

    // Test complaint tracking
    const trackResponse = await axios.post('http://localhost:5000/api/chatbot/chat', {
      message: 'track complaint CMP-123456'
    });
    console.log('Track complaint response:', trackResponse.data.response);

    // Test general message
    const generalResponse = await axios.post('http://localhost:5000/api/chatbot/chat', {
      message: 'hello'
    });
    console.log('General response:', generalResponse.data.response);

    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

testChatbot();