import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function ParentWeeklyMessages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const childrenData = await apiService.getParentChildren();
      const confirmedChildren = childrenData.filter(c => c.is_confirmed);
      setChildren(confirmedChildren);
      
      if (confirmedChildren.length > 0) {
        setSelectedChild(confirmedChildren[0]);
        const messagesData = await apiService.getParentWeeklyMessages(confirmedChildren[0].id);
        setMessages(messagesData);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChildChange = async (childId) => {
    const child = children.find(c => c.id === parseInt(childId));
    setSelectedChild(child);
    
    if (child) {
      try {
        setLoading(true);
        const messagesData = await apiService.getParentWeeklyMessages(child.id);
        setMessages(messagesData);
      } catch (error) {
        console.error("Error loading messages:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading) {
    return (
      <div>
        <Header title="Weekly Messages" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div>
        <Header title="Weekly Messages" user={user} />
        <div className="p-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
            <p className="text-yellow-700">
              No confirmed children found. Please confirm your children first.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Weekly Messages" user={user} />
      
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Weekly Messages from Teachers</h2>
          <p className="text-gray-600 mt-2">Receive weekly updates about your child's progress</p>
        </div>

        {children.length > 1 && (
          <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Viewing Messages for:</h3>
              <select
                value={selectedChild?.id || ''}
                onChange={(e) => handleChildChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name} {child.surname} - {child.class}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded mb-6">
          <div className="flex">
            <i className="fas fa-info-circle text-blue-600 text-xl mr-3"></i>
            <div>
              <h4 className="font-semibold text-blue-800 mb-1">About Weekly Messages</h4>
              <p className="text-blue-700 text-sm">
                Every Friday, teachers send weekly progress reports about your child in each subject. 
                These messages include feedback on behavior, performance, and areas that need improvement.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-envelope-open text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500 text-lg">No weekly messages yet</p>
              <p className="text-gray-400 text-sm mt-2">Messages are sent every Friday</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="p-5 bg-gradient-to-r from-blue-50 to-white border-l-4 border-blue-500 rounded-lg hover:shadow-md transition"
                >
                  <div className="flex items-start">
                    <div className="mr-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white">
                        <i className="fas fa-envelope text-2xl"></i>
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-xl font-semibold text-gray-800">{message.subject}</h3>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-sm text-gray-600">
                              <i className="fas fa-user mr-2"></i>
                              {message.teacher}
                            </span>
                            <span className="text-sm text-gray-600">
                              <i className="fas fa-calendar mr-2"></i>
                              {formatDate(message.date)}
                            </span>
                            <span className="text-sm text-gray-600">
                              <i className="fas fa-clock mr-2"></i>
                              Week {message.week_number}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 p-4 bg-white rounded-lg">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-line">{message.message}</p>
                      </div>

                      {message.performance_rating && (
                        <div className="mt-3 flex items-center">
                          <span className="text-sm text-gray-600 mr-3">Performance:</span>
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <i
                                key={star}
                                className={`fas fa-star ${
                                  star <= message.performance_rating
                                    ? 'text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              ></i>
                            ))}
                            <span className="ml-2 text-sm text-gray-600">
                              {message.performance_rating}/5
                            </span>
                          </div>
                        </div>
                      )}

                      {message.areas_of_improvement && message.areas_of_improvement.length > 0 && (
                        <div className="mt-3 p-3 bg-orange-50 rounded-lg">
                          <p className="text-sm font-semibold text-orange-800 mb-2">
                            <i className="fas fa-exclamation-triangle mr-2"></i>
                            Areas for Improvement:
                          </p>
                          <ul className="list-disc list-inside text-sm text-orange-700 space-y-1">
                            {message.areas_of_improvement.map((area, idx) => (
                              <li key={idx}>{area}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {message.strengths && message.strengths.length > 0 && (
                        <div className="mt-3 p-3 bg-green-50 rounded-lg">
                          <p className="text-sm font-semibold text-green-800 mb-2">
                            <i className="fas fa-check-circle mr-2"></i>
                            Strengths:
                          </p>
                          <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
                            {message.strengths.map((strength, idx) => (
                              <li key={idx}>{strength}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
