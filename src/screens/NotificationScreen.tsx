import { useEffect, useState, useRef } from 'react'
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, SafeAreaView, RefreshControl, Animated } from 'react-native'
import { supabase } from '../lib/supabase'
import { Swipeable } from 'react-native-gesture-handler'
import { formatDistanceToNow } from 'date-fns'
import { Ionicons } from '@expo/vector-icons'

export default function NotificationScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [followRequests, setFollowRequests] = useState<any[]>([])
  const [isPrivate, setIsPrivate] = useState(false)

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('users')
      .select('id, name, avatar_url, verified, private')
      .eq('auth_user_id', user.id)
      .single()

    if (profile) {
      setCurrentUser(profile)
      setUserId(profile.id)
      setIsPrivate(profile.private)
    }
  }

  const loadNotifications = async (profileId: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id,
        type,
        message,
        read,
        created_at,
        related_user_id,
        related_post_id,
        users:related_user_id (
          username,
          name,
          avatar_url,
          verified
        )
      `)
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })

    if (error) {
      console.log('Error loading notifications:', error.message)
    } else {
      setNotifications(data || [])
    }
    setLoading(false)
  }

  const loadFollowRequests = async (profileId: string) => {
    const { data, error } = await supabase
      .from('follow_requests')
      .select(`
        id,
        sender_id,
        created_at,
        sender:sender_id (
          id,
          username,
          name,
          avatar_url,
          verified
        )
      `)
      .eq('receiver_id', profileId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.log('Error loading follow requests:', error.message)
    } else {
      setFollowRequests(data || [])
    }
  }

  const handleApproveRequest = async (request: any) => {
    const { error: followError } = await supabase.from('follows').insert([
      {
        follower_id: request.sender_id,
        following_id: userId,
      },
    ])

    if (followError) {
      console.log('Error inserting into follows:', followError.message)
      return
    }

    const { error: notifError } = await supabase.from('notifications').insert([
      {
        user_id: request.sender_id,
        type: 'follow_accept',
        related_user_id: userId,
        message: null,
        read: false,
      },
    ])

    if (notifError) {
      console.log('Error inserting notification:', notifError.message)
    }

    await supabase.from('follow_requests').delete().eq('id', request.id)
    setFollowRequests((prev) => prev.filter((r) => r.id !== request.id))
  }

  const handleDenyRequest = async (request: any) => {
    await supabase.from('follow_requests').delete().eq('id', request.id)
    setFollowRequests((prev) => prev.filter((r) => r.id !== request.id))
  }

  const handleDeleteNotification = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)

    if (error) {
      console.log('Error deleting notification:', error.message)
    } else {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
    }
  }

  const handleRefresh = async () => {
    if (!userId) return
    setRefreshing(true)
    await Promise.all([
      loadNotifications(userId),
      loadFollowRequests(userId),
    ])
    setRefreshing(false)
  }

  const handleMarkAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)

    if (error) {
      console.log('Error marking as read:', error.message)
    } else {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      )
    }
  }

  useEffect(() => {
    const loadUser = async () => {
      await loadCurrentUser()
    }

    loadUser()

    const channel = supabase
      .channel('realtime:notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      }, () => userId && loadNotifications(userId))
      .subscribe()

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (userId) {
      Promise.all([
        loadNotifications(userId),
        loadFollowRequests(userId),
      ])
    }
  }, [userId])

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_follower':
        return 'person-add'
      case 'follow_request':
        return 'person-add-outline'
      case 'follow_accept':
        return 'checkmark-circle'
      case 'new_comment':
        return 'chatbubble'
      case 'mention':
        return 'at'
      case 'post_liked':
        return 'heart'
      default:
        return 'notifications'
    }
  }

  const getNotificationIconColor = (type: string) => {
    switch (type) {
      case 'new_follower':
      case 'follow_accept':
        return '#0084ff'
      case 'follow_request':
        return '#ff9500'
      case 'new_comment':
      case 'mention':
        return '#0084ff'
      case 'post_liked':
        return '#ff3b30'
      default:
        return '#8e8e93'
    }
  }

  const NotificationItem = ({
    item,
    onMarkAsRead,
    navigation,
  }: {
    item: any
    onMarkAsRead: (id: string) => void
    navigation: any
  }) => {
    const handlePress = () => {
      onMarkAsRead(item.id)

      if ((item.type === 'new_follower' || item.type === 'follow_request' || item.type === 'follow_accept') && item.related_user_id) {
        navigation.navigate('PublicProfile', {
          userId: item.related_user_id,
        })
      }
    }

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.read && styles.unreadItem]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.notificationContent}>
          <View style={styles.avatarContainer}>
            {item.users?.avatar_url ? (
              <Image source={{ uri: item.users.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {item.users?.name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            {item.users?.verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={10} color="#ffffff" />
              </View>
            )}
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.textContainer}>
              <Text style={styles.notificationText}>
                {item.message || formatNotificationMessage(item)}
              </Text>
              <Text style={styles.notificationDate}>
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </Text>
            </View>
            
            <View style={styles.iconContainer}>
              <Ionicons 
                name={getNotificationIcon(item.type) as any} 
                size={20} 
                color={getNotificationIconColor(item.type)} 
              />
              {!item.read && <View style={styles.unreadDot} />}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const renderItem = ({ item }: { item: any }) => {
    const renderRightActions = () => (
      <TouchableOpacity
        onPress={() => handleDeleteNotification(item.id)}
        style={styles.deleteButton}
      >
        <Ionicons name="trash" size={20} color="#ffffff" />
      </TouchableOpacity>
    )

    return (
      <Swipeable renderRightActions={renderRightActions}>
        <NotificationItem
          item={item}
          onMarkAsRead={handleMarkAsRead}
          navigation={navigation}
        />
      </Swipeable>
    )
  }

  const formatNotificationMessage = (item: any) => {
    const username = item.users?.name || item.users?.username || 'Someone'
    switch (item.type) {
      case 'new_follower':
        return `${username} started following you`
      case 'follow_request':
        return `${username} requested to follow you`
      case 'follow_accept':
        return `${username} accepted your follow request`
      case 'new_comment':
        return `${username} commented on your post`
      case 'mention':
        return `${username} mentioned you in a post`
      case 'post_liked':
        return `${username} liked your post`
      default:
        return 'You have a new notification'
    }
  }

  // Modern Header Component
  const NotificationHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { userId: currentUser?.id })}>
        {currentUser?.avatar_url ? (
          <Image source={{ uri: currentUser.avatar_url }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>?</Text>
          </View>
        )}
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Notifications</Text>
      <View style={{ width: 32 }} />
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <NotificationHeader />
      
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Follow Requests Section */}
        {isPrivate && followRequests.length > 0 && (
          <View style={styles.requestsSection}>
            <Text style={styles.sectionTitle}>Follow Requests</Text>
            {followRequests.map((req) => (
              <View key={req.id} style={styles.requestItem}>
                <View style={styles.requestLeft}>
                  <View style={styles.avatarContainer}>
                    {req.sender?.avatar_url ? (
                      <Image source={{ uri: req.sender.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarInitial}>
                          {req.sender?.name?.charAt(0)?.toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                    {req.sender?.verified && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark" size={10} color="#ffffff" />
                      </View>
                    )}
                  </View>
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestName}>
                      {req.sender?.name || 'Unknown'}
                    </Text>
                    <Text style={styles.requestTime}>
                      {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                    </Text>
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity onPress={() => handleApproveRequest(req)} style={styles.acceptButton}>
                    <Text style={styles.acceptText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDenyRequest(req)} style={styles.declineButton}>
                    <Text style={styles.declineText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Notifications List */}
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading notifications...</Text>
          </View>
        ) : notifications.length === 0 && followRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-outline" size={64} color="#48484a" />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              When people interact with you, you'll see it here
            </Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#0084ff"
                colors={['#0084ff']}
              />
            }
          />
        )}
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1c1c1e',
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  requestsSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1c1c1e',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#000000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1c1c1e',
  },
  requestLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  requestTime: {
    color: '#8e8e93',
    fontSize: 14,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#0084ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  declineButton: {
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  acceptText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  declineText: {
    color: '#8e8e93',
    fontWeight: '600',
    fontSize: 14,
  },
  listContainer: {
    paddingBottom: 100,
  },
  notificationItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1c1c1e',
  },
  unreadItem: {
    backgroundColor: 'rgba(0, 132, 255, 0.05)',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1c1c1e',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0084ff',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0084ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
  },
  notificationText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  notificationDate: {
    color: '#8e8e93',
    fontSize: 14,
    marginTop: 4,
  },
  iconContainer: {
    position: 'relative',
    marginLeft: 12,
  },
  unreadDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0084ff',
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginVertical: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8e8e93',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyText: {
    color: '#8e8e93',
    fontSize: 16,
    fontWeight: '500',
  },
})