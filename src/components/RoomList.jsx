import React, { useState } from 'react'

const RoomList = ({ rooms, onEditRoom, onDeleteRoom, isLoading }) => {
  const [editingRoom, setEditingRoom] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitLock, setSubmitLock] = useState(false) // Prevent double submissions

  const handleEditClick = (room) => {
    // Extract time from timestamps if they exist
    let startTime = '09:00'
    let endTime = '17:00'
    let dateOption = 'today'
    
    if (room.session_start_time) {
      const startDate = new Date(room.session_start_time)
      startTime = startDate.getHours().toString().padStart(2, '0') + ':' + 
                 startDate.getMinutes().toString().padStart(2, '0')
    }
    
    if (room.session_end_time) {
      const endDate = new Date(room.session_end_time)
      endTime = endDate.getHours().toString().padStart(2, '0') + ':' + 
               endDate.getMinutes().toString().padStart(2, '0')
    }
    
    // Determine date option based on session_date if available
    if (room.session_date) {
      const sessionDate = new Date(room.session_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const dayAfterTomorrow = new Date(today)
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
      
      // Compare dates to determine the date option
      const sessionDateStr = sessionDate.toISOString().split('T')[0]
      const todayStr = today.toISOString().split('T')[0]
      const tomorrowStr = tomorrow.toISOString().split('T')[0]
      const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0]
      
      if (sessionDateStr === todayStr) {
        dateOption = 'today'
      } else if (sessionDateStr === tomorrowStr) {
        dateOption = 'tomorrow'
      } else if (sessionDateStr === dayAfterTomorrowStr) {
        dateOption = 'day_after_tomorrow'
      }
    }
    
    setEditingRoom(room.id)
    setEditFormData({
      name: room.name,
      description: room.description,
      url: room.url,
      max_users: room.max_users,
      price_inr: room.price_inr,
      date_option: dateOption,
      start_time: startTime,
      end_time: endTime
    })
    setErrors({})
  }

  const handleCancelEdit = () => {
    setEditingRoom(null)
    setEditFormData({})
    setErrors({})
  }

  const validateEditForm = () => {
    const newErrors = {}
    
    if (!editFormData.name?.trim()) {
      newErrors.name = 'Room name is required'
    }
    
    if (!editFormData.description?.trim()) {
      newErrors.description = 'Description is required'
    }
    
    if (!editFormData.url?.trim()) {
      newErrors.url = 'URL is required'
    } else if (!isValidUrl(editFormData.url)) {
      newErrors.url = 'Please enter a valid URL'
    }
    
    if (!editFormData.max_users || editFormData.max_users < 1) {
      newErrors.max_users = 'Max users must be at least 1'
    }
    
    if (!editFormData.price_inr || parseFloat(editFormData.price_inr) <= 0) {
      newErrors.price_inr = 'Price must be greater than 0'
    }
    
    if (!editFormData.start_time) {
      newErrors.start_time = 'Start time is required'
    }

    if (!editFormData.end_time) {
      newErrors.end_time = 'End time is required'
    }

    if (editFormData.start_time && editFormData.end_time && 
        editFormData.start_time >= editFormData.end_time) {
      newErrors.end_time = 'End time must be after start time'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const isValidUrl = (string) => {
    try {
      new URL(string)
      return true
    } catch (_) {
      return false
    }
  }

  const handleEditChange = (e) => {
    const { name, value } = e.target
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  // Convert date_option to an actual date string in YYYY-MM-DD format
  const getSessionDate = (dateOption) => {
    // Create date object for the current date in local timezone
    const today = new Date()
    
    // Create a new date object for the session date
    let sessionDate = new Date(today)
    
    // Adjust the date based on the option
    if (dateOption === 'tomorrow') {
      sessionDate.setDate(today.getDate() + 1)
    } else if (dateOption === 'day_after_tomorrow') {
      sessionDate.setDate(today.getDate() + 2)
    }
    
    // Format as YYYY-MM-DD using local timezone components to avoid UTC conversion issues
    const year = sessionDate.getFullYear()
    // getMonth() is 0-indexed, so add 1
    const month = String(sessionDate.getMonth() + 1).padStart(2, '0')
    const day = String(sessionDate.getDate()).padStart(2, '0')
    
    return `${year}-${month}-${day}`
  }

  // Format time string to HH:MM:SS format for Supabase TIME column
  const formatTimeForSupabase = (timeString) => {
    // Ensure the timeString is in the format HH:MM
    const [hours, minutes] = timeString.split(':').map(Number)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
  }
  
  // Validate time input
  const isValidTimeFormat = (timeString) => {
    // Check if the time string matches the format HH:MM
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    return timeRegex.test(timeString)
  }

  const handleSaveEdit = async (roomId) => {
    // Prevent double submissions
    if (submitLock) return
    setSubmitLock(true)
    
    if (!validateEditForm()) {
      setSubmitLock(false)
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Format time values for Supabase TIME columns
      if (!isValidTimeFormat(editFormData.start_time) || !isValidTimeFormat(editFormData.end_time)) {
        setErrors({
          ...errors,
          start_time: !isValidTimeFormat(editFormData.start_time) ? 'Invalid time format' : '',
          end_time: !isValidTimeFormat(editFormData.end_time) ? 'Invalid time format' : ''
        })
        setSubmitLock(false)
        return
      }
      
      // Format times to HH:MM:SS for Supabase
      const sessionStartTime = formatTimeForSupabase(editFormData.start_time)
      const sessionEndTime = formatTimeForSupabase(editFormData.end_time)
      
      // Get the session date based on the selected date option
      const sessionDate = getSessionDate(editFormData.date_option)
      
      await onEditRoom(roomId, {
        name: editFormData.name,
        description: editFormData.description,
        url: editFormData.url,
        max_users: parseInt(editFormData.max_users),
        price_inr: parseFloat(editFormData.price_inr),
        session_date: sessionDate, // Add the session date
        session_start_time: sessionStartTime,
        session_end_time: sessionEndTime,
        date_option: editFormData.date_option // Keep this for UI purposes only
      })
      
      setEditingRoom(null)
      setEditFormData({})
      setErrors({})
    } catch (error) {
      console.error('Error updating room:', error)
    } finally {
      setIsSubmitting(false)
      // Release the lock after a short delay to prevent accidental double-clicks
      setTimeout(() => setSubmitLock(false), 500)
    }
  }

  const handleDeleteClick = async (roomId, roomName) => {
    if (window.confirm(`Are you sure you want to delete "${roomName}"? This action cannot be undone.`)) {
      await onDeleteRoom(roomId)
    }
  }

  // Format session time for display
  const formatSessionTime = (room) => {
    if (!room.session_start_time || !room.session_end_time) {
      return 'No session scheduled'
    }
    
    // Parse time strings from database
    // The session_start_time and session_end_time are stored as time strings in format HH:MM:SS
    const parseTimeString = (timeStr) => {
      if (!timeStr) return null;
      
      // Handle different possible formats
      if (timeStr.includes('T')) {
        // If it's a full ISO datetime string
        return new Date(timeStr);
      } else {
        // If it's just a time string like "09:00:00"
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, seconds || 0);
        return date;
      }
    };
    
    const startTime = parseTimeString(room.session_start_time);
    const endTime = parseTimeString(room.session_end_time);
    
    if (!startTime || !endTime) {
      return 'Invalid session time';
    }
    
    // Format time
    const formatTime = (date) => {
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    };
    
    // Get session date for display
    let sessionDateStr = 'Today';
    if (room.session_date) {
      // Format the date in a more readable way
      // Parse the session_date (YYYY-MM-DD format)
      const dateParts = room.session_date.split('-');
      const sessionDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]); // Month is 0-indexed
      
      // Format the date as "Day, Month Date" (e.g., "Mon, Jan 1")
      sessionDateStr = sessionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    
    return `${sessionDateStr}, ${formatTime(startTime)} – ${formatTime(endTime)}`;
  };

  const getStatusBadge = (room) => {
    // Parse time strings from database
    const parseTimeString = (timeStr) => {
      if (!timeStr) return null;
      
      // Handle different possible formats
      if (timeStr.includes('T')) {
        // If it's a full ISO datetime string
        return new Date(timeStr);
      } else {
        // If it's just a time string like "09:00:00"
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, seconds || 0);
        return date;
      }
    };
    
    const currentTime = new Date();
    const startTime = parseTimeString(room.session_start_time);
    const endTime = parseTimeString(room.session_end_time);
    const isFull = room.current_users >= room.max_users;
    
    // Check if session is active based on both date and time
    let isActive = false;
    
    if (startTime && endTime) {
      // First check if today is the correct session date
      // Get today's date in YYYY-MM-DD format using local timezone
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayFormatted = `${year}-${month}-${day}`;
      
      const sessionDate = room.session_date || null;
      
      // Room is only active if session_date matches today's date
      const isCorrectDate = sessionDate === todayFormatted;
      
      // Then check if current time is within session time range
      const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
      const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
      const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();
      
      const isWithinTimeRange = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      
      // Room is active only if both date and time conditions are met
      isActive = isCorrectDate && isWithinTimeRange;
    }
    
    // Debug log to help troubleshoot
    console.log('Room status check:', {
      room: room.name,
      currentDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
      sessionDate: room.session_date || 'unknown',
      currentTime: `${currentTime.getHours()}:${currentTime.getMinutes()}`,
      startTime: startTime ? `${startTime.getHours()}:${startTime.getMinutes()}` : null,
      endTime: endTime ? `${endTime.getHours()}:${endTime.getMinutes()}` : null,
      isActive
    });
    
    if (!isActive) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-800">
          Inactive
        </span>
      );
    } else if (isFull) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-200 text-red-800">
          Full
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-200 text-green-800">
          Active
        </span>
      );
    }
  };

  const getFullRoomMessage = (room) => {
    if (room.current_users >= room.max_users) {
      return (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          ⚠️ This room is currently full ({room.current_users}/{room.max_users} users)
        </div>
      )
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ml-2 text-gray-600">Loading rooms...</span>
        </div>
      </div>
    )
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className="card p-6">
        <div className="text-center py-8">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No rooms found</h3>
          <p className="text-gray-500">Get started by adding your first room above.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card bg-gray-800 text-gray-100 border border-purple-700 rounded-lg shadow-lg">
      <div className="px-6 py-4 border-b border-gray-600">
        <h2 className="text-xl font-semibold text-purple-400">Rooms ({rooms.length})</h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                Room Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                Session Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                Users
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {rooms.map((room) => (
              <tr key={room.id} className="hover:bg-gray-700">
                <td className="px-6 py-4">
                  {editingRoom === room.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        name="name"
                        value={editFormData.name || ''}
                        onChange={handleEditChange}
                        className={`input-field text-sm ${errors.name ? 'border-red-500' : ''}`}
                        placeholder="Room name"
                      />
                      {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
                      
                      <textarea
                        name="description"
                        value={editFormData.description || ''}
                        onChange={handleEditChange}
                        rows={2}
                        className={`input-field text-sm resize-none ${errors.description ? 'border-red-500' : ''}`}
                        placeholder="Description"
                      />
                      {errors.description && <p className="text-xs text-red-600">{errors.description}</p>}
                      
                      <input
                        type="url"
                        name="url"
                        value={editFormData.url || ''}
                        onChange={handleEditChange}
                        className={`input-field text-sm ${errors.url ? 'border-red-500' : ''}`}
                        placeholder="URL"
                      />
                      {errors.url && <p className="text-xs text-red-600">{errors.url}</p>}
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-medium text-gray-100">{room.name}</div>
                      <div className="text-sm text-gray-400 mt-1">{room.description}</div>
                      <div className="text-xs text-purple-400 mt-1 break-all">
                        <a href={room.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {room.url}
                        </a>
                      </div>
                      {getFullRoomMessage(room)}
                    </div>
                  )}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(room)}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingRoom === room.id ? (
                    <div className="space-y-2">
                      <select
                        name="date_option"
                        value={editFormData.date_option || 'today'}
                        onChange={handleEditChange}
                        className="input-field text-sm w-full"
                      >
                        <option value="today">Today</option>
                        <option value="tomorrow">Tomorrow</option>
                        <option value="day_after_tomorrow">Day After Tomorrow</option>
                      </select>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <input
                            type="time"
                            name="start_time"
                            value={editFormData.start_time || ''}
                            onChange={handleEditChange}
                            className={`input-field text-sm w-full ${errors.start_time ? 'border-red-500' : ''}`}
                          />
                          {errors.start_time && <p className="text-xs text-red-600 mt-1">{errors.start_time}</p>}
                        </div>
                        <div>
                          <input
                            type="time"
                            name="end_time"
                            value={editFormData.end_time || ''}
                            onChange={handleEditChange}
                            className={`input-field text-sm w-full ${errors.end_time ? 'border-red-500' : ''}`}
                          />
                          {errors.end_time && <p className="text-xs text-red-600 mt-1">{errors.end_time}</p>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-100">
                      {formatSessionTime(room)}
                    </div>
                  )}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingRoom === room.id ? (
                    <div>
                      <input
                        type="number"
                        name="max_users"
                        value={editFormData.max_users || ''}
                        onChange={handleEditChange}
                        min="1"
                        className={`input-field text-sm w-20 ${errors.max_users ? 'border-red-500' : ''}`}
                        placeholder="Max"
                      />
                      {errors.max_users && <p className="text-xs text-red-600 mt-1">{errors.max_users}</p>}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-100">
                      <span className="font-medium">{room.current_users || 0}</span>
                      <span className="text-gray-400"> / {room.max_users}</span>
                    </div>
                  )}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingRoom === room.id ? (
                    <div>
                      <input
                        type="number"
                        name="price_inr"
                        value={editFormData.price_inr || ''}
                        onChange={handleEditChange}
                        min="0"
                        step="1"
                        className={`input-field text-sm w-24 ${errors.price_inr ? 'border-red-500' : ''}`}
                        placeholder="Price"
                      />
                      {errors.price_inr && <p className="text-xs text-red-600 mt-1">{errors.price_inr}</p>}
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-gray-100">
                      ₹{room.price_inr}/hr
                    </div>
                  )}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingRoom === room.id ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleSaveEdit(room.id)}
                        disabled={isSubmitting}
                        className="text-green-400 hover:text-green-300 text-sm font-medium disabled:opacity-50"
                      >
                        {isSubmitting ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={isSubmitting}
                        className="text-gray-400 hover:text-gray-300 text-sm font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditClick(room)}
                        className="text-purple-400 hover:text-purple-300 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(room.id, room.name)}
                        className="text-red-400 hover:text-red-300 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RoomList