// services/api.js
import { supabase } from './supabase.js';
import { App } from '../app/app.js';

/**
 * Saves a completed quiz result to the database
 */
export async function saveQuizResult(userId, scores, ideology) {
     try {
        const { error: resultError } = await supabase
            .from('quiz_results')
            .insert({ 
                user_id: userId, 
                scores: scores,
                ideology: ideology,
                xp_gained: 100 // TODO: Tie to gamification system
            });
        if (resultError) throw resultError;
        
        // Also update the 'latest_ideology' on the user's profile
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ latest_ideology: ideology })
            .eq('id', userId);
        if (profileError) throw profileError;
        
        return { success: true };
    } catch (error) {
        console.error("Error saving quiz results:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches profile data for a user
 */
export async function getProfile(userId) {
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, created_at, latest_ideology, level, xp') // Added 'id'
        .eq('id', userId)
        .single();
    
    if (profileError) throw profileError;
    return profileData;
}

/**
 * Fetches all quiz results for a user (for the journey chart)
 */
export async function getQuizHistory(userId) {
    const { data: resultsData, error: resultsError } = await supabase
        .from('quiz_results')
        .select('created_at, scores')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
    
    if (resultsError) throw resultsError;
    return resultsData;
}

// --- NEW M2 FUNCTIONS ---

/**
 * Searches for users by username
 */
export async function searchUsers(query) {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, username, level, latest_ideology')
        .ilike('username', `%${query}%`) // case-insensitive search
        .limit(20);
    
    if (error) throw error;
    return data;
}

/**
 * Gets the friendship status between the current user and another user
 */
export async function getFriendship(otherUserId) {
    const currentUserId = App.state.user?.id;
    if (!currentUserId || currentUserId === otherUserId) return null;

    const { data, error } = await supabase
        .from('friends')
        .select('user_id_a, user_id_b, status')
        .or(`(user_id_a.eq.${currentUserId},user_id_b.eq.${otherUserId}),(user_id_a.eq.${otherUserId},user_id_b.eq.${currentUserId})`)
        .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = 0 rows, which is fine
        console.error("Error getting friendship:", error);
        return null;
    }
    return data;
}

/**
 * Creates a new friend request
 */
export async function addFriend(friendId) {
    const currentUserId = App.state.user?.id;
    if (!currentUserId) return;

    const { data, error } = await supabase
        .from('friends')
        .insert({
            user_id_a: currentUserId,
            user_id_b: friendId,
            status: 'pending'
        });
    
    if (error) throw error;
    return data;
}

/**
 * Accepts a friend request
 */
export async function acceptFriend(friendId) {
    const currentUserId = App.state.user?.id;
    if (!currentUserId) return;

    // We must be user_id_b to accept
    const { data, error } = await supabase
        .from('friends')
        .update({ status: 'friends' })
        .eq('user_id_a', friendId)
        .eq('user_id_b', currentUserId)
        .eq('status', 'pending');
    
    if (error) throw error;
    return data;
}

/**
 * Removes a friend, declines a request, or cancels a request
 */
export async function removeFriend(friendId) {
    const currentUserId = App.state.user?.id;
    if (!currentUserId) return;

    const { data, error } = await supabase
        .from('friends')
        .delete()
        .or(`(user_id_a.eq.${currentUserId},user_id_b.eq.${friendId}),(user_id_a.eq.${friendId},user_id_b.eq.${currentUserId})`);

    if (error) throw error;
    return data;
}

/**
 * Gets a list of all accepted friends for a user
 */
export async function getFriends(userId) {
    const { data, error } = await supabase
        .from('friends')
        .select(`
            user_id_a ( id, username, level ),
            user_id_b ( id, username, level )
        `)
        .eq('status', 'friends')
        .or(`user_id_a.eq.${userId},user_id_b.eq.${userId}`);

    if (error) throw error;

    // The data returns objects { user_id_a: {...}, user_id_b: {...} }
    // We need to flatten this into a list of the *other* user
    const friends = data.map(friendship => {
        return friendship.user_id_a.id === userId ? friendship.user_id_b : friendship.user_id_a;
    });
    
    return friends;
}
