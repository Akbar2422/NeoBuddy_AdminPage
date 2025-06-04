import React, { useState } from 'react'

const AddRoomForm = ({ onAddRoom, isLoading }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    url: '',
    max_users: 100,
    price_inr: '',
    date_option: 'today', // Default to today
    start_time: '09:00', // Default to 9 AM
    end_time: '17:00'    // Default to 5 PM
  })
  
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitLock, setSubmitLock] = useState(false) // Prevent double submissions

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Room name is required'
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }
    
    if (!formData.url.trim()) {
      newErrors.url = 'URL is required'
    } else if (!isValidUrl(formData.url)) {
      newErrors.url = 'Please enter a valid URL'
    }
    
    if (!formData.max_users || formData.max_users < 1) {
      newErrors.max_users = 'Max users must be at least 1'
    }
    
    if (!formData.price_inr || parseFloat(formData.price_inr) <= 0) {
      newErrors.price_inr = 'Price must be greater than 0'
    }

    if (!formData.start_time) {
      newErrors.start_time = 'Start time is required'
    }

    if (!formData.end_time) {
      newErrors.end_time = 'End time is required'
    }

    if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
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

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  // Convert date_option to an actual date string in YYYY-MM-DD format
  const getSessionDate = (dateOption) => {
    // Create date object for the current date in UTC
    const now = new Date()
    
    // Create a UTC date at 00:00:00 for today
    const today = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0
    ))
    
    // Create a new date object for the session date
    let sessionDate = new Date(today)
    
    // Adjust the date based on the option
    if (dateOption === 'tomorrow') {
      sessionDate.setUTCDate(today.getUTCDate() + 1)
    } else if (dateOption === 'day_after_tomorrow') {
      sessionDate.setUTCDate(today.getUTCDate() + 2)
    }
    
    // Format as YYYY-MM-DD using UTC components
    const year = sessionDate.getUTCFullYear()
    // getUTCMonth() is 0-indexed, so add 1
    const month = String(sessionDate.getUTCMonth() + 1).padStart(2, '0')
    const day = String(sessionDate.getUTCDate()).padStart(2, '0')
    
    // Log for debugging
    console.log(`Date option: ${dateOption}, UTC date: ${year}-${month}-${day}, Local time: ${new Date().toString()}`)
    
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Prevent double submissions
    if (submitLock) return
    setSubmitLock(true)
    
    if (!validateForm()) {
      setSubmitLock(false)
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Format time values for Supabase TIME columns
      if (!isValidTimeFormat(formData.start_time) || !isValidTimeFormat(formData.end_time)) {
        setErrors({
          ...errors,
          start_time: !isValidTimeFormat(formData.start_time) ? 'Invalid time format' : '',
          end_time: !isValidTimeFormat(formData.end_time) ? 'Invalid time format' : ''
        })
        setSubmitLock(false)
        return
      }
      
      // Format times to HH:MM:SS for Supabase
      const sessionStartTime = formatTimeForSupabase(formData.start_time)
      const sessionEndTime = formatTimeForSupabase(formData.end_time)
      
      // Get the session date based on the selected date option
      const sessionDate = getSessionDate(formData.date_option)
      
      await onAddRoom({
        name: formData.name,
        description: formData.description,
        url: formData.url,
        max_users: parseInt(formData.max_users),
        price_inr: parseFloat(formData.price_inr),
        session_date: sessionDate, // Add the session date
        session_start_time: sessionStartTime,
        session_end_time: sessionEndTime,
        date_option: formData.date_option // Keep this for UI purposes only
      })
      
      // Reset form on success
      setFormData({
        name: '',
        description: '',
        url: '',
        max_users: 100,
        price_inr: '',
        date_option: 'today',
        start_time: '09:00',
        end_time: '17:00'
      })
      setErrors({})
    } catch (error) {
      console.error('Error submitting form:', error)
    } finally {
      setIsSubmitting(false)
      // Release the lock after a short delay to prevent accidental double-clicks
      setTimeout(() => setSubmitLock(false), 500)
    }
  }

  return (
    <div className="card p-6 mb-8 bg-gray-800 text-gray-100 border border-purple-700 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold text-purple-400 mb-6">Add New Room</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Room Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
              Room Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-3 py-2 bg-gray-700 border ${errors.name ? 'border-red-500' : 'border-gray-600'} rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500`}
              placeholder="Enter room name"
              disabled={isSubmitting || isLoading}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Max Users */}
          <div>
            <label htmlFor="max_users" className="block text-sm font-medium text-gray-300 mb-1">
              Max Users *
            </label>
            <input
              type="number"
              id="max_users"
              name="max_users"
              value={formData.max_users}
              onChange={handleChange}
              min="1"
              className={`w-full px-3 py-2 bg-gray-700 border ${errors.max_users ? 'border-red-500' : 'border-gray-600'} rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500`}
              placeholder="Enter max users"
              disabled={isSubmitting || isLoading}
            />
            {errors.max_users && (
              <p className="mt-1 text-sm text-red-400">{errors.max_users}</p>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
            Description *
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className={`w-full px-3 py-2 bg-gray-700 border ${errors.description ? 'border-red-500' : 'border-gray-600'} rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none`}
            placeholder="Enter room description"
            disabled={isSubmitting || isLoading}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-400">{errors.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* URL */}
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-300 mb-1">
              URL *
            </label>
            <input
              type="url"
              id="url"
              name="url"
              value={formData.url}
              onChange={handleChange}
              className={`w-full px-3 py-2 bg-gray-700 border ${errors.url ? 'border-red-500' : 'border-gray-600'} rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500`}
              placeholder="https://example.runpod.io"
              disabled={isSubmitting || isLoading}
            />
            {errors.url && (
              <p className="mt-1 text-sm text-red-400">{errors.url}</p>
            )}
          </div>

          {/* Price per Hour */}
          <div>
            <label htmlFor="price_inr" className="block text-sm font-medium text-gray-300 mb-1">
              Price per Hour (INR) *
            </label>
            <input
              type="number"
              id="price_inr"
              name="price_inr"
              value={formData.price_inr}
              onChange={handleChange}
              min="0"
              step="1"
              className={`w-full px-3 py-2 bg-gray-700 border ${errors.price_inr ? 'border-red-500' : 'border-gray-600'} rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500`}
              placeholder="Enter price per hour"
              disabled={isSubmitting || isLoading}
            />
            {errors.price_inr && (
              <p className="mt-1 text-sm text-red-400">{errors.price_inr}</p>
            )}
          </div>
        </div>

        {/* Session Timing Section */}
        <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
          <h3 className="text-md font-medium text-purple-400 mb-3">Session Timing</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date Selection */}
            <div>
              <label htmlFor="date_option" className="block text-sm font-medium text-gray-300 mb-1">
                Session Date *
              </label>
              <select
                id="date_option"
                name="date_option"
                value={formData.date_option}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isSubmitting || isLoading}
              >
                <option value="today">Today</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="day_after_tomorrow">Day After Tomorrow</option>
              </select>
            </div>

            {/* Start Time */}
            <div>
              <label htmlFor="start_time" className="block text-sm font-medium text-gray-300 mb-1">
                Start Time *
              </label>
              <input
                type="time"
                id="start_time"
                name="start_time"
                value={formData.start_time}
                onChange={handleChange}
                className={`w-full px-3 py-2 bg-gray-700 border ${errors.start_time ? 'border-red-500' : 'border-gray-600'} rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500`}
                disabled={isSubmitting || isLoading}
              />
              {errors.start_time && (
                <p className="mt-1 text-sm text-red-400">{errors.start_time}</p>
              )}
            </div>

            {/* End Time */}
            <div>
              <label htmlFor="end_time" className="block text-sm font-medium text-gray-300 mb-1">
                End Time *
              </label>
              <input
                type="time"
                id="end_time"
                name="end_time"
                value={formData.end_time}
                onChange={handleChange}
                className={`w-full px-3 py-2 bg-gray-700 border ${errors.end_time ? 'border-red-500' : 'border-gray-600'} rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500`}
                disabled={isSubmitting || isLoading}
              />
              {errors.end_time && (
                <p className="mt-1 text-sm text-red-400">{errors.end_time}</p>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSubmitting || isLoading || submitLock}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding Room...
              </>
            ) : (
              'Add Room'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddRoomForm