
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import io from 'socket.io-client';
import axios from 'axios';
import './ChatRoom.css';

const ChatRoom = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [room, setRoom] = useState(null);
  const [expandedMsgId, setExpandedMsgId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioChunks, setAudioChunks] = useState([]);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // Helper to format time like WhatsApp (e.g., 3:45 PM)
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    return `${hours}:${minutes} ${ampm}`;
  };

  // Emoji list for picker
  const emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
    '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
    '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛',
    '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
    '🤠', '😎', '🤓', '🥳', '😏', '😒', '😞', '😔',
    '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩',
    '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '😈',
    '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻',
    '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻',
    '😼', '😽', '🙀', '😿', '😾', '❤️', '🧡', '💛',
    '💚', '💙', '💜', '🖤', '💔', '💌', '💤', '💢',
    '💥', '💫', '💦', '💨', '🕳️', '💣', '💪', '✌️',
    '✊', '✋', '🖖', '🖐️', '🖕', '👍', '👎', '👌',
    '✋', '👐', '👋', '👏', '🙌', '🤝', '🙏'
  ];

  const getApiBaseUrl = () => import.meta.env.VITE_API_URL.replace(/\/$/, '');
  
  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    socketRef.current = io(getApiBaseUrl());
    
    socketRef.current.emit('join', {
      roomId: roomId,
      username: user.username
    });

    socketRef.current.on('user-joined', (username) => {
      setMessages(prev => [...prev, { id: Date.now(), user: 'System', text: `${username} has joined!` }]);
    });

    socketRef.current.on('active-users', (users) => {
      setActiveUsers(users);
    });

    socketRef.current.on('user-left', (username) => {
      setMessages(prev => [...prev, { id: Date.now(), user: 'System', text: `${username} has left!` }]);
    });

    socketRef.current.on('initial-messages', (msgs) => {
      setMessages(msgs.filter(m => !m.deletedFor.includes(user.username) && !m.deletedForEveryone));
    });

    socketRef.current.on('receive', (msg) => {
      if (!msg.deletedFor.includes(user.username) && !msg.deletedForEveryone) {
        setMessages(prev => [...prev, msg]);
        // Mark message as delivered
        if (msg.username !== user.username) {
          socketRef.current.emit('messageDelivered', {
            messageId: msg.id,
            roomId,
            username: user.username
          });
        }
      }
    });

    socketRef.current.on('messageStatus', ({ messageId, status }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, status } : msg
      ));
    });

    socketRef.current.on('message-deleted-for-me', ({ messageId }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    });

    socketRef.current.on('message-deleted-for-everyone', ({ messageId }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    });

    return () => socketRef.current.disconnect();
  }, [roomId, user, navigate]);

  // Mark messages as read when they come into view
  useEffect(() => {
    // Mark all unread messages from other users as read
    const unreadMessages = messages.filter(msg => 
      msg.username !== user.username && 
      (msg.status === 'sent' || msg.status === 'delivered')
    );
    unreadMessages.forEach(msg => {
      socketRef.current.emit('messageRead', {
        messageId: msg.id,
        roomId
      });
    });
  }, [messages, roomId, user.username]);

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const { data } = await axios.get(`${getApiBaseUrl()}/api/rooms/${roomId}`);
        setRoom(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchRoom();
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const insertEmoji = (emoji) => {
    setInputMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        // Upload audio
        const formData = new FormData();
        formData.append('file', audioBlob, 'voice-message.webm');
        
        try {
          const response = await axios.post(`${getApiBaseUrl()}/api/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          // Send voice message
          socketRef.current.emit('send', {
            roomId: roomId,
            username: user.username,
            file: response.data
          });
        } catch (err) {
          console.error('Error sending voice message:', err);
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setAudioChunks(chunks);
      setRecordingTime(0);
      
      // Timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  // Stop voice recording
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
  };

  // Cancel recording
  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setAudioChunks([]);
    setRecordingTime(0);
  };

  // Format recording time (MM:SS)
  const formatRecordingTime = (time) => {
    const minutes = Math.floor(time / 60).toString().padStart(2, '0');
    const seconds = (time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Upload file to backend
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${getApiBaseUrl()}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Send file message
      socketRef.current.emit('send', {
        roomId: roomId,
        username: user.username,
        file: response.data
      });

    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      socketRef.current.emit('send', {
        roomId: roomId,
        username: user.username,
        text: inputMessage
      });
      setInputMessage('');
    }
  };

  const deleteForMe = (msgId) => {
    socketRef.current.emit('delete-for-me', {
      messageId: msgId,
      username: user.username,
      roomId: roomId
    });
  };

  const deleteForEveryone = (msgId) => {
    socketRef.current.emit('delete-for-everyone', {
      messageId: msgId,
      roomId: roomId
    });
  };

  if (!room) return <div className="loading">Loading...</div>;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-info">
          <h2>{room.name}</h2>
          <p>Room Code: <span className="room-code-display">{room.code}</span></p>
        </div>
        <div className="chat-username">
          {activeUsers.map((u, idx) => (
            <span key={u.id} className="active-user">{u.username}{idx < activeUsers.length - 1 ? ', ' : ''}</span>
          ))}
        </div>
        <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
          Back to Dashboard
        </button>
      </div>

      <div className="messages-container">
        {messages.map((msg) => {
          if (msg.user === 'System') {
            return (
              <div key={msg.id} className="message system">
                <div className="message-bubble">{msg.text}</div>
              </div>
            );
          }

          const isOwn = msg.username === user.username;
              return (
                <div 
                  key={msg.id} 
                  className={`message ${isOwn ? 'own' : 'other'}`}
                >
              <div className="message-username">{msg.username}</div>
              <div className="message-content">
                <div className="message-bubble">
                  {msg.file && (
                    <div className="message-file">
                      {msg.file.mimetype.startsWith('image/') ? (
                        <img src={msg.file.url} alt={msg.file.originalname} className="file-image" />
                      ) : msg.file.mimetype.startsWith('audio/') ? (
                        <div className="audio-container">
                          <audio
                            controls
                            className="audio-player"
                            src={msg.file.url}
                          >
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      ) : (
                        <a href={msg.file.url} download={msg.file.originalname} className="file-download">
                          <div className="file-icon">📄</div>
                          <div className="file-name">{msg.file.originalname}</div>
                        </a>
                      )}
                    </div>
                  )}
                  {msg.text && <div className="message-text">{msg.text}</div>}
                  <div className="message-meta">
                    <span className="message-time">{formatTime(msg.timestamp)}</span>
                    {isOwn && (
                      <span className={`message-check ${msg.status === 'read' ? 'read' : ''}`}>
                        {msg.status === 'sent' ? '✓' : msg.status === 'delivered' ? '✓✓' : '✓✓'}
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  className="info-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedMsgId(expandedMsgId === msg.id ? null : msg.id);
                  }}
                >
                  ⓘ
                </button>
              </div>
              {expandedMsgId === msg.id && (
                <div className="message-actions">
                  <button 
                    onClick={() => {
                      deleteForMe(msg.id);
                      setExpandedMsgId(null);
                    }} 
                    className="delete-btn"
                  >
                    Delete for me
                  </button>
                  {isOwn && (
                    <button 
                      onClick={() => {
                        deleteForEveryone(msg.id);
                        setExpandedMsgId(null);
                      }} 
                      className="delete-btn"
                    >
                      Delete for everyone
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Recording UI */}
      {isRecording && (
        <div className="recording-container">
          <button
            type="button"
            className="cancel-recording-btn"
            onClick={cancelRecording}
          >
            🗑️
          </button>
          <div className="recording-indicator">
            <span className="recording-dot"></span>
            <span className="recording-time">{formatRecordingTime(recordingTime)}</span>
          </div>
          <button
            type="button"
            className="stop-recording-btn"
            onClick={stopRecording}
          >
            ✔️
          </button>
        </div>
      )}
      
      {/* Normal Input UI */}
      {!isRecording && (
        <form onSubmit={sendMessage} className="message-input-container">
          <input
            type="file"
            id="file-input"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            className="message-input"
          />
          <div className="emoji-wrapper" ref={emojiPickerRef}>
            <button
              type="button"
              className="emoji-btn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              😊
            </button>
            {showEmojiPicker && (
              <div className="emoji-picker">
                {emojis.map((emoji, index) => (
                  <button
                    key={index}
                    type="button"
                    className="emoji-item"
                    onClick={() => insertEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="emoji-btn"
            onClick={() => document.getElementById('file-input').click()}
          >
            📎
          </button>
          <button
            type="button"
            className="voice-btn"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
          >
            🎤
          </button>
          {!inputMessage.trim() ? null : (
            <button type="submit" className="btn btn-primary">
              Send
            </button>
          )}
        </form>
      )}
    </div>
  );
};

export default ChatRoom;
