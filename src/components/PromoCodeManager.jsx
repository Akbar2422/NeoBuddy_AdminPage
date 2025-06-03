import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, promoCodeService } from '../lib/supabase';

const PromoCodeManager = () => {
  const [promoCodeData, setPromoCodeData] = useState({
    code: '',
    influencer_id: '',
    discount_amount: 20,
    max_uses: 50,
    expiry_date: ''
  });
  const [promoCodes, setPromoCodes] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPromoCode, setEditingPromoCode] = useState(null);
  
  // Delete confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [promoCodeToDelete, setPromoCodeToDelete] = useState(null);
  
  // Ref for edit form
  const editFormRef = useRef(null);

  // Load promo codes on component mount
  useEffect(() => {
    loadPromoCodes();

    // Set up real-time subscription for promo code changes
    const promoCodeSubscription = supabase
      .channel('promo-codes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'promo_codes'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPromoCodes((prev) => {
              const newPromoCode = payload.new;
              // Avoid duplicates
              if (prev.some(code => code.id === newPromoCode.id)) return prev;
              return [...prev, newPromoCode];
            });
          }

          if (payload.eventType === 'UPDATE') {
            const updatedPromoCode = payload.new;
            setPromoCodes((prev) =>
              prev.map((code) =>
                code.id === updatedPromoCode.id ? updatedPromoCode : code
              )
            );
          }

          if (payload.eventType === 'DELETE') {
            const deletedPromoCode = payload.old;
            setPromoCodes((prev) =>
              prev.filter((code) => code.id !== deletedPromoCode.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(promoCodeSubscription);
    };
  }, []);

  // Load all promo codes
  const loadPromoCodes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await promoCodeService.getAllPromoCodes();
      if (error) throw error;
      setPromoCodes(data || []);
    } catch (err) {
      console.error("Error loading promo codes:", err);
      setError('Failed to load promo codes');
      showNotification('Failed to load promo codes', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPromoCodeData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  // Validate form inputs
  const validateForm = () => {
    const newErrors = {};
    
    if (!promoCodeData.code.trim()) {
      newErrors.code = 'Promo code is required';
    } else if (!/^[A-Z0-9_]+$/.test(promoCodeData.code)) {
      newErrors.code = 'Promo code should contain only uppercase letters, numbers, and underscores';
    }
    
    if (!promoCodeData.influencer_id.trim()) {
      newErrors.influencer_id = 'Influencer ID is required';
    }
    
    if (!promoCodeData.discount_amount || promoCodeData.discount_amount <= 0) {
      newErrors.discount_amount = 'Discount amount must be greater than 0';
    }
    
    if (!promoCodeData.max_uses || promoCodeData.max_uses < 1) {
      newErrors.max_uses = 'Maximum uses must be at least 1';
    }
    
    // Validate expiry date if provided
    if (promoCodeData.expiry_date && new Date(promoCodeData.expiry_date) < new Date()) {
      newErrors.expiry_date = 'Expiry date cannot be in the past';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission for adding new promo code
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const promoCodePayload = {
        code: promoCodeData.code,
        influencer_id: promoCodeData.influencer_id,
        discount_amount: parseInt(promoCodeData.discount_amount),
        max_uses: parseInt(promoCodeData.max_uses)
      };
      
      // Add expiry_date if provided
      if (promoCodeData.expiry_date) {
        promoCodePayload.expiry_date = promoCodeData.expiry_date;
      }
      
      const { error } = await promoCodeService.addPromoCode(promoCodePayload);
      
      if (error) throw error;
      
      // Reset form
      setPromoCodeData({
        code: '',
        influencer_id: '',
        discount_amount: 20,
        max_uses: 50,
        expiry_date: ''
      });
      
      showNotification('✅ Promo code added successfully!', 'success');
    } catch (err) {
      console.error("Error adding promo code:", err);
      showNotification('❌ Failed to add promo code. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle edit button click
  const handleEditClick = (promoCode) => {
    console.log('Edit button clicked for promo code:', promoCode);
    setIsEditMode(true);
    setEditingPromoCode(promoCode);
    setPromoCodeData({
      code: promoCode.code,
      influencer_id: promoCode.influencer_id || '',
      discount_amount: promoCode.discount_amount,
      max_uses: promoCode.max_uses,
      expiry_date: promoCode.expiry_date || ''
    });
    
    // Ensure we're using the correct ref and add a small delay for reliability
    setTimeout(() => {
      if (editFormRef.current) {
        editFormRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 300); // Increased delay for more reliability
  };

  // Handle delete button click
  const handleDeleteClick = (promoCode) => {
    console.log('Delete button clicked for promo code:', promoCode);
    setPromoCodeToDelete(promoCode);
    setShowDeleteModal(true);
  };
  
  // Handle edit form submission
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm() || isSubmitting || !editingPromoCode) return;
    
    setIsSubmitting(true);
    
    try {
      const promoCodePayload = {
        discount_amount: parseInt(promoCodeData.discount_amount),
        max_uses: parseInt(promoCodeData.max_uses),
        influencer_id: promoCodeData.influencer_id
      };
      
      // Add expiry_date if provided
      if (promoCodeData.expiry_date) {
        promoCodePayload.expiry_date = promoCodeData.expiry_date;
      } else {
        // Set to null if empty string
        promoCodePayload.expiry_date = null;
      }
      
      const { error } = await promoCodeService.updatePromoCode(editingPromoCode.id, promoCodePayload);
      
      if (error) throw error;
      
      // Reset form and exit edit mode
      setPromoCodeData({
        code: '',
        influencer_id: '',
        discount_amount: 20,
        max_uses: 50,
        expiry_date: ''
      });
      setIsEditMode(false);
      setEditingPromoCode(null);
      
      showNotification('✅ Promo code updated successfully!', 'success');
    } catch (err) {
      console.error("Error updating promo code:", err);
      showNotification('❌ Failed to update promo code. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditingPromoCode(null);
    setPromoCodeData({
      code: '',
      influencer_id: '',
      discount_amount: 20,
      max_uses: 50,
      expiry_date: ''
    });
    setErrors({});
  };
  
  // Remove duplicate handleDeleteClick function
  
  // Handle confirm delete
  const handleConfirmDelete = async () => {
    if (!promoCodeToDelete) return;
    
    try {
      const { error } = await promoCodeService.deletePromoCode(promoCodeToDelete.id);
      
      if (error) throw error;
      
      // Close modal
      setShowDeleteModal(false);
      setPromoCodeToDelete(null);
      
      showNotification('✅ Promo code deleted successfully!', 'success');
    } catch (err) {
      console.error("Error deleting promo code:", err);
      showNotification('❌ Failed to delete promo code. Please try again.', 'error');
    }
  };
  
  // Handle cancel delete
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setPromoCodeToDelete(null);
  };

  // Show notification
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Animation variants for cards
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5,
        ease: 'easeOut'
      }
    })
  };

  return (
    <div className="mt-12">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-6">Promo Code Generator</h2>
        
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
        
        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 border border-red-500 rounded-lg p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-xl font-bold text-white mb-4">Confirm Deletion</h3>
              <p className="text-gray-300 mb-6">Are you sure? This will delete all usage history for code <span className="text-red-400 font-semibold">{promoCodeToDelete?.code}</span>.</p>
              
              <div className="flex justify-end space-x-4">
                <button
                  onClick={handleCancelDelete}
                  className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
        
        {/* Promo Code Form */}
        <div ref={editFormRef}>
          <form 
            onSubmit={isEditMode ? handleEditSubmit : handleSubmit} 
            className="bg-gray-800 border border-purple-700 rounded-lg p-6 shadow-lg"
          >
            <h3 className="text-xl font-bold text-white mb-4">
              {isEditMode ? 'Edit Promo Code' : 'Create New Promo Code'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-1">
                  Promo Code Name
                </label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  value={promoCodeData.code}
                  onChange={handleInputChange}
                  placeholder="NEOBUDDY_INFLUENCER_A"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={isEditMode} // Can't edit code once created
                />
                {errors.code && <p className="mt-1 text-sm text-red-400">{errors.code}</p>}
              </div>
              
              <div>
                <label htmlFor="influencer_id" className="block text-sm font-medium text-gray-300 mb-1">
                  Influencer ID
                </label>
                <input
                  type="text"
                  id="influencer_id"
                  name="influencer_id"
                  value={promoCodeData.influencer_id}
                  onChange={handleInputChange}
                  placeholder="@influencer1"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {errors.influencer_id && <p className="mt-1 text-sm text-red-400">{errors.influencer_id}</p>}
              </div>
              
              <div>
                <label htmlFor="discount_amount" className="block text-sm font-medium text-gray-300 mb-1">
                  Discount Amount (₹)
                </label>
                <input
                  type="number"
                  id="discount_amount"
                  name="discount_amount"
                  value={promoCodeData.discount_amount}
                  onChange={handleInputChange}
                  min="1"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {errors.discount_amount && <p className="mt-1 text-sm text-red-400">{errors.discount_amount}</p>}
              </div>
              
              <div>
                <label htmlFor="max_uses" className="block text-sm font-medium text-gray-300 mb-1">
                  Maximum Uses
                </label>
                <input
                  type="number"
                  id="max_uses"
                  name="max_uses"
                  value={promoCodeData.max_uses}
                  onChange={handleInputChange}
                  min="1"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {errors.max_uses && <p className="mt-1 text-sm text-red-400">{errors.max_uses}</p>}
              </div>
              
              <div className="md:col-span-2">
                <label htmlFor="expiry_date" className="block text-sm font-medium text-gray-300 mb-1">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  id="expiry_date"
                  name="expiry_date"
                  value={promoCodeData.expiry_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {errors.expiry_date && <p className="mt-1 text-sm text-red-400">{errors.expiry_date}</p>}
                <p className="mt-1 text-xs text-gray-400">Leave blank for no expiration</p>
              </div>
            </div>
            
            <div className="mt-6 flex gap-4">
              {isEditMode ? (
                <>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-purple-700 text-white rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-4 py-2 bg-purple-700 text-white rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Adding...' : 'Add Promo Code'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
      
      {/* Promo Codes List */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Promo Codes</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {promoCodes.length === 0 ? (
            <p className="text-gray-400 col-span-full text-center py-8">No promo codes found. Add your first promo code above.</p>
          ) : (
            promoCodes.map((code, index) => (
              <motion.div
                key={code.id}
                custom={index}
                initial="hidden"
                animate="visible"
                variants={cardVariants}
                className="bg-gray-800 border border-purple-700 rounded-lg overflow-hidden shadow-lg relative group"
              >
                {/* Particle effects on hover (similar to room cards) */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-white truncate">{code.code}</h3>
                    <span 
                      className={`px-2 py-1 text-xs rounded-full ${code.total_uses < code.max_uses && (!code.expiry_date || new Date(code.expiry_date) > new Date()) ? 'bg-green-900/30 text-green-400 border border-green-500' : 'bg-red-900/30 text-red-400 border border-red-500'}`}
                    >
                      {code.total_uses < code.max_uses && (!code.expiry_date || new Date(code.expiry_date) > new Date()) ? 'Active' : 'Expired'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Discount:</span>
                      <span className="text-white font-medium">₹{code.discount_amount}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-400">Uses:</span>
                      <span className="text-white font-medium">{code.total_uses || 0} / {code.max_uses}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-400">Influencer:</span>
                      <span className="text-white font-medium">{code.influencer_id}</span>
                    </div>
                    
                    {code.expiry_date && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Expires:</span>
                        <span className="text-white font-medium">{new Date(code.expiry_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between">
                      <span className="text-gray-400">Created:</span>
                      <span className="text-white font-medium">{new Date(code.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="mt-4 flex justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditClick(code)}
                      className="flex-1 px-3 py-1.5 bg-blue-700 text-white text-sm rounded hover:bg-blue-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 z-10 pointer-events-auto"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(code)}
                      className="flex-1 px-3 py-1.5 bg-red-700 text-white text-sm rounded hover:bg-red-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 z-10 pointer-events-auto"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                
                {/* Progress bar for usage */}
                <div className="w-full bg-gray-700 h-1">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-1"
                    style={{ width: `${Math.min(((code.total_uses || 0) / code.max_uses) * 100, 100)}%` }}
                  ></div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PromoCodeManager;