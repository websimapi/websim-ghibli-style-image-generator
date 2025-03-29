import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { config } from './config.js';

// Initialize WebsimSocket for realtime collaboration
const room = new WebsimSocket();

// Main App Component
function App() {
  useEffect(() => {
    room.initialize();
  }, []);

  return (
    <div className="app-container">
      <Header />
      <main>
        <GeneratorSection />
        <CommunitySection />
      </main>
    </div>
  );
}

// Header Component
function Header() {
  return (
    <header>
      <h1>Ghibli Style Image Generator</h1>
      <p>Create and share magical Ghibli-inspired images with the community</p>
    </header>
  );
}

// Image Generator Section
function GeneratorSection() {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState(config.defaultAspectRatio);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt first');
      return;
    }

    setError('');
    setIsGenerating(true);
    
    try {
      const fullPrompt = `${config.defaultPromptPrefix} ${prompt}`;
      const result = await websim.imageGen({
        prompt: fullPrompt,
        aspect_ratio: aspectRatio
      });
      
      setGeneratedImage({
        url: result.url,
        prompt: fullPrompt,
        aspectRatio
      });
      
      // Share in the chat that you generated an image
      room.updatePresence({
        action: 'generated',
        message: `I just generated: "${prompt}"`
      });
      
    } catch (err) {
      console.error('Error generating image:', err);
      setError('Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedImage) return;
    
    try {
      await room.collection('ghibli_images').create({
        prompt: prompt,
        full_prompt: generatedImage.prompt,
        image_url: generatedImage.url,
        aspect_ratio: aspectRatio,
      });
      
      alert('Image saved to gallery!');
    } catch (err) {
      console.error('Error saving image:', err);
      setError('Failed to save image to gallery.');
    }
  };

  const handlePromptSuggestion = (suggestion) => {
    setPrompt(suggestion);
  };

  return (
    <section className="generator-section">
      <h2 className="title">Generate a Ghibli-Style Image</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="prompt-tags">
        {config.suggestedPrompts.map((suggestion, index) => (
          <div 
            key={index} 
            className="prompt-tag"
            onClick={() => handlePromptSuggestion(suggestion)}
          >
            {suggestion}
          </div>
        ))}
      </div>
      
      <div className="form-group">
        <label htmlFor="prompt">Describe your image:</label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A small cottage by a misty lake with a rowboat..."
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="aspect">Aspect Ratio:</label>
        <select 
          id="aspect"
          value={aspectRatio}
          onChange={(e) => setAspectRatio(e.target.value)}
        >
          <option value="1:1">Square (1:1)</option>
          <option value="16:9">Landscape (16:9)</option>
          <option value="9:16">Portrait (9:16)</option>
          <option value="4:3">Standard (4:3)</option>
          <option value="3:2">Photo (3:2)</option>
        </select>
      </div>
      
      <button 
        className="btn"
        onClick={handleGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? 'Generating...' : 'Generate Image'}
      </button>
      
      {isGenerating && (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      )}
      
      {generatedImage && (
        <div className="generated-image">
          <img src={generatedImage.url} alt="Generated Ghibli style image" />
          <div className="image-controls">
            <button className="btn" onClick={handleSave}>Save to Gallery</button>
            <a 
              href={generatedImage.url} 
              download="ghibli-image.png"
              className="btn btn-secondary"
              target="_blank"
              rel="noreferrer"
            >
              Download
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

// Community Section with Gallery and Chat
function CommunitySection() {
  return (
    <div className="community-section">
      <GallerySection />
      <ChatSection />
    </div>
  );
}

// Gallery Section
function GallerySection() {
  const [images, setImages] = useState([]);
  const [filter, setFilter] = useState('all');
  
  const imagesSubscriber = React.useMemo(() => {
    return (list) => {
      // Sort from newest to oldest
      const sortedList = [...list].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      setImages(sortedList);
    };
  }, []);
  
  useEffect(() => {
    const unsubscribe = room.collection('ghibli_images').subscribe(imagesSubscriber);
    return () => unsubscribe();
  }, [imagesSubscriber]);
  
  const filterImages = () => {
    if (filter === 'all') return images;
    
    if (filter === 'my') {
      return images.filter(img => img.username === room.peers[room.clientId]?.username);
    }
    
    return images;
  };
  
  const filteredImages = filterImages();
  
  return (
    <section className="gallery-section">
      <h2 className="title">Community Gallery</h2>
      
      <div className="filter-controls">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Images
        </button>
        <button 
          className={`filter-btn ${filter === 'my' ? 'active' : ''}`}
          onClick={() => setFilter('my')}
        >
          My Images
        </button>
      </div>
      
      <div className="gallery">
        {filteredImages.length === 0 ? (
          <p>No images yet. Be the first to share one!</p>
        ) : (
          filteredImages.map(image => (
            <div key={image.id} className="gallery-item">
              <img 
                className="gallery-image" 
                src={image.image_url} 
                alt={image.prompt || 'Ghibli style image'} 
              />
              <div className="gallery-info">
                <div className="username">{image.username}</div>
                <div className="prompt">{image.prompt}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// Chat Section
function ChatSection() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  
  const handlePresenceUpdate = React.useCallback((presenceData) => {
    Object.entries(presenceData).forEach(([clientId, data]) => {
      if (data.action === 'chat' && data.message) {
        setMessages(prev => {
          // Avoid duplicate messages by checking if it already exists
          if (prev.some(m => m.id === data.id)) return prev;
          
          const newMessages = [...prev, {
            id: data.id,
            text: data.message,
            username: room.peers[clientId]?.username || 'Unknown',
            clientId,
            timestamp: new Date()
          }];
          
          // Keep only the last N messages
          return newMessages.slice(-config.maxChatMessages);
        });
      }
    });
  }, []);
  
  useEffect(() => {
    room.subscribePresence(handlePresenceUpdate);
    
    // Subscribe to chat messages from database for persistence
    const unsubscribe = room.collection('chat_messages').subscribe((messages) => {
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        text: msg.message,
        username: msg.username,
        timestamp: new Date(msg.created_at),
        fromDb: true
      }));
      
      setMessages(prev => {
        // Combine live presence messages with database messages without duplicates
        const combined = [...prev.filter(m => !m.fromDb), ...formattedMessages];
        combined.sort((a, b) => a.timestamp - b.timestamp);
        return combined.slice(-config.maxChatMessages);
      });
    });
    
    return () => unsubscribe();
  }, [handlePresenceUpdate]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;
    
    const messageId = Date.now().toString();
    
    // Update presence for realtime chat
    room.updatePresence({
      action: 'chat',
      message: newMessage,
      id: messageId
    });
    
    // Also save to database for persistence
    await room.collection('chat_messages').create({
      message: newMessage
    });
    
    setNewMessage('');
  };
  
  return (
    <section className="chat-section">
      <h2 className="title">Community Chat</h2>
      
      <div className="chat-messages">
        {messages.length === 0 ? (
          <p>No messages yet. Start the conversation!</p>
        ) : (
          messages.map(message => {
            const isCurrentUser = message.username === room.peers[room.clientId]?.username;
            return (
              <div 
                key={message.id} 
                className={`message ${isCurrentUser ? 'message-user' : 'message-other'}`}
              >
                <div className="message-meta">
                  <img 
                    className="avatar" 
                    src={`https://images.websim.ai/avatar/${message.username}`} 
                    alt={message.username} 
                  />
                  <span className="username">{message.username}</span>
                </div>
                <div className="message-text">{message.text}</div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="chat-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          className="chat-input"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit" className="btn">Send</button>
      </form>
    </section>
  );
}

// Render the app
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('app')
);

