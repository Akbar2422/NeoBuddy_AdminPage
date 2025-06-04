import { createClient } from '@supabase/supabase-js'

// Initialize the Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Sample database schema for rooms table:
// CREATE TABLE rooms (
//   id uuid PRIMARY KEY,
//   name TEXT,
//   description TEXT,
//   url TEXT,
//   max_users INT DEFAULT 100,
//   current_users INT DEFAULT 0,
//   price_inr INT DEFAULT 50,
//   session_date DATE,
//   session_start_time TIMESTAMPTZ,
//   session_end_time TIMESTAMPTZ,
//   created_at TIMESTAMPTZ
// );
//
// ALTER TABLE rooms ADD COLUMN session_date DATE;

// Room operations
export const roomService = {
  // Get all rooms
  async getAllRooms() {
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
      
      console.log(`roomService.getAllRooms - UTC date: ${todayStr}, Local time: ${new Date().toString()}`);
      
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('session_date', todayStr)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching rooms:', error);
      return { data: null, error: error.message };
    }
  },
  
  // Get all rooms (including past rooms)
  async getAllRoomsHistory() {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching room history:', error);
      return { data: null, error: error.message };
    }
  },

  // Add new room
  async addRoom(roomData) {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert([{
          name: roomData.name,
          description: roomData.description,
          url: roomData.url,
          max_users: roomData.max_users,
          price_inr: roomData.price_inr,
          session_date: roomData.session_date, // Add session_date field
          session_start_time: roomData.session_start_time,
          session_end_time: roomData.session_end_time,
          current_users: 0
        }])
        .select()
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error adding room:', error)
      return { data: null, error: error.message }
    }
  },

  // Update room
  async updateRoom(id, roomData) {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .update({
          name: roomData.name,
          description: roomData.description,
          url: roomData.url,
          max_users: roomData.max_users,
          price_inr: roomData.price_inr,
          session_date: roomData.session_date, // Add session_date field
          session_start_time: roomData.session_start_time,
          session_end_time: roomData.session_end_time
        })
        .eq('id', id)
        .select()
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error updating room:', error)
      return { data: null, error: error.message }
    }
  },

  // Delete room
  async deleteRoom(id) {
    try {
      // First delete related user_sessions records to avoid foreign key constraint violation
      const { error: sessionsError } = await supabase
        .from('user_sessions')
        .delete()
        .eq('room_id', id)
      
      if (sessionsError) throw sessionsError
      
      // Then delete the room
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('Error deleting room:', error)
      return { error: error.message }
    }
  },

  // Update current users count
  async updateCurrentUsers(id, currentUsers) {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .update({ 
          current_users: currentUsers
        })
        .eq('id', id)
        .select()
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error updating current users:', error)
      return { data: null, error: error.message }
    }
  }
}

// Promo Code operations
export const promoCodeService = {
  // Get all promo codes
  async getAllPromoCodes() {
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error fetching promo codes:', error)
      return { data: null, error: error.message }
    }
  },

  // Add new promo code
  async addPromoCode(promoCodeData) {
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .insert([promoCodeData])
        .select()
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error adding promo code:', error)
      return { data: null, error: error.message }
    }
  },

  // Update promo code
  async updatePromoCode(id, promoCodeData) {
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .update(promoCodeData)
        .eq('id', id)
        .select()
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error updating promo code:', error)
      return { data: null, error: error.message }
    }
  },

  // Delete promo code
  async deletePromoCode(id) {
    try {
      const { error } = await supabase
        .from('promo_codes')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('Error deleting promo code:', error)
      return { error: error.message }
    }
  }
}

// Payout operations for influencer withdrawals
export const payoutService = {
  // Get all withdrawal requests
  async getAllWithdrawals() {
    try {
      const { data, error } = await supabase
        .from('influencer_withdrawals')
        .select('*')
        .order('requested_at', { ascending: false })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error fetching withdrawal requests:', error)
      return { data: null, error: error.message }
    }
  },

  // Mark withdrawal as paid
  async markAsPaid(id, notes = null) {
    try {
      // Start a Supabase transaction using RPC
      const { data, error } = await supabase.rpc('process_withdrawal_payment', {
        withdrawal_id: id,
        admin_notes: notes
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error marking withdrawal as paid:', error)
      return { data: null, error: error.message }
    }
  },

  // Reject withdrawal request
  async rejectWithdrawal(id, notes) {
    try {
      // First check if the notes column exists by getting the current record
      const { data: currentRecord, error: fetchError } = await supabase
        .from('influencer_withdrawals')
        .select('*')
        .eq('id', id)
        .single()
      
      if (fetchError) throw fetchError
      
      // Prepare update object with required status field
      const updateObj = { status: 'rejected' }
      
      // Only add notes field if it exists in the current record schema
      if ('notes' in currentRecord) {
        updateObj.notes = notes
      }
      
      // Update the record
      const { data, error } = await supabase
        .from('influencer_withdrawals')
        .update(updateObj)
        .eq('id', id)
        .select()
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error rejecting withdrawal:', error)
      return { data: null, error: error.message }
    }
  },
  
  // Get influencer balance
  async getInfluencerBalance(influencerId) {
    try {
      const { data, error } = await supabase
        .from('influencer_balances')
        .select('*')
        .eq('influencer_id', influencerId)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error // PGRST116 is the error code for no rows returned
      
      return { 
        data: data || { 
          influencer_id: influencerId, 
          total_earned: 0, 
          total_paid: 0 
        }, 
        error: null 
      }
    } catch (error) {
      console.error('Error fetching influencer balance:', error)
      return { data: null, error: error.message }
    }
  }
}

// Status message operations
export const statusMessageService = {
  // Get the current status message
  async getStatusMessage() {
    try {
      const { data, error } = await supabase
        .from('status_message')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return { data: data?.[0] || null, error: null };
    } catch (error) {
      console.error('Error fetching status message:', error);
      return { data: null, error: error.message };
    }
  },

  // Update the status message
  async updateStatusMessage(message) {
    try {
      // First check if a message exists
      const { data: existingMessage } = await this.getStatusMessage();
      
      let result;
      
      if (existingMessage) {
        // Update existing message
        result = await supabase
          .from('status_message')
          .update({
            message,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMessage.id)
          .select();
      } else {
        // Create new message
        result = await supabase
          .from('status_message')
          .insert({
            message,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select();
      }
      
      if (result.error) throw result.error;
      return { data: result.data?.[0] || null, error: null };
    } catch (error) {
      console.error('Error updating status message:', error);
      return { data: null, error: error.message };
    }
  },

  // Delete the status message
  async deleteStatusMessage() {
    try {
      // First check if a message exists
      const { data: existingMessage } = await this.getStatusMessage();
      
      if (!existingMessage) {
        return { data: null, error: null }; // Nothing to delete
      }
      
      const { error } = await supabase
        .from('status_message')
        .delete()
        .eq('id', existingMessage.id);
      
      if (error) throw error;
      return { data: true, error: null };
    } catch (error) {
      console.error('Error deleting status message:', error);
      return { data: null, error: error.message };
    }
  }
}