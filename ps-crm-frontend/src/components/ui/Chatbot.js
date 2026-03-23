import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import API from '../../api';
import toast from 'react-hot-toast';

export default function Chatbot() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !hasInitialized) {
      loadWelcomeMessage();
    }
  }, [isOpen, hasInitialized]);

  const loadWelcomeMessage = async () => {
    try {
      const response = await API.post('/chatbot/chat', {
        message: 'start',
        userId: user?.id || null
      });
      setMessages([{ text: response.data.response, sender: 'bot' }]);
      setHasInitialized(true);
    } catch (error) {
      console.error('Failed to load welcome message:', error);
      setMessages([{ text: 'Welcome to JanMitra! How can I help you today?', sender: 'bot' }]);
      setHasInitialized(true);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await API.post('/chatbot/chat', {
        message: input,
        userId: user?.id || null,
        role: user?.role || null
      });

      const botMessage = { text: response.data.response, sender: 'bot' };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chatbot error:', error);
      toast.error('Failed to get response from chatbot');
      const errorMessage = { text: 'Sorry, I\'m having trouble responding right now. Please try again later.', sender: 'bot' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(37, 99, 235, 0.3)',
          zIndex: 1000,
          transition: 'all 0.3s ease',
        }}
      >
        <span style={{ fontSize: '24px', color: 'white' }}>
          {isOpen ? '✕' : '💬'}
        </span>
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '20px',
            width: '400px',
            height: '550px',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              color: 'white',
              padding: '16px',
              fontWeight: 'bold',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>🤖</span>
            JanMitra
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              background: '#F8FAFC',
            }}
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: '18px',
                    background: msg.sender === 'user' ? '#2563EB' : 'white',
                    color: msg.sender === 'user' ? 'white' : '#374151',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    wordWrap: 'break-word',
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.4',
                    fontSize: '14px',
                    textAlign: 'left',
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ textAlign: 'center', color: '#6B7280', fontSize: '14px' }}>
                AI is typing...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: '16px',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '20px',
                outline: 'none',
                fontSize: '14px',
              }}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              style={{
                padding: '8px 16px',
                background: '#2563EB',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '14px',
                opacity: (!input.trim() || isLoading) ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}