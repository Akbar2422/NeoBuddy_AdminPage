import React, { useState, useEffect } from 'react'
import AddRoomForm from './components/AddRoomForm'
import RoomList from './components/RoomList'
import { roomService, supabase } from './lib/supabase'

function App() {
  const [rooms, setRooms] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notification, setNotification] = useState(null)

  // Load rooms on component mount and set up real-time subscription
  useEffect(() => {
    loadRooms()
    
    // Set up real-time subscription for room changes
    const subscription = supabase
      .channel('rooms_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'rooms' },
        (payload) => {
          console.log('Real-time update:', payload)
          
          if (payload.eventType === 'INSERT') {
            // Check if the room already exists in the state before adding it
            setRooms(prev => {
              // If the room already exists in the state, don't add it again
              const roomExists = prev.some(room => room.id === payload.new.id)
              if (roomExists) {
                return prev
              }
              // Otherwise, add the new room and show notification
              // We don't show notification here since handleAddRoom already shows it
              return [payload.new, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            setRooms(prev => prev.map(room => {
              if (room.id === payload.new.id) {
                // Log the user count update for debugging
                if (room.current_users !== payload.new.current_users) {
                  console.log(`User count updated for ${payload.new.name}: ${room.current_users} → ${payload.new.current_users}`);
                }
                return payload.new;
              }
              return room;
            }))
            
            // Only show notification for non-user-count updates to avoid too many notifications
            const isOnlyUserCountUpdate = 
              payload.old && payload.new && 
              Object.keys(payload.new).length === Object.keys(payload.old).length &&
              Object.keys(payload.new).every(key => 
                key === 'current_users' || payload.new[key] === payload.old[key]
              );
              
            if (!isOnlyUserCountUpdate) {
              showNotification('Room updated!');
            }
          } else if (payload.eventType === 'DELETE') {
            setRooms(prev => prev.filter(room => room.id !== payload.old.id))
            showNotification('Room deleted!')
          }
        }
      )
      .subscribe()
    
    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Auto-hide notifications after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type })
  }

  const loadRooms = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const { data, error } = await roomService.getAllRooms()
      
      if (error) {
        throw new Error(error)
      }
      
      setRooms(data || [])
    } catch (err) {
      console.error('Error loading rooms:', err)
      setError(err.message)
      showNotification('Failed to load rooms. Please check your Supabase configuration.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddRoom = async (roomData) => {
    try {
      const { data, error } = await roomService.addRoom(roomData)
      
      if (error) {
        throw new Error(error)
      }
      
      // Only show notification on success, don't update state
      // The real-time subscription will handle adding the room to the state
      if (data && data.length > 0) {
        showNotification('Room added successfully!')
      }
    } catch (err) {
      console.error('Error adding room:', err)
      showNotification('Failed to add room. Please try again.', 'error')
      throw err // Re-throw to handle in form component
    }
  }

  const handleEditRoom = async (roomId, roomData) => {
    try {
      const { data, error } = await roomService.updateRoom(roomId, roomData)
      
      if (error) {
        throw new Error(error)
      }
      
      // Update the room in the list
      if (data && data.length > 0) {
        setRooms(prev => prev.map(room => 
          room.id === roomId ? data[0] : room
        ))
        showNotification('Room updated successfully!')
      }
    } catch (err) {
      console.error('Error updating room:', err)
      showNotification('Failed to update room. Please try again.', 'error')
      throw err // Re-throw to handle in component
    }
  }

  const handleDeleteRoom = async (roomId) => {
    try {
      const { error } = await roomService.deleteRoom(roomId)
      
      if (error) {
        throw new Error(error)
      }
      
      // Remove the room from the list
      setRooms(prev => prev.filter(room => room.id !== roomId))
      showNotification('Room deleted successfully!')
    } catch (err) {
      console.error('Error deleting room:', err)
      showNotification('Failed to delete room. Please try again.', 'error')
    }
  }

  const dismissNotification = () => {
    setNotification(null)
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 shadow-lg border-b border-purple-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-purple-400">NeoBuddy Admin Panel</h1>
              <p className="mt-1 text-sm text-gray-400">Manage your rooms and monitor usage</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                Total Rooms: <span className="font-medium text-purple-400">{rooms.length}</span>
              </div>
              <button
                onClick={loadRooms}
                disabled={isLoading}
                className="px-3 py-1 bg-purple-700 text-white rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 text-sm disabled:opacity-50"
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-gray-100">
        {/* Notification */}
        {notification && (
          <div className={`mb-6 p-4 rounded-lg border ${
            notification.type === 'error' 
              ? 'bg-gray-800 border-red-500 text-red-400' 
              : 'bg-gray-800 border-green-500 text-green-400'
          }`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                {notification.type === 'error' ? (
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                <span>{notification.message}</span>
              </div>
              <button
                onClick={dismissNotification}
                className="text-gray-400 hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Connection Status */}
        {error && (
          <div className="mb-6 p-4 bg-gray-800 border border-yellow-500 rounded-lg">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-yellow-400">Supabase Connection Issue</h3>
                <p className="text-sm text-yellow-300 mt-1">
                  Please update your Supabase credentials in <code className="bg-gray-700 px-1 rounded">src/lib/supabase.js</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Add Room Form */}
        <AddRoomForm 
          onAddRoom={handleAddRoom} 
          isLoading={isLoading}
        />

        {/* Room List */}
        <RoomList 
          rooms={rooms}
          onEditRoom={handleEditRoom}
          onDeleteRoom={handleDeleteRoom}
          isLoading={isLoading}
        />
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-purple-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-400">
            <p>NeoBuddy Admin Panel - Room Management System</p>
            <p className="mt-1">
              Built with React, TailwindCSS, and Supabase
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App