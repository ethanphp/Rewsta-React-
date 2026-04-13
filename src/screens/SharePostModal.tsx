import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Animated,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'

const { width: screenWidth } = Dimensions.get('window')
let cachedConversations: Conversation[] | null = null
let lastFetched = 0
const CACHE_DURATION = 60 * 60 * 1000

interface SharePostModalProps {
  visible: boolean
  onClose: () => void
  post: {
    id: string
    content: string
    image_url?: string
    users?: {
      name: string
      username: string
      avatar_url: string
      verified: boolean
    }
  }
}

interface Conversation {
  id: string
  user: {
    id: string
    name: string
    avatar_url: string
    verified: boolean
  }
}

export default function SharePostModal({ visible, onClose, post }: SharePostModalProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversations, setSelectedConversations] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(false)

  
  const modalOpacity = useRef(new Animated.Value(0)).current
  const modalTranslateY = useRef(new Animated.Value(100)).current

  useEffect(() => {
    if (visible) {
      loadConversations()
      openModal()
    } else {
      closeModal()
    }
  }, [visible])

  const openModal = () => {
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(modalTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalTranslateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const loadConversations = async () => {
  const now = Date.now()

  if (cachedConversations && now - lastFetched < CACHE_DURATION) {
    console.log('⚡ Using cached conversations')
    setConversations(cachedConversations)
    setLoading(false)
    return
  }

  setLoading(true)

  try {
    console.log('▶ Starting loadConversations...')

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) return console.log('❌ No auth user found.')

    console.log('✅ Auth user:', user)

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError) throw profileError
    if (!profile) return console.log('❌ No profile found.')

    console.log('✅ Supabase profile:', profile)
    setCurrentUserId(profile.id)

    const { data: messageConvos, error: messageError } = await supabase
      .from('messages')
      .select('conversation_id')

    if (messageError) throw messageError

    const conversationIdsWithMessages = [...new Set(messageConvos.map(m => m.conversation_id))]

    console.log('💬 Conversations with messages:', conversationIdsWithMessages)

    if (conversationIdsWithMessages.length === 0) {
      setConversations([])
      cachedConversations = []
      lastFetched = now
      return
    }

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        created_at,
        participant1,
        participant2,
        participant1User:participant1 (id, name, avatar_url, verified),
        participant2User:participant2 (id, name, avatar_url, verified)
      `)
      .in('id', conversationIdsWithMessages)
      .or(`participant1.eq.${profile.id},participant2.eq.${profile.id}`)
      .order('created_at', { ascending: false })

    if (error) throw error

    console.log('🧵 Raw conversation data:', data)

    const formatted = data
      .map(conv => {
        const isParticipant1 = conv.participant1 === profile.id
        const other = isParticipant1 ? conv.participant2User : conv.participant1User

        return {
          id: conv.id,
          user: other
        }
      })
      .filter(conv => conv.user)
      .sort((a, b) => a.user.name.localeCompare(b.user.name))

    console.log('✅ Final formatted conversations:', formatted)

    setConversations(formatted)
    cachedConversations = formatted
    lastFetched = now

  } catch (error) {
    console.error('❌ Error loading conversations:', error)
  } finally {
    setLoading(false)
  }
}


  const toggleConversation = (conversationId: string) => {
    setSelectedConversations(prev => 
      prev.includes(conversationId)
        ? prev.filter(id => id !== conversationId)
        : [...prev, conversationId]
    )
  }

  const sharePost = async () => {
    if (selectedConversations.length === 0) {
      Alert.alert('Select Recipients', 'Please select at least one conversation to share with.')
      return
    }

    setSending(true)

    try {
      // Create share message content
      const shareContent = message.trim() 
        ? `${message}\n\n📎 Shared a post from @${post.users?.username || 'someone'}: "${post.content.slice(0, 100)}${post.content.length > 100 ? '...' : ''}"`
        : `📎 Shared a post from @${post.users?.username || 'someone'}: "${post.content.slice(0, 100)}${post.content.length > 100 ? '...' : ''}"`

      // Send message to each selected conversation
      const promises = selectedConversations.map(async (conversationId) => {
        return supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: shareContent,
          shared_post_id: post.id // Add this field to track shared posts
        })
      })

      await Promise.all(promises)

      // Show success message
      Alert.alert(
        'Post Shared!', 
        `Shared with ${selectedConversations.length} conversation${selectedConversations.length > 1 ? 's' : ''}`
      )

      // Reset and close
      setSelectedConversations([])
      setMessage('')
      onClose()

    } catch (error) {
      console.error('Error sharing post:', error)
      Alert.alert('Error', 'Failed to share post. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const getSelectedNames = () => {
    return conversations
      .filter(conv => selectedConversations.includes(conv.id))
      .map(conv => conv.user.name)
      .join(', ')
  }

  const renderConversation = ({ item }: { item: Conversation }) => {
    const isSelected = selectedConversations.includes(item.id)
    
    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => toggleConversation(item.id)}
        activeOpacity={0.7}
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
          
          {/* Selection overlay */}
          {isSelected && (
            <View style={styles.selectionOverlay}>
              <View style={styles.selectionCheckmark}>
                <Ionicons name="checkmark" size={16} color="#ffffff" />
              </View>
            </View>
          )}
          
          {/* Verified badge */}
          {item.user.verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={10} color="#ffffff" />
            </View>
          )}
        </View>

        <Text style={styles.userName} numberOfLines={1}>
          {item.user.name}
        </Text>
      </TouchableOpacity>
    )
  }

  if (!visible) return null

  return (
    <View style={styles.overlay}>
      <TouchableOpacity 
        style={styles.backdrop} 
        onPress={onClose}
        activeOpacity={1}
      />
      
      <Animated.View 
        style={[
          styles.modal,
          {
            opacity: modalOpacity,
            transform: [{ translateY: modalTranslateY }],
          }
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#8E8E93" />
          </TouchableOpacity>
          <Text style={styles.title}>Share Post</Text>
          <TouchableOpacity
            style={[
              styles.shareHeaderButton,
              selectedConversations.length === 0 && styles.shareHeaderButtonDisabled
            ]}
            onPress={sharePost}
            disabled={selectedConversations.length === 0 || sending}
          >
            <Text style={[
              styles.shareHeaderButtonText,
              selectedConversations.length === 0 && styles.shareHeaderButtonTextDisabled
            ]}>
              {sending ? 'Sending...' : 'Send'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selected recipients display */}
        {selectedConversations.length > 0 && (
          <View style={styles.selectedSection}>
            <Text style={styles.selectedLabel}>To:</Text>
            <Text style={styles.selectedNames} numberOfLines={2}>
              {getSelectedNames()}
            </Text>
          </View>
        )}

        {/* Add Message 
        <View style={styles.messageSection}>
          <TextInput
            style={styles.messageInput}
            placeholder="Write a message..."
            placeholderTextColor="#8E8E93"
            value={message}
            onChangeText={setMessage}
            maxLength={280}
            multiline
          />
        </View>*/}

        {/* Conversations Grid */}
        <View style={styles.conversationsSection}>
          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color="#0084ff" />
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color="#48484a" />
              <Text style={styles.emptyText}>No conversations found</Text>
              <Text style={styles.emptySubtext}>Start a chat to share posts</Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              renderItem={renderConversation}
              numColumns={4}
              style={styles.conversationsList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.conversationsGrid}
            />
          )}
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },

  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  modal: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },

  closeButton: {
    padding: 4,
  },

  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },

  shareHeaderButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0084ff',
  },

  shareHeaderButtonDisabled: {
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
  },

  shareHeaderButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  shareHeaderButtonTextDisabled: {
    color: '#8E8E93',
  },

  selectedSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
    backgroundColor: 'rgba(0, 132, 255, 0.08)',
  },

  selectedLabel: {
    color: '#0084ff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },

  selectedNames: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 20,
  },

  messageSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },

  messageInput: {
    color: '#ffffff',
    fontSize: 16,
    minHeight: 20,
    maxHeight: 80,
    textAlignVertical: 'top',
  },

  conversationsSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  conversationsList: {
    flex: 1,
  },

  conversationsGrid: {
    paddingBottom: 20,
  },

  conversationItem: {
    width: (screenWidth - 80) / 4, // 4 columns with padding
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
  },

  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2C2C2E',
  },

  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0084ff',
  },

  avatarInitial: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
  },

  selectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 132, 255, 0.3)',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0084ff',
  },

  selectionCheckmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0084ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0084ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },

  userName: {
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
    maxWidth: 80,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },

  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 12,
    marginBottom: 4,
  },

  emptySubtext: {
    fontSize: 14,
    color: '#636366',
    textAlign: 'center',
  },
})