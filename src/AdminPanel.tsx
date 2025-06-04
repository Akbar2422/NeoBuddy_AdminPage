import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AddRoomForm from './components/AddRoomForm';
import RoomList from './components/RoomList';
import PromoCodeManager from './components/PromoCodeManager';
import PayoutManager from './components/PayoutManager';
import StatusMessageManager from './components/StatusMessageManager';
import { supabase, roomService } from './lib/supabase';

// TypeScript interfaces
interface Room {
  id: string;
  name: string;
  description: string;
  url: string;
  max_users: number;
  price_inr: number;
  session_date: string | null; // Added session_date field
  session_start_time: string | null;
  session_end_time: string | null;
  current_users: number;
  created_at?: string;
}

interface Session {
  id: string;
  room_id: string;
  username: string;
  rewards_left: number;
  last_updated: string;
}

const AdminPanel: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Load rooms + setup real-time listeners and auto-refresh
  useEffect(() => {
    loadRooms();

    // 🔁 Real-time subscription for room changes
    const roomSubscription = supabase
      .channel('rooms-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms'
        },
        (payload) => {
          // Get today's date for filtering using UTC
          const now = new Date();
          const today = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            0, 0, 0
          ));
          const todayStr = today.toISOString().split('T')[0];
          
          console.log(`Realtime event: ${payload.eventType}, UTC date: ${todayStr}, Room date: ${payload.new?.session_date}`);
          
          if (payload.eventType === 'INSERT') {
            setRooms((prev) => {
              const newRoom = payload.new as Room;
              
              // Only add the room if it's scheduled for today
              if (newRoom.session_date !== todayStr) {
                console.log(`Ignoring new room ${newRoom.name} - not scheduled for today (${newRoom.session_date} vs ${todayStr})`);
                return prev;
              }
              
              // Avoid duplicates
              if (prev.some(room => room.id === newRoom.id)) {
                console.log(`Ignoring duplicate room ${newRoom.name}`);
                return prev;
              }

              return [newRoom, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedRoom = payload.new as Room;
            
            setRooms((prev) => {
              // If the room is not in our current list and it's not for today, ignore it
              if (!prev.some(room => room.id === updatedRoom.id) && updatedRoom.session_date !== todayStr) {
                console.log(`Ignoring updated room - not for today or not in current list`);
                return prev;
              }
              
              return prev.map((room) =>
                room.id === updatedRoom.id ? updatedRoom : room
              );
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedRoom = payload.old as Room;
            
            setRooms((prev) =>
              prev.filter((room) => room.id !== deletedRoom.id)
            );
          }
        }
      )
      .subscribe();
      
    // 🔄 Auto-refresh every 30 seconds to ensure room status is up-to-date
    // This helps remove rooms that are no longer active due to time/date changes
    const autoRefreshInterval = setInterval(() => {
      console.log('Auto-refreshing rooms list...');
      loadRooms();
    }, 30000); // 30 seconds

    // 🚪 Real-time subscription for user sessions
    const sessionSubscription = supabase
      .channel('sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_sessions'
        },
        async (payload) => {
          const session = payload.new || payload.old;

          // Only process if session has room_id
          if (!session?.room_id) return;

          const roomId = session.room_id;

          if (payload.eventType === 'INSERT') {
            const sessionData = payload.new as Session;

            // If rewards are > 0 → increment current_users
            if (sessionData.rewards_left > 0) {
              await updateRoomUserCount(roomId, 1);
            }
          }

          if (payload.eventType === 'UPDATE') {
            const oldSession = payload.old as Session;
            const newSession = payload.new as Session;

            if (oldSession.room_id !== newSession.room_id) return;

            // If rewards went from active → inactive
            if (oldSession.rewards_left > 0 && newSession.rewards_left <= 0) {
              await updateRoomUserCount(roomId, -1);
            }

            // If rewards were zero but now started again
            if (oldSession.rewards_left <= 0 && newSession.rewards_left > 0) {
              await updateRoomUserCount(roomId, 1);
            }
          }

          if (payload.eventType === 'DELETE') {
            const sessionData = payload.old as Session;

            // If rewards were > 0 before deletion
            if (sessionData.rewards_left > 0) {
              await updateRoomUserCount(roomId, -1);
            }
          }
        }
      )
      .subscribe();

    // Auto-hide notification after 5 seconds
    const notificationTimer = notification
      ? setTimeout(() => {
          setNotification(null);
        }, 5000)
      : undefined;

    return () => {
      if (notificationTimer) clearTimeout(notificationTimer);
      clearInterval(autoRefreshInterval); // Clean up auto-refresh interval
      supabase.removeChannel(roomSubscription);
      supabase.removeChannel(sessionSubscription);
    };
  }, []);

  // Function to safely update room user count
  const updateRoomUserCount = async (roomId: string, change: number) => {
    try {
      const { data: room, error: fetchError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (fetchError) throw fetchError;

      const newCount = Math.max(0, (room.current_users || 0) + change);

      const { error: updateError } = await supabase
        .from('rooms')
        .update({ current_users: newCount })
        .eq('id', roomId);

      if (updateError) throw updateError;

      console.log(`Room ${roomId} users updated: ${room.current_users} → ${newCount}`);
    } catch (err) {
      console.error("Failed to update room user count:", err);
    }
  };

  // Fetch all rooms initially
  const loadRooms = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get today's date in YYYY-MM-DD format using UTC for filtering
      const now = new Date();
      const today = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0
      ));
      const todayStr = today.toISOString().split('T')[0];
      
      console.log(`Loading rooms for UTC date: ${todayStr}, Local time: ${new Date().toString()}`);
      
      // Modify to fetch only rooms for today's date by default
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('session_date', todayStr)
        .order('created_at', { ascending: false });
  
      if (error) throw error;
  
      setRooms(data || []);
    } catch (err: any) {
      setError(err.message);
      showNotification(`❌ Failed to load rooms – check Supabase connection`, 'error');
      console.error("Error loading rooms:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (
    message: string,
    type: 'success' | 'error' = 'success'
  ) => {
    setNotification({ message, type });

    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const handleAddRoom = async (roomData: any) => {
    try {
      const { data, error } = await roomService.addRoom(roomData);

      if (error) throw error;

      showNotification('✅ Room added successfully!', 'success');
    } catch (err: any) {
      console.error("Error adding room:", err);
      showNotification('❌ Failed to add room. Please try again.', 'error');
    }
  };

  const handleEditRoom = async (roomId: string, updatedData: Partial<Room>) => {
    try {
      const { data, error } = await roomService.updateRoom(roomId, updatedData);

      if (error) throw error;

      if (data && data.length > 0) {
        setRooms((prev) =>
          prev.map((room) => (room.id === roomId ? data[0] : room))
        );
      }

      showNotification('✅ Room updated successfully!', 'success');
    } catch (err: any) {
      console.error("Error updating room:", err);
      showNotification('❌ Failed to update room', 'error');
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
      const { error } = await roomService.deleteRoom(roomId);

      if (error) throw error;

      setRooms((prev) => prev.filter((room) => room.id !== roomId));
      showNotification('✅ Room deleted successfully!', 'success');
    } catch (err: any) {
      console.error("Error deleting room:", err);
      showNotification('❌ Failed to delete room', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 shadow-lg border-b border-purple-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-gray-100 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold gradient-text">NeoBuddy Admin Panel</h1>
            <p className="mt-1 text-sm text-gray-400">Manage Rooms & Monitor Usage</p>
          </div>
          <button
            onClick={loadRooms}
            disabled={isLoading}
            className="px-4 py-2 bg-purple-700 text-white rounded-md hover:bg-purple-600 focus:outline-none"
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {/* Notification Bar */}
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

        {/* Connection Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-500 rounded-lg text-gray-300">
            <div className="flex items-center">
              <svg
                className="h-5 w-5 text-yellow-400 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm mt-1">
                Please check your Supabase credentials in{' '}
                <code className="bg-gray-700 px-1 rounded">src/lib/supabase.ts</code>
              </p>
            </div>
          </div>
        )}

        {/* Status Message Manager */}
        <StatusMessageManager />
        
        {/* Add Room Form */}
        <AddRoomForm onAddRoom={handleAddRoom} isLoading={isLoading} />

        {/* Room List */}
        <RoomList
          rooms={rooms}
          onEditRoom={(room) =>
            handleEditRoom(room.id, {
              name: room.name,
              description: room.description,
              url: room.url,
              max_users: room.max_users,
              price_inr: room.price_inr,
              session_start_time: room.session_start_time,
              session_end_time: room.session_end_time
            })}
          onDeleteRoom={handleDeleteRoom}
          isLoading={isLoading}
        />
        
        {/* Promo Code Manager */}
        <PromoCodeManager />
        
        {/* Payout Manager */}
        <PayoutManager />
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-purple-700 mt-auto">
        <div className="container py-6 text-center text-gray-400 text-sm">
          © {new Date().getFullYear()}{' '}
          <span className="gradient-text font-bold">NeoBuddy</span> | AI Face Replacement Technology
        </div>
      </footer>
    </div>
  );
};

export default AdminPanel;