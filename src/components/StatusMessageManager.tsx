import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase, statusMessageService } from '../lib/supabase';

// TypeScript interface for status message
interface StatusMessage {
  id: string;
  message: string;
  created_at: string;
  updated_at: string;
}



const StatusMessageManager: React.FC = () => {
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [originalMessage, setOriginalMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [characterCount, setCharacterCount] = useState<number>(0);
  const MAX_CHARACTERS = 100; // Maximum character limit

  // Load status message
  const loadStatusMessage = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await statusMessageService.getStatusMessage();
      if (error) throw new Error(error);
      
      if (data && data.message) {
        setStatusMessage(data.message);
        setOriginalMessage(data.message);
        setCharacterCount(data.message.length);
      } else {
        setStatusMessage('');
        setOriginalMessage('');
        setCharacterCount(0);
      }
    } catch (err: any) {
      console.error("Error loading status message:", err);
      setError('Failed to load status message');
      showNotification('Failed to load status message', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load status message on component mount and set up real-time subscription
  useEffect(() => {
    loadStatusMessage();

    // Set up real-time subscription for status message changes
    const statusMessageSubscription = supabase
      .channel('status-message-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'status_message'
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newMessage = payload.new as StatusMessage;
            // Only update if we're not currently editing
            if (!hasUnsavedChanges) {
              setStatusMessage(newMessage.message);
              setOriginalMessage(newMessage.message);
              setCharacterCount(newMessage.message.length);
            }
          }

          if (payload.eventType === 'DELETE') {
            // Only update if we're not currently editing
            if (!hasUnsavedChanges) {
              setStatusMessage('');
              setOriginalMessage('');
              setCharacterCount(0);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(statusMessageSubscription);
    };
  }, [loadStatusMessage, hasUnsavedChanges]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CHARACTERS) {
      setStatusMessage(value);
      setCharacterCount(value.length);
      setHasUnsavedChanges(value !== originalMessage);
    }
  };

  // Handle save message
  const handleSaveMessage = async () => {
    if (!statusMessage.trim()) {
      showNotification('Status message cannot be empty', 'error');
      return;
    }
    
    if (statusMessage === originalMessage) {
      showNotification('No changes to save', 'error');
      return;
    }
    
    setIsSaving(true);
    
    try {
      const { error } = await statusMessageService.updateStatusMessage(statusMessage.trim());
      
      if (error) throw new Error(error);
      
      setOriginalMessage(statusMessage);
      setHasUnsavedChanges(false);
      showNotification('✅ Status message saved successfully!', 'success');
    } catch (err: any) {
      console.error("Error saving status message:", err);
      showNotification('❌ Failed to save status message. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reset message
  const handleResetMessage = async () => {
    setIsDeleting(true);
    
    try {
      const { error } = await statusMessageService.deleteStatusMessage();
      
      if (error) throw new Error(error);
      
      setStatusMessage('');
      setOriginalMessage('');
      setCharacterCount(0);
      setHasUnsavedChanges(false);
      showNotification('✅ Status message reset successfully!', 'success');
    } catch (err: any) {
      console.error("Error resetting status message:", err);
      showNotification('❌ Failed to reset status message. Please try again.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setStatusMessage(originalMessage);
    setCharacterCount(originalMessage.length);
    setHasUnsavedChanges(false);
  };

  // Show notification
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  return (
    <div className="mt-12">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-6">Status Message</h2>
        
        {/* Notification */}
        {notification && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              notification.type === 'error'
                ? 'bg-red-900/30 border-red-500 text-red-400'
                : 'bg-green-900/30 border-green-500 text-green-400'
            }`}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                {notification.type === 'error' ? (
                  <svg
                    className="h-5 w-5 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 001.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586l-1.293-1.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                <span>{notification.message}</span>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="focus:outline-none"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
        
        {/* Status Message Form */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-gray-800 border border-purple-700 rounded-lg p-6 shadow-lg"
        >
          <h3 className="text-xl font-bold text-white mb-4">
            Landing Page Status Message
          </h3>
          
          <div className="mb-4">
            <label htmlFor="status-message" className="block text-sm font-medium text-gray-300 mb-1">
              Status Message
            </label>
            <textarea
              id="status-message"
              value={statusMessage}
              onChange={handleInputChange}
              placeholder="Enter a status message to display on the landing page (e.g., 'We are closed today' or 'Available from 9 AM to 10 PM')"
              className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${hasUnsavedChanges ? 'border-yellow-500' : 'border-gray-600'}`}
              rows={3}
              disabled={isLoading}
            />
            <div className="flex justify-between mt-1">
              <p className={`text-xs ${characterCount > MAX_CHARACTERS * 0.8 ? 'text-yellow-400' : 'text-gray-400'}`}>
                {characterCount}/{MAX_CHARACTERS} characters
              </p>
              {hasUnsavedChanges && (
                <p className="text-xs text-yellow-400">
                  Unsaved changes
                </p>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSaveMessage}
              disabled={isLoading || isSaving || !hasUnsavedChanges || !statusMessage.trim()}
              className="px-4 py-2 bg-purple-700 text-white rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Message'}
            </button>
            
            {hasUnsavedChanges && (
              <button
                onClick={handleCancelEdit}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            )}
            
            <button
              onClick={handleResetMessage}
              disabled={isLoading || isDeleting || (!originalMessage && !statusMessage)}
              className="px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Resetting...' : 'Reset Message'}
            </button>
          </div>
          
          {isLoading && (
            <div className="flex justify-center items-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          )}
          
          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </motion.div>
        
        {/* Preview Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 bg-gray-800 border border-blue-700 rounded-lg p-6 shadow-lg"
        >
          <h3 className="text-xl font-bold text-white mb-4">
            Preview
          </h3>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            {statusMessage ? (
              <p className="text-white">{statusMessage}</p>
            ) : (
              <p className="text-gray-500 italic">No status message set</p>
            )}
          </div>
          
          <p className="mt-3 text-sm text-gray-400">
            This is how your status message will appear on the landing page.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default StatusMessageManager;