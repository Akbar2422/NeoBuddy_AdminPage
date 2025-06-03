import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

// TypeScript interfaces
interface WithdrawalRequest {
  id: string;
  influencer_id: string;
  amount: number;
  amount_withdrawn: number; // Added this field to handle both naming conventions
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  payment_method: string;
  requested_at: string;
  paid_at: string | null;
  notes: string | null;
}

interface InfluencerBalance {
  id: string;
  influencer_id: string;
  total_earned: number;
  total_paid: number;
  last_updated: string;
}

// Payout service for handling withdrawal requests
const payoutService = {
  // Get all withdrawal requests
  async getAllWithdrawals() {
    try {
      const { data, error } = await supabase
        .from('influencer_withdrawals')
        .select('*')
        .order('requested_at', { ascending: false });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error('Error fetching withdrawal requests:', error);
      return { data: null, error: error.message };
    }
  },

  // Mark withdrawal as paid
  async markAsPaid(id: string, notes: string | null = null) {
    try {
      // Start a Supabase transaction using RPC
      const { data, error } = await supabase.rpc('process_withdrawal_payment', {
        withdrawal_id: id,
        admin_notes: notes
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error('Error marking withdrawal as paid:', error);
      return { data: null, error: error.message };
    }
  },

  // Reject withdrawal request
  async rejectWithdrawal(id: string, notes: string) {
    try {
      const { data, error } = await supabase
        .from('influencer_withdrawals')
        .update({
          status: 'rejected',
          notes: notes
        })
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error('Error rejecting withdrawal:', error);
      return { data: null, error: error.message };
    }
  }
};

const PayoutManager: React.FC = () => {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Confirmation modals state
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [notes, setNotes] = useState<string>('');

  // Load withdrawal requests
  const loadWithdrawals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await payoutService.getAllWithdrawals();
      if (error) throw new Error(error);
      setWithdrawals(data || []);
    } catch (err: any) {
      console.error("Error loading withdrawal requests:", err);
      setError('Failed to load withdrawal requests');
      showNotification('Failed to load withdrawal requests', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Filter withdrawals by status
  const filteredWithdrawals = withdrawals.filter(withdrawal => {
    if (statusFilter === 'all') return true;
    return withdrawal.status === statusFilter;
  });

  // Load withdrawals on component mount and set up real-time subscription
  useEffect(() => {
    loadWithdrawals();

    // Set up real-time subscription for withdrawal request changes
    const withdrawalSubscription = supabase
      .channel('withdrawal-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'influencer_withdrawals'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setWithdrawals((prev) => {
              const newWithdrawal = payload.new as WithdrawalRequest;
              // Avoid duplicates
              if (prev.some(w => w.id === newWithdrawal.id)) return prev;
              return [newWithdrawal, ...prev];
            });
          }

          if (payload.eventType === 'UPDATE') {
            const updatedWithdrawal = payload.new as WithdrawalRequest;
            setWithdrawals((prev) =>
              prev.map((w) =>
                w.id === updatedWithdrawal.id ? updatedWithdrawal : w
              )
            );
          }

          if (payload.eventType === 'DELETE') {
            const deletedWithdrawal = payload.old as WithdrawalRequest;
            setWithdrawals((prev) =>
              prev.filter((w) => w.id !== deletedWithdrawal.id)
            );
          }
        }
      )
      .subscribe();

    // Also subscribe to balance changes
    const balanceSubscription = supabase
      .channel('balance-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'influencer_balances'
        },
        () => {
          // When balances change, refresh withdrawals to get latest status
          loadWithdrawals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(withdrawalSubscription);
      supabase.removeChannel(balanceSubscription);
    };
  }, [loadWithdrawals]);

  // Handle pay button click
  const handlePayClick = (withdrawal: WithdrawalRequest) => {
    setSelectedWithdrawal(withdrawal);
    setNotes('');
    setShowPayModal(true);
  };

  // Handle reject button click
  const handleRejectClick = (withdrawal: WithdrawalRequest) => {
    setSelectedWithdrawal(withdrawal);
    setNotes('');
    setShowRejectModal(true);
  };

  // Handle confirm pay
  const handleConfirmPay = async () => {
    if (!selectedWithdrawal) return;
    
    try {
      const { error } = await payoutService.markAsPaid(selectedWithdrawal.id, notes || null);
      
      if (error) throw new Error(error);
      
      // Close modal
      setShowPayModal(false);
      setSelectedWithdrawal(null);
      setNotes('');
      
      showNotification('✅ Payment marked as completed successfully!', 'success');
    } catch (err: any) {
      console.error("Error processing payment:", err);
      showNotification('❌ Failed to process payment. Please try again.', 'error');
    }
  };

  // Handle confirm reject
  const handleConfirmReject = async () => {
    if (!selectedWithdrawal || !notes.trim()) return;
    
    try {
      const { error } = await payoutService.rejectWithdrawal(selectedWithdrawal.id, notes);
      
      if (error) throw new Error(error);
      
      // Close modal
      setShowRejectModal(false);
      setSelectedWithdrawal(null);
      setNotes('');
      
      showNotification('✅ Withdrawal request rejected successfully!', 'success');
    } catch (err: any) {
      console.error("Error rejecting withdrawal:", err);
      showNotification('❌ Failed to reject withdrawal. Please try again.', 'error');
    }
  };

  // Handle cancel modals
  const handleCancelModal = () => {
    setShowPayModal(false);
    setShowRejectModal(false);
    setSelectedWithdrawal(null);
    setNotes('');
  };

  // Show notification
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-900/30 border-yellow-500 text-yellow-400';
      case 'approved':
        return 'bg-blue-900/30 border-blue-500 text-blue-400';
      case 'paid':
        return 'bg-green-900/30 border-green-500 text-green-400';
      case 'rejected':
        return 'bg-red-900/30 border-red-500 text-red-400';
      default:
        return 'bg-gray-900/30 border-gray-500 text-gray-400';
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: 'easeOut'
      }
    }
  };

  return (
    <div className="mt-12">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-6">Influencer Payout Manager</h2>
        
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
        
        {/* Pay Confirmation Modal */}
        {showPayModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 border border-green-500 rounded-lg p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-xl font-bold text-white mb-4">Confirm Payment</h3>
              <p className="text-gray-300 mb-4">
                Are you sure you want to mark payment of <span className="text-green-400 font-semibold">₹{selectedWithdrawal?.amount_withdrawn != null ? selectedWithdrawal.amount_withdrawn : selectedWithdrawal?.amount}</span> to <span className="text-green-400 font-semibold">{selectedWithdrawal?.influencer_id}</span> as completed?
              </p>
              <p className="text-gray-300 mb-6">This will update the influencer's balance records.</p>
              
              <div className="mb-4">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-1">
                  Payment Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Transaction ID, payment method details, etc."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end space-x-4">
                <button
                  onClick={handleCancelModal}
                  className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPay}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 transition-colors"
                >
                  Confirm Payment
                </button>
              </div>
            </motion.div>
          </div>
        )}
        
        {/* Reject Confirmation Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 border border-red-500 rounded-lg p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-xl font-bold text-white mb-4">Reject Withdrawal Request</h3>
              <p className="text-gray-300 mb-4">
                Are you sure you want to reject the withdrawal request of <span className="text-red-400 font-semibold">₹{selectedWithdrawal?.amount_withdrawn != null ? selectedWithdrawal.amount_withdrawn : selectedWithdrawal?.amount}</span> from <span className="text-red-400 font-semibold">{selectedWithdrawal?.influencer_id}</span>?
              </p>
              
              <div className="mb-4">
                <label htmlFor="reject-notes" className="block text-sm font-medium text-gray-300 mb-1">
                  Rejection Reason <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="reject-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Please provide a reason for rejection"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  rows={3}
                  required
                />
                {notes.trim() === '' && (
                  <p className="mt-1 text-sm text-red-400">Rejection reason is required</p>
                )}
              </div>
              
              <div className="flex justify-end space-x-4">
                <button
                  onClick={handleCancelModal}
                  className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={notes.trim() === ''}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reject Request
                </button>
              </div>
            </motion.div>
          </div>
        )}
        
        {/* Status Filter */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${statusFilter === 'all' ? 'bg-purple-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              All Requests
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${statusFilter === 'pending' ? 'bg-yellow-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${statusFilter === 'approved' ? 'bg-blue-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              Approved
            </button>
            <button
              onClick={() => setStatusFilter('paid')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${statusFilter === 'paid' ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              Paid
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${statusFilter === 'rejected' ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              Rejected
            </button>
          </div>
        </div>
      </div>
      
      {/* Withdrawals List */}
<div>
  <h2 className="text-2xl font-bold text-white mb-6">Withdrawal Requests</h2>
  
  {isLoading ? (
    <div className="flex justify-center items-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
    </div>
  ) : error ? (
    <div className="bg-red-900/30 border border-red-500 text-red-400 p-4 rounded-lg">
      {error}
    </div>
  ) : (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="overflow-x-auto"
    >
      {filteredWithdrawals.length === 0 ? (
        <p className="text-gray-400 text-center py-8">
          No withdrawal requests found with the selected filter.
        </p>
      ) : (
        <table className="min-w-full bg-gray-800 border border-purple-700 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-900">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Influencer ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Amount (₹)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Payment Method
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Requested At
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Paid At
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Notes
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredWithdrawals.map((withdrawal, index) => (
              <motion.tr 
                key={withdrawal.id}
                variants={itemVariants}
                custom={index}
                className="hover:bg-gray-700 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                  {withdrawal.influencer_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                  {/* Check for both amount and amount_withdrawn fields */}
                  ₹{(withdrawal.amount_withdrawn != null ? withdrawal.amount_withdrawn : withdrawal.amount != null ? withdrawal.amount : '-').toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusBadgeClass(withdrawal.status)}`}>
                    {withdrawal.status ? withdrawal.status.charAt(0).toUpperCase() + withdrawal.status.slice(1) : '-'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {withdrawal.payment_method || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {formatDate(withdrawal.requested_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {formatDate(withdrawal.paid_at)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-300 max-w-xs truncate">
                  {withdrawal.notes || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {(withdrawal.status === 'pending' || withdrawal.status === 'approved') ? (
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handlePayClick(withdrawal)}
                        className="px-3 py-1 bg-green-700 text-white rounded hover:bg-green-600 transition-colors z-10 pointer-events-auto"
                      >
                        Mark as Paid
                      </button>
                      <button
                        onClick={() => handleRejectClick(withdrawal)}
                        className="px-3 py-1 bg-red-700 text-white rounded hover:bg-red-600 transition-colors z-10 pointer-events-auto"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      )}
    </motion.div>
  )}
</div>

    </div>
  );
};

export default PayoutManager;