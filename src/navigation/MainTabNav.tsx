import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import FeedScreen from '../screens/FeedScreen'
import SearchScreen from '../screens/SearchScreen'
import PublicProfileScreen from '../screens/PublicProfileScreen'
import EditProfileScreen from '../screens/EditProfileScreen'
import CreatePostScreen from '../screens/CreatePostScreen'
import NotificationScreen from '../screens/NotificationScreen'
import CommentsScreen from '../screens/CommentsScreen'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useEffect, useState, useRef } from 'react'
import { Image, View, StyleSheet, Text, Animated } from 'react-native'
import ConversationsScreen from '../screens/ConversationsScreen'
import ChatScreen from '../screens/ChatScreen'
import NewChatModal from '../screens/NewChatModal'
import { getFocusedRouteNameFromRoute } from '@react-navigation/native'
import { useFocusEffect } from '@react-navigation/native'
import { useCallback } from 'react'
import CallScreen from '../screens/CallScreen'
import SettingsScreen from '../screens/SettingsScreen'

const Tab = createBottomTabNavigator()
const FeedStack = createNativeStackNavigator()
const ProfileStack = createNativeStackNavigator()
const MessagesStack = createNativeStackNavigator()

function MessagesStackScreen() {
  return (
    <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
      <MessagesStack.Screen name="Conversations" component={ConversationsScreen} />
      <MessagesStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarStyle: { display: 'none' },
        }}
      /> 
      <MessagesStack.Screen name="CommentsScreen" component={CommentsScreen} />
      <MessagesStack.Screen name="NewChatModal" component={NewChatModal} options={{ presentation: 'modal', headerShown: false }} />
    </MessagesStack.Navigator>
  )
}

function FeedStackScreen() {
  return (
    <FeedStack.Navigator screenOptions={{ headerShown: false }}>
      <FeedStack.Screen name="Feed" component={FeedScreen} />
      <FeedStack.Screen name="CreatePost" component={CreatePostScreen} />
      <FeedStack.Screen name="Comments" component={CommentsScreen} />
      <FeedStack.Screen name="PublicProfile" component={PublicProfileScreen} />
    </FeedStack.Navigator>
  )
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="PublicProfile" component={PublicProfileScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="Settings" component={SettingsScreen} />
    </ProfileStack.Navigator>
  )
}

// Animated Badge Component
function AnimatedBadge({ count }: { count: number }) {
  const scaleAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (count > 0) {
      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 150,
          friction: 8,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [count])

  if (count === 0) return null

  return (
    <Animated.View 
      style={[
        styles.badge, 
        { 
          transform: [{ scale: scaleAnim }],
          opacity: fadeAnim,
        }
      ]}
    >
      <Text style={styles.badgeText}>
        {count > 99 ? '99+' : count.toString()}
      </Text>
    </Animated.View>
  )
}

export default function MainTabNav() {
  const [userId, setUserId] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const unreadSubRef = useRef<any>(null)
  const isMountedRef = useRef(true)

  // Safer unread count fetcher with error handling
  const fetchUnreadCount = useCallback(async (uid: string) => {
    if (!uid || !isMountedRef.current) return

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          participant1,
          participant2,
          participant1_last_read_at,
          participant2_last_read_at,
          messages!inner(created_at, sender_id)
        `)
        .or(`participant1.eq.${uid},participant2.eq.${uid}`)

      if (error) {
        console.error('Error fetching unread count:', error.message)
        return
      }

      if (!data || !isMountedRef.current) return

      let totalUnread = 0
      
      data.forEach((conv) => {
        try {
          const isParticipant1 = conv.participant1 === uid
          const lastReadAt = isParticipant1 
            ? conv.participant1_last_read_at 
            : conv.participant2_last_read_at

          if (conv.messages && Array.isArray(conv.messages)) {
            const unreadMessages = conv.messages.filter((message) => {
              if (!message || message.sender_id === uid) return false
              
              if (!lastReadAt) return true
              
              try {
                return new Date(message.created_at) > new Date(lastReadAt)
              } catch (dateError) {
                console.warn('Date parsing error:', dateError)
                return false
              }
            })
            
            totalUnread += unreadMessages.length
          }
        } catch (convError) {
          console.warn('Error processing conversation:', convError)
        }
      })

      if (isMountedRef.current) {
        setUnreadCount(Math.min(totalUnread, 999)) // Cap at 999 to prevent UI issues
      }
    } catch (error) {
      console.error('Unexpected error in fetchUnreadCount:', error)
      if (isMountedRef.current) {
        setUnreadCount(0) // Reset to 0 on error to prevent crashes
      }
    }
  }, [])

  // Setup real-time subscriptions
  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true
      let messageSubscription: any = null

      const setupSubscription = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user || !isMountedRef.current) return

          const { data: profile } = await supabase
            .from('users')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

          if (!profile?.id || !isMountedRef.current) return

          setCurrentUserId(profile.id)
          await fetchUnreadCount(profile.id)

          // Setup real-time subscription with debouncing
          let debounceTimeout: NodeJS.Timeout | null = null
          
          const debouncedFetch = () => {
            if (debounceTimeout) clearTimeout(debounceTimeout)
            debounceTimeout = setTimeout(() => {
              if (isMountedRef.current) {
                fetchUnreadCount(profile.id)
              }
            }, 300) // 300ms debounce
          }

          messageSubscription = supabase
            .channel('unread-messages-channel')
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
            }, (payload) => {
              console.log('📩 New message for unread count')
              debouncedFetch()
            })
            .on('postgres_changes', {
              event: 'UPDATE',
              schema: 'public',
              table: 'conversations',
            }, () => {
              console.log('📝 Conversation updated for unread count')
              debouncedFetch()
            })
            .subscribe((status) => {
              console.log('Unread subscription status:', status)
            })

          unreadSubRef.current = messageSubscription

        } catch (error) {
          console.error('Error setting up unread subscription:', error)
        }
      }

      setupSubscription()

      return () => {
        isMountedRef.current = false
        if (unreadSubRef.current) {
          try {
            supabase.removeChannel(unreadSubRef.current)
            unreadSubRef.current = null
          } catch (error) {
            console.warn('Error removing subscription:', error)
          }
        }
      }
    }, [fetchUnreadCount])
  )

  // Load user profile
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserId(user.id)

          const { data, error } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('auth_user_id', user.id)
            .single()

          if (!error && data?.avatar_url) {
            setAvatarUrl(data.avatar_url)
          }
        }
      } catch (error) {
        console.error('Error loading user:', error)
      }
    }
    loadUser()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (unreadSubRef.current) {
        try {
          supabase.removeChannel(unreadSubRef.current)
        } catch (error) {
          console.warn('Cleanup error:', error)
        }
      }
    }
  }, [])

  if (userId === null) {
    return null // or splash screen / loading spinner
  }

  const defaultTabBarStyle = {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 84,
    backgroundColor: '#000000',
    borderTopWidth: 0.5,
    borderTopColor: '#1c1c1e',
    paddingBottom: 34, // Account for safe area
    paddingTop: 8,
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: defaultTabBarStyle,
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#0084ff',
        tabBarInactiveTintColor: '#8e8e93',
        tabBarIcon: ({ focused, color, size }) => {
          const iconSize = 26
          
          if (route.name === 'FeedTab') {
            return (
              <View style={styles.iconContainer}>
                <Ionicons 
                  name={focused ? "home" : "home-outline"} 
                  size={iconSize} 
                  color={color} 
                />
              </View>
            )
          } else if (route.name === 'Search') {
            return (
              <View style={styles.iconContainer}>
                <Ionicons 
                  name={focused ? "search" : "search-outline"} 
                  size={iconSize} 
                  color={color} 
                />
              </View>
            )
          } else if (route.name === 'Notifications') {
            return (
              <View style={styles.iconContainer}>
                <Ionicons 
                  name={focused ? "notifications" : "notifications-outline"} 
                  size={iconSize} 
                  color={color} 
                />
              </View>
            )
          } else if (route.name === 'MessagesTab') {
            return (
              <View style={styles.iconContainer}>
                <Ionicons 
                  name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} 
                  size={iconSize} 
                  color={color} 
                />
                <AnimatedBadge count={unreadCount} />
              </View>
            )
          } else if (route.name === 'ProfileTab') {
            return (
              <View style={[
                styles.avatarContainer, 
                focused && styles.avatarContainerFocused
              ]}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.placeholderCircle}>
                    <Ionicons name="person" size={18} color="#8e8e93" />
                  </View>
                )}
              </View>
            )
          }
        },
      })}
    >
      <Tab.Screen
        name="FeedTab"
        component={FeedStackScreen}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) ?? 'Feed'
          const hideOnScreens = ['Comments']
          return {
            tabBarStyle: hideOnScreens.includes(routeName)
              ? { display: 'none' }
              : defaultTabBarStyle,
          }
        }}
      />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen
        name="MessagesTab"
        component={MessagesStackScreen}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) ?? 'Conversations'
          const hideOnScreens = ['Chat', 'NewChatModal', 'CallScreen']

          return {
            tabBarStyle: hideOnScreens.includes(routeName)
              ? { display: 'none' }
              : defaultTabBarStyle,
          }
        }}
      />
      <Tab.Screen name="Notifications" component={NotificationScreen} />
      <Tab.Screen
        name="ProfileTab"
        component={PublicProfileScreen}
        initialParams={{ userId }}
      />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  iconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  placeholderCircle: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
  },
  avatarContainerFocused: {
    borderWidth: 2,
    borderColor: '#0084ff',
  },
  badge: {
    position: 'absolute',
    right: -8,
    top: -6,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
})