import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'supabase_session';

export async function saveSession(session: any) {
  try {
    if (!session) {
      console.error('❌ No session provided to saveSession');
      return;
    }
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    console.log('✅ Session saved successfully');
  } catch (error) {
    console.error('❌ Error saving session:', error);
  }
}

export async function getStoredSession() {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (raw) {
      console.log('✅ Retrieved stored session');
      return JSON.parse(raw);
    }
    console.log('ℹ️ No stored session found');
    return null;
  } catch (error) {
    console.error('❌ Error retrieving session:', error);
    return null;
  }
}

export async function clearSession() {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    console.log('✅ Session cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing session:', error);
  }
}