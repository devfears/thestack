import React, { useState, useRef, useEffect } from 'react';

export interface Message {
  id: string;
  username: string;
  text: string;
  timestamp: Date;
  pfpUrl?: string;
}

interface ChatBoxProps {
  user: {
    fid: number;
    displayName: string;
    username: string;
    pfpUrl?: string;
  } | null;
  messages: Message[];
  onSendMessage: (text: string) => void;
  onClose: () => void;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ user: _user, messages, onSendMessage, onClose }) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    onSendMessage(newMessage.trim());
    setNewMessage('');
    inputRef.current?.focus();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="mobile-chat-box" style={{
      position: 'fixed', // Changed to fixed for better mobile positioning
      top: '70px',
      left: '20px',
      width: 'min(280px, calc(100vw - 40px))', // Responsive width that works on mobile
      height: 'min(320px, calc(100vh - 140px))', // Responsive height for mobile
      background: 'rgba(0, 0, 0, 0.95)', // Slightly more opaque for better visibility
      color: 'white',
      borderRadius: '0px', // Remove rounded corners for pixelated look
      fontFamily: '"Press Start 2P", monospace',
      backdropFilter: 'blur(10px)',
      border: '3px solid #ffffff',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: '4px 4px 0px #2d3436, 8px 8px 0px rgba(0,0,0,0.3)', // Pixelated shadow
      zIndex: 10000, // High z-index to ensure it appears above all other elements including name tags
      imageRendering: 'pixelated'
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '3px solid #ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.4), rgba(118, 75, 162, 0.4))',
        imageRendering: 'pixelated'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '16px' }}>💬</span>
          <h3 style={{ 
            margin: 0, 
            fontSize: '8px', 
            fontWeight: 'bold',
            textShadow: '2px 2px 0px #000000',
            fontFamily: '"Press Start 2P", monospace',
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}>Building Chat</h3>
        </div>
        <button 
          onClick={onClose}
          style={{
            background: 'rgba(255, 71, 87, 0.8)',
            border: '2px solid #ffffff',
            borderRadius: '0px', // Remove rounded corners for pixelated look
            width: '20px',
            height: '20px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"Press Start 2P", monospace',
            textShadow: '1px 1px 0px #000000',
            boxShadow: '2px 2px 0px #2d3436',
            imageRendering: 'pixelated'
          }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }} className="hide-scrollbar">
        {messages.map((message) => (
          <div key={message.id} style={{
            display: 'flex',
            gap: '6px',
            alignItems: 'flex-start'
          }}>
            {message.pfpUrl ? (
              <img 
                src={message.pfpUrl} 
                alt="pfp" 
                style={{ 
                  width: '20px', 
                  height: '20px', 
                  borderRadius: '0px', // Remove rounded corners for pixelated look
                  flexShrink: 0,
                  border: '2px solid #ffffff',
                  imageRendering: 'pixelated'
                }} 
              />
            ) : (
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                background: message.username === 'System' ? '#6c5ce7' : 
                           message.username === 'BuilderBot' ? '#00b894' : '#74b9ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 'bold',
                flexShrink: 0,
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}>
                {message.username === 'System' ? '🔧' : 
                 message.username === 'BuilderBot' ? '🤖' : 
                 message.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginBottom: '1px'
              }}>
                <span style={{
                  fontSize: '6px',
                  fontWeight: 'bold',
                  color: message.username === 'System' ? '#a29bfe' : 
                         message.username === 'BuilderBot' ? '#00cec9' : '#74b9ff',
                  textShadow: '1px 1px 0px #000000',
                  fontFamily: '"Press Start 2P", monospace',
                  letterSpacing: '0.5px'
                }}>
                  {message.username}
                </span>
                <span style={{
                  fontSize: '8px',
                  color: '#aaa',
                  flexShrink: 0,
                  fontFamily: 'monospace'
                }}>
                  {formatTime(message.timestamp)}
                </span>
              </div>
              <div style={{
                fontSize: '6px',
                lineHeight: '1.4',
                wordWrap: 'break-word',
                textShadow: '1px 1px 0px #000000',
                fontFamily: '"Press Start 2P", monospace',
                letterSpacing: '0.5px'
              }}>
                {message.text}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} style={{
        padding: '8px',
        borderTop: '2px solid rgba(255, 255, 255, 0.2)',
        display: 'flex',
        gap: '6px'
      }}>
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            // Prevent keyboard events from propagating to the game
            e.stopPropagation();
          }}
          onKeyUp={(e) => {
            // Prevent keyboard events from propagating to the game
            e.stopPropagation();
          }}
          placeholder="Type message..."
          style={{
            flex: 1,
            padding: '6px 8px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '2px solid #ffffff',
            borderRadius: '0px', // Remove rounded corners for pixelated look
            color: 'white',
            fontSize: '8px',
            outline: 'none',
            fontFamily: '"Press Start 2P", monospace',
            textShadow: '1px 1px 1px rgba(0, 0, 0, 0.5)',
            imageRendering: 'pixelated',
            letterSpacing: '0.5px'
          }}
          maxLength={150}
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          style={{
            padding: '6px 12px',
            background: newMessage.trim() ? 'rgba(108, 92, 231, 0.8)' : 'rgba(128, 128, 128, 0.5)',
            border: '2px solid #ffffff',
            borderRadius: '0px',
            color: 'white',
            cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
            fontSize: '6px',
            fontWeight: 'bold',
            minWidth: '50px',
            fontFamily: '"Press Start 2P", monospace',
            textShadow: '1px 1px 0px #000000',
            boxShadow: '2px 2px 0px #2d3436',
            imageRendering: 'pixelated',
            letterSpacing: '0.5px',
            textTransform: 'uppercase'
          }}
        >
          Send
        </button>
      </form>


    </div>
  );
};