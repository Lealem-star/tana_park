import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchChatMessages, sendChatMessage } from '../../api/api';
import { socket } from '../../utils/chatSocket';
import { Paperclip, Smile, Mic, Send } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import chatBack from '../../img/chatBack.jpg';
import '../../css/reports.scss';

const GroupChat = () => {
    const user = useSelector((state) => state.user);
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [replyingTo, setReplyingTo] = useState(null); // Message being replied to
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const messagesEndRef = useRef(null);
    const emojiPickerRef = useRef(null);

    // Redirect unauthenticated users
    useEffect(() => {
        if (!user || !user.token) {
            navigate('/login');
        }
    }, [user, navigate]);

    // Handle responsive breakpoint
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load initial messages
    useEffect(() => {
        if (!user || !user.token) return;
        setLoading(true);
        fetchChatMessages({
            token: user.token,
            limit: 50,
            setMessages: (data) => {
                setMessages(data);
                setLoading(false);
            },
            handleError: (err) => {
                setError(err);
                setLoading(false);
            }
        });
    }, [user]);

    // Subscribe to new messages via Socket.IO
    useEffect(() => {
        const handler = (msg) => {
            setMessages((prev) => [...prev, msg]);
        };
        socket.on('chat:newMessage', handler);
        return () => {
            socket.off('chat:newMessage', handler);
        };
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || !user || !user.token) return;

        setSending(true);
        setError('');
        const replyToId = replyingTo?._id || null;
        
        await sendChatMessage({
            token: user.token,
            text: input.trim(),
            replyTo: replyToId,
            handleSuccess: () => {
                setInput('');
                setReplyingTo(null); // Clear reply after sending
                setSending(false);
            },
            handleError: (err) => {
                setError(err);
                setSending(false);
            }
        });
    };

    const handleMessageClick = (msg) => {
        setReplyingTo(msg);
        // Optional: Scroll to input or focus it
        const inputElement = document.querySelector('.chat-input-bar input');
        if (inputElement) {
            inputElement.focus();
        }
    };

    const cancelReply = () => {
        setReplyingTo(null);
    };

    // Handle emoji selection
    const onEmojiClick = (emojiData) => {
        setInput(prev => prev + emojiData.emoji);
        // Optionally keep picker open or close it
        // setShowEmojiPicker(false);
    };

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
                // Check if the click is not on the emoji button
                const emojiButton = event.target.closest('button[title="Add emoji"]');
                if (!emojiButton) {
                    setShowEmojiPicker(false);
                }
            }
        };

        if (showEmojiPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showEmojiPicker]);

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatSenderLine = (msg) => {
        const name = msg.senderName || msg.sender?.name || 'Unknown';
        const zone = msg.senderParkZoneCode || msg.sender?.parkZoneCode || 'N/A';
        const type = msg.senderType || msg.sender?.type || '';
        return `${name} · Zone: ${zone} · ${type}`;
    };

    const isMine = (msg) => {
        return msg.sender && user && msg.sender._id === user._id;
    };

    return (
        <div className={`reports-container ${isMobile ? 'chat-mobile' : ''}`} style={isMobile ? { padding: '0', margin: '0' } : {}}>

            <div className="reports-content" style={isMobile ? { padding: '0', margin: '0', borderRadius: '0' } : {}}>
                {error && (
                    <div className="alert alert-danger">
                        {error}
                    </div>
                )}

                <div className="chat-container" style={{ display: 'flex', flexDirection: 'column', height: isMobile ? 'calc(100vh - 100px)' : '70vh', position: 'relative', maxWidth: isMobile ? '100%' : '100%', margin: '0 auto' }}>
                    <div
                        className="chat-messages"
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: isMobile ? '0.75rem' : '1rem',
                            backgroundImage: `url(${chatBack})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                            borderRadius: '8px',
                            marginBottom: '1rem'
                        }}
                    >
                        {loading ? (
                            <div className="loading">Loading messages...</div>
                        ) : messages.length === 0 ? (
                            <div className="no-data">No messages yet. Start the conversation!</div>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg._id}
                                    className={`chat-message-row ${isMine(msg) ? 'mine' : 'theirs'}`}
                                    style={{
                                        display: 'flex',
                                        justifyContent: isMine(msg) ? 'flex-end' : 'flex-start',
                                        marginBottom: '0.75rem'
                                    }}
                                >
                                    <div
                                        className="chat-message-bubble"
                                        onClick={() => handleMessageClick(msg)}
                                        style={{
                                            maxWidth: isMobile ? '85%' : '80%',
                                            background: isMine(msg)
                                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                                : '#ffffff',
                                            color: isMine(msg) ? '#ffffff' : '#333333',
                                            padding: isMobile ? '0.5rem 0.65rem' : '0.6rem 0.8rem',
                                            borderRadius: isMobile ? '8px' : '10px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                            cursor: 'pointer',
                                            transition: 'transform 0.1s, box-shadow 0.1s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'scale(1.02)';
                                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'scale(1)';
                                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                                        }}
                                    >
                                        {/* Reply Preview */}
                                        {msg.replyTo && (
                                            <div
                                                style={{
                                                    borderLeft: `3px solid ${isMine(msg) ? '#ffffff' : '#667eea'}`,
                                                    paddingLeft: isMobile ? '0.4rem' : '0.5rem',
                                                    marginBottom: isMobile ? '0.4rem' : '0.5rem',
                                                    opacity: 0.8,
                                                    fontSize: isMobile ? '0.75rem' : '0.8rem',
                                                    background: isMine(msg) ? 'rgba(255,255,255,0.2)' : 'rgba(102,126,234,0.1)',
                                                    borderRadius: '4px',
                                                    padding: isMobile ? '0.35rem' : '0.4rem'
                                                }}
                                            >
                                                <div style={{ fontWeight: 600, marginBottom: isMobile ? '0.15rem' : '0.2rem' }}>
                                                    {msg.replyTo.senderName || 'Unknown'}
                                                </div>
                                                <div style={{ 
                                                    fontSize: isMobile ? '0.7rem' : '0.75rem',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: isMobile ? '150px' : '200px'
                                                }}>
                                                    {msg.replyTo.text}
                                                </div>
                                            </div>
                                        )}
                                        <div
                                            className="chat-message-header"
                                            style={{
                                                fontSize: isMobile ? '0.7rem' : '0.75rem',
                                                fontWeight: 600,
                                                marginBottom: isMobile ? '0.2rem' : '0.25rem',
                                                opacity: 0.9
                                            }}
                                        >
                                            {formatSenderLine(msg)}
                                        </div>
                                        <div
                                            className="chat-message-text"
                                            style={{
                                                fontSize: isMobile ? '0.85rem' : '0.9rem',
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word'
                                            }}
                                        >
                                            {msg.text}
                                        </div>
                                        <div
                                            className="chat-message-time"
                                            style={{
                                                fontSize: isMobile ? '0.65rem' : '0.7rem',
                                                marginTop: isMobile ? '0.2rem' : '0.25rem',
                                                textAlign: 'right',
                                                opacity: 0.7
                                            }}
                                        >
                                            {formatTime(msg.createdAt)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Reply Preview (Telegram-style) */}
                    {replyingTo && (
                        <div
                            style={{
                                background: '#f0f0f0',
                                borderLeft: '3px solid #667eea',
                                padding: isMobile ? '0.6rem 0.75rem' : '0.75rem',
                                marginBottom: '0.5rem',
                                borderRadius: '8px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start'
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                <div style={{ 
                                    fontWeight: 600, 
                                    fontSize: isMobile ? '0.8rem' : '0.85rem',
                                    color: '#667eea',
                                    marginBottom: isMobile ? '0.2rem' : '0.25rem'
                                }}>
                                    Replying to {replyingTo.senderName || 'Unknown'}
                                </div>
                                <div style={{ 
                                    fontSize: isMobile ? '0.75rem' : '0.8rem',
                                    color: '#666',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {replyingTo.text}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={cancelReply}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#999',
                                    cursor: 'pointer',
                                    fontSize: '1.2rem',
                                    padding: '0 0.5rem',
                                    lineHeight: 1
                                }}
                                title="Cancel reply"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    <div style={{ position: 'relative' }}>
                        {/* Emoji Picker */}
                        {showEmojiPicker && (
                            <div
                                ref={emojiPickerRef}
                                style={{
                                    position: 'absolute',
                                    bottom: '100%',
                                    right: '0',
                                    marginBottom: '0.5rem',
                                    zIndex: 1000
                                }}
                            >
                                <EmojiPicker
                                    onEmojiClick={onEmojiClick}
                                    width={isMobile ? 280 : 350}
                                    height={isMobile ? 320 : 400}
                                    previewConfig={{ showPreview: false }}
                                    searchPlaceHolder="Search"
                                    theme="light"
                                />
                            </div>
                        )}

                        <form
                            onSubmit={handleSend}
                            className="chat-input-bar"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                background: '#ffffff',
                                border: '1px solid #e0e0e0',
                                borderRadius: isMobile ? '20px' : '24px',
                                padding: isMobile ? '0.4rem 0.6rem' : '0.5rem 0.75rem',
                                gap: isMobile ? '0.4rem' : '0.5rem',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}
                        >
                        {/* Attachment Icon */}
                        <button
                            type="button"
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: isMobile ? '0.4rem' : '0.5rem',
                                color: '#666',
                                transition: 'color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#667eea'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
                            title="Attach file"
                        >
                            <Paperclip size={isMobile ? 18 : 20} />
                        </button>

                        {/* Text Input */}
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={replyingTo ? `Replying to ${replyingTo.senderName}...` : "Write a message..."}
                            style={{
                                flex: 1,
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                fontSize: isMobile ? '0.9rem' : '0.95rem',
                                color: '#333',
                                padding: isMobile ? '0.4rem 0' : '0.5rem 0'
                            }}
                        />

                        {/* Emoji Icon */}
                        <button
                            type="button"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: isMobile ? '0.4rem' : '0.5rem',
                                color: showEmojiPicker ? '#667eea' : '#666',
                                transition: 'color 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                if (!showEmojiPicker) {
                                    e.currentTarget.style.color = '#667eea';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!showEmojiPicker) {
                                    e.currentTarget.style.color = '#666';
                                }
                            }}
                            title="Add emoji"
                        >
                            <Smile size={isMobile ? 18 : 20} />
                        </button>

                        {/* Send Button (Paper Airplane) or Microphone */}
                        {input.trim() ? (
                            <button
                                type="submit"
                                disabled={sending}
                                style={{
                                    background: '#667eea',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: isMobile ? '32px' : '36px',
                                    height: isMobile ? '32px' : '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: sending ? 'not-allowed' : 'pointer',
                                    color: '#ffffff',
                                    transition: 'background 0.2s, transform 0.1s',
                                    opacity: sending ? 0.6 : 1
                                }}
                                onMouseEnter={(e) => {
                                    if (!sending) {
                                        e.currentTarget.style.background = '#5568d3';
                                        e.currentTarget.style.transform = 'scale(1.05)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#667eea';
                                    e.currentTarget.style.transform = 'scale(1)';
                                }}
                                title="Send message"
                            >
                                {sending ? (
                                    <div style={{ 
                                        width: isMobile ? '14px' : '16px', 
                                        height: isMobile ? '14px' : '16px', 
                                        border: '2px solid #ffffff',
                                        borderTop: '2px solid transparent',
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite'
                                    }} />
                                ) : (
                                    <Send size={isMobile ? 16 : 18} />
                                )}
                            </button>
                        ) : (
                            <button
                                type="button"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: isMobile ? '0.4rem' : '0.5rem',
                                    color: '#666',
                                    transition: 'color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = '#667eea'}
                                onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
                                title="Voice message"
                            >
                                <Mic size={isMobile ? 18 : 20} />
                            </button>
                        )}
                    </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GroupChat;


