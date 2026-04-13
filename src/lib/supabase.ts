import { createClient } from '@supabase/supabase-js';

// Validate environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase URL or Anon Key is missing. Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your environment variables.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true, // Automatically refresh tokens when they expire
    persistSession: true, // Persist session across app restarts
    detectSessionInUrl: false, // Disable URL-based session detection (not applicable in React Native)
    storage: {
      // Use expo-secure-store for session storage
      async getItem(key: string) {
        try {
          const value = await import('expo-secure-store').then(({ getItemAsync }) =>
            getItemAsync(key),
          );
          return value ? JSON.parse(value) : null;
        } catch (error) {
          console.error('❌ Error getting item from storage:', error);
          return null;
        }
      },
      async setItem(key: string, value: any) {
        try {
          await import('expo-secure-store').then(({ setItemAsync }) =>
            setItemAsync(key, JSON.stringify(value)),
          );
          console.log('✅ Session saved to storage');
        } catch (error) {
          console.error('❌ Error setting item in storage:', error);
        }
      },
      async removeItem(key: string) {
        try {
          await import('expo-secure-store').then(({ deleteItemAsync }) =>
            deleteItemAsync(key),
          );
          console.log('✅ Session removed from storage');
        } catch (error) {
          console.error('❌ Error removing item from storage:', error);
        }
      },
    },
  },
});