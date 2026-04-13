import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, SafeAreaView, TextInput, Keyboard } from 'react-native'
import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { format, isToday, isYesterday, differenceInCalendarDays } from 'date-fns'

export default function ConversationsScreen() {
  const [conversations, setConversations] = useState<any[]>([])
  const [filteredConversations, setFilteredConversations] = useState<any[]>([])
  const [typingConversations, setTypingConversations] = useState<{ [key: string]: boolean }>({})
  const [currentUserId, setCurrentUserId] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const navigation = useNavigation()
  const typingChannelRef = useRef<any>()
  const [isPlus, setIsPlus] = useState(false)

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()

    if (isToday(date)) {
      return format(date, 'HH:mm') // e.g. "14:23"
    } else if (isYesterday(date)) {
      return 'Yesterday'
    } else if (differenceInCalendarDays(now, date) <= 7) {
      return format(date, 'EEEE') // e.g. "Tuesday"
    } else {
      return format(date, 'dd/MM/yyyy') // e.g. "20/06/2024"
    }
  }

  const loadConversations = async (userId: string) => {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        participant1,
        participant2,
        participant1_last_read_at,
        participant2_last_read_at,
        messages(content, created_at, sender_id),
        participant1User:participant1 (id, name, avatar_url, verified),
        participant2User:participant2 (id, name, avatar_url, verified)
      `)
      .or(`participant1.eq.${userId},participant2.eq.${userId}`)
      .order('created_at', { ascending: false })
      .order('created_at', { foreignTable: 'messages', ascending: false })

    if (!error && data) {
      const cleaned = data.map((conv) => {
        const isParticipant1 = conv.participant1 === userId
        const other = isParticipant1 ? conv.participant2User : conv.participant1User
        const lastMessage = conv.messages[0]
        const lastReadAt = isParticipant1 ? conv.participant1_last_read_at : conv.participant2_last_read_at

        const unreadCount = conv.messages.filter(
        (m) =>
            m.sender_id !== userId &&
            (!lastReadAt || new Date(m.created_at) > new Date(lastReadAt))
        ).length

        return {
            id: conv.id,
            user: other,
            lastMessage: lastMessage?.content || 'No messages yet',
            timestamp: lastMessage?.created_at || conv.created_at,
            unread: unreadCount > 0,
            unreadCount,
        }
      })

      const sortedConversations = cleaned.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setConversations(sortedConversations)
      setFilteredConversations(sortedConversations)
    }
  }

  // Search functionality
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim() === '') {
      setFilteredConversations(conversations)
      setIsSearching(false)
    } else {
      setIsSearching(true)
      const filtered = conversations.filter(conv =>
        conv.user.name.toLowerCase().includes(query.toLowerCase()) ||
        conv.lastMessage.toLowerCase().includes(query.toLowerCase())
      )
      setFilteredConversations(filtered)
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setFilteredConversations(conversations)
    setIsSearching(false)
    Keyboard.dismiss()
  }

  // Update filtered conversations when conversations change
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredConversations(conversations)
    } else {
      handleSearch(searchQuery)
    }
  }, [conversations])

  useFocusEffect(
    React.useCallback(() => {
      let messageSub: any
      let typingSub: any
      let isMounted = true

      const setup = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !isMounted) return

        const { data: profile } = await supabase
        .from('users')
        .select('id, avatar_url, verified, plus_member')
          .eq('auth_user_id', user.id)
          .single()

        if (!profile || !isMounted) return
        setCurrentUserId(profile.id)
        setAvatarUrl(profile.avatar_url)
        setIsPlus(profile.plus_member)

        await loadConversations(profile.id)

        messageSub = supabase
          .channel('messages-insert-channel')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          }, async (payload) => {
            console.log('📨 New message:', payload.new)
            await loadConversations(profile.id)
          })
          .subscribe()

        typingSub = supabase
          .channel('typing-convo-broadcast')
          .on('broadcast', { event: 'typing' }, (payload) => {
            const { senderId, conversationId } = payload.payload
            if (senderId !== profile.id) {
              console.log('✍ Typing in convo:', conversationId)
              setTypingConversations(prev => ({
                ...prev,
                [conversationId]: true
              }))
              setTimeout(() => {
                setTypingConversations(prev => ({
                  ...prev,
                  [conversationId]: false
                }))
              }, 3000)
            }
          })
          .subscribe()

        typingChannelRef.current = typingSub
      }

      setup()

      return () => {
        isMounted = false
        if (messageSub) supabase.removeChannel(messageSub)
        if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current)
      }
    }, [])
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { userId: currentUserId })}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>?</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chats</Text>
        <TouchableOpacity
          onPress={() => {
            if (!isPlus && conversations.length >= 3) {
              navigation.navigate('RewstaPlus', { reason: 'chat_limit' })
            } else {
              navigation.navigate('NewChatModal')
            }
          }}
          style={styles.newChatButton}
        >
          <Ionicons name="create-outline" size={24} color="#0084ff" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#636366" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="#636366"
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#636366" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.conversationItem}
            onPress={() => navigation.navigate('Chat', { conversationId: item.id, recipient: item.user })}
          >
            <View style={styles.avatarContainer}>
              {item.user.avatar_url ? (
                <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>
                    {item.user.name?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              {item.user.verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={12} color="#ffffff" />
                </View>
              )}
            </View>
            
            <View style={styles.conversationContent}>
              <View style={styles.conversationHeader}>
                <Text style={[styles.userName, item.unread && styles.unreadUserName]}>
                  {item.user.name}
                </Text>
                <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
              </View>
              
              <View style={styles.messageRow}>
                <Text
                  style={[
                    styles.lastMessage,
                    item.unread && styles.unreadLastMessage,
                    typingConversations[item.id] && styles.typingMessage,
                  ]}
                  numberOfLines={1}
                >
                  {typingConversations[item.id] ? 'typing...' : item.lastMessage}
                </Text>
                {item.unread && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#48484a" />
            <Text style={styles.emptyTitle}>
              {isSearching ? 'No results found' : 'No conversations yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {isSearching ? 'Try searching for something else' : 'Start a new conversation to get started'}
            </Text>
          </View>
        }
      />
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
  newChatButton: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#000000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1c1c1e',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
  },
  clearButton: {
    marginLeft: 8,
  },
  listContainer: {
    paddingBottom: 100,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1c1c1e',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1c1c1e',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0084ff',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0084ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '400',
    color: '#ffffff',
    flex: 1,
  },
  unreadUserName: {
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 14,
    color: '#8e8e93',
    marginLeft: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: 15,
    color: '#8e8e93',
    flex: 1,
  },
  unreadLastMessage: {
    color: '#ffffff',
    fontWeight: '500',
  },
  typingMessage: {
    color: '#0084ff',
    fontStyle: 'italic',
  },
  unreadBadge: {
    backgroundColor: '#0084ff',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadCount: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
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
})