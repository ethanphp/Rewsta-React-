import { NavigationContainer } from '@react-navigation/native';
import AuthStack from './src/navigation/AuthStack';
import RootNavigator from './src/navigation/RootNavigator';
import { supabase } from './src/lib/supabase';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, ActivityIndicator, View } from 'react-native';
import { PortalProvider } from '@gorhom/portal';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Try to get the in-memory session from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        console.log('ℹ️ In-memory session:', session ? 'Found' : 'Not found');

        if (session) {
          setSession(session);
          console.log('✅ In-memory session restored');
        } else {
          setSession(null);
          console.log('ℹ️ No session to restore');
        }
      } catch (err) {
        console.error('⚠️ Unexpected session load error:', err);
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log('ℹ️ Auth state changed:', newSession ? `Logged in (user: ${newSession.user?.id})` : 'Logged out');
      setSession(newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const registerForPushNotificationsAsync = async () => {
      if (!Device.isDevice) return;

      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') return;

        const token = (await Notifications.getExpoPushTokenAsync({
          projectId: 'c25e35b2-39ac-4321-912c-07c90b01c432',
        })).data;

        const user = await supabase.auth.getUser();
        const userId = user.data.user?.id;
        if (!userId) {
          console.error('❌ No user ID found for push token registration');
          return;
        }

        await supabase
          .from('users')
          .update({ push_token: token })
          .eq('auth_user_id', userId);
        console.log('✅ Push token registered');
      } catch (err) {
        console.error('❌ Push Notification Registration Error:', err);
      }
    };

    if (session) {
      registerForPushNotificationsAsync();
    }
  }, [session]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#389beb" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PortalProvider>
        <NavigationContainer>
          {session ? <RootNavigator /> : <AuthStack />}
        </NavigationContainer>
      </PortalProvider>
    </GestureHandlerRootView>
  );
}