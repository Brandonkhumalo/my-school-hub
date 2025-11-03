import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function TeacherMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await apiService.getMessages();
      
      const conversationMap = {};
      data.forEach(msg => {
        const otherUserId = msg.sender === user.id ? msg.recipient : msg.sender;
        const otherUserName = msg.sender === user.id ? msg.recipient_name : msg.sender_name;
        
        if (!conversationMap[otherUserId]) {
          conversationMap[otherUserId] = {
            userId: otherUserId,
            userName: otherUserName,
            lastMessage: msg.message,
            lastMessageDate: msg.date_sent,
            unread: msg.recipient === user.id && !msg.is_read
          };
        }
      });
      
      setConversations(Object.values(conversationMap).sort((a, b) => 
        new Date(b.lastMessageDate) - new Date(a.lastMessageDate)
      ));
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conv) => {
    try {
      setSelectedConversation(conv);
      const data = await apiService.getConversation(conv.userId);
      setMessages(data);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!messageText.trim()) {
      alert("Please enter a message");
      return;
    }

    try {
      setSending(true);
      await apiService.sendMessage({
        recipient_id: selectedConversation.userId,
        message: messageText,
        subject: subject
      });
      
      setMessageText("");
      setSubject("");
      await loadMessages(selectedConversation);
      await loadConversations();
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message: " + (error.message || "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  if (loading && !selectedConversation) {
    return (
      <div>
        <Header title="Messages" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Messages" user={user} />
      
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conversations List */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Parent Messages</h3>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {conversations.map((conv) => (
                <div
                  key={conv.userId}
                  onClick={() => loadMessages(conv)}
                  className={`p-3 rounded-lg cursor-pointer transition ${
                    selectedConversation?.userId === conv.userId
                      ? 'bg-green-500 text-white'
                      : conv.unread
                      ? 'bg-yellow-50 border border-yellow-300'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold">{conv.userName}</div>
                      <div className={`text-sm truncate ${
                        selectedConversation?.userId === conv.userId ? 'text-green-100' : 'text-gray-500'
                      }`}>
                        {conv.lastMessage.substring(0, 50)}...
                      </div>
                    </div>
                    {conv.unread && selectedConversation?.userId !== conv.userId && (
                      <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                    )}
                  </div>
                  <div className={`text-xs mt-1 ${
                    selectedConversation?.userId === conv.userId ? 'text-green-100' : 'text-gray-400'
                  }`}>
                    {new Date(conv.lastMessageDate).toLocaleDateString()}
                  </div>
                </div>
              ))}
              
              {conversations.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <i className="fas fa-inbox text-4xl mb-2"></i>
                  <p>No messages yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-4 flex flex-col" style={{height: '600px'}}>
            {selectedConversation ? (
              <>
                <div className="border-b pb-3 mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {selectedConversation.userName}
                  </h3>
                  <p className="text-sm text-gray-500">Parent</p>
                </div>

                <div className="flex-1 overflow-y-auto mb-4 space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === user.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-md px-4 py-2 rounded-lg ${
                          msg.sender === user.id
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {msg.subject && (
                          <div className="font-semibold mb-1">{msg.subject}</div>
                        )}
                        <div>{msg.message}</div>
                        <div className={`text-xs mt-1 ${
                          msg.sender === user.id ? 'text-green-100' : 'text-gray-500'
                        }`}>
                          {new Date(msg.date_sent).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}

                  {messages.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <i className="fas fa-comment-dots text-6xl mb-4"></i>
                      <p>No messages in this conversation</p>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="border-t pt-4">
                  <input
                    type="text"
                    placeholder="Subject (optional)"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <div className="flex gap-2">
                    <textarea
                      placeholder="Type your reply..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      rows="2"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    ></textarea>
                    <button
                      type="submit"
                      disabled={sending}
                      className="px-6 bg-green-500 hover:bg-green-600 text-white rounded-md transition disabled:bg-gray-400"
                    >
                      {sending ? (
                        <i className="fas fa-spinner fa-spin"></i>
                      ) : (
                        <i className="fas fa-paper-plane"></i>
                      )}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <i className="fas fa-comments text-6xl mb-4"></i>
                  <p>Select a conversation to view messages</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
