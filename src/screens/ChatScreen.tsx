import { useEffect, useRef, useState } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet, Image, Animated
} from 'react-native'
import { supabase } from '../lib/supabase'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { Easing } from 'react-native'
import { formatDistanceToNowStrict } from 'date-fns'
import * as Haptics from 'expo-haptics'
import { Picker } from '@react-native-picker/picker'
import { format, isToday, isYesterday, isThisWeek, differenceInCalendarDays } from 'date-fns'

export default function ChatScreen({ route }: any) {
  const { conversationId, recipient } = route.params
  const [currentUserId, setCurrentUserId] = useState('')
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [isRecipientTyping, setIsRecipientTyping] = useState(false)
  const typingTimeout = useRef<NodeJS.Timeout | null>(null)
  const flatListRef = useRef<FlatList>(null)
  const navigation = useNavigation()
  const [lastSeen, setLastSeen] = useState<Date | null>(null)
  const [recipientOnline, setRecipientOnline] = useState(false)
  const [shouldAnimateScroll, setShouldAnimateScroll] = useState(true);
  const [showProfileSheet, setShowProfileSheet] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportType, setReportType] = useState('')
  const [reportReason, setReportReason] = useState('')
  const [allowReview, setAllowReview] = useState(false)

  const dot1 = useRef(new Animated.Value(0)).current
  const dot2 = useRef(new Animated.Value(0)).current
  const dot3 = useRef(new Animated.Value(0)).current

  const bounceAnimations = useRef<Animated.CompositeAnimation[]>([]).current
  const isBouncing = useRef(false)

  const fadeDot1 = useRef(new Animated.Value(1)).current
  const fadeDot2 = useRef(new Animated.Value(1)).current
  const fadeDot3 = useRef(new Animated.Value(1)).current

  const startBounce = () => {
    if (isBouncing.current) return
    isBouncing.current = true

    const createBounce = (dot: Animated.Value, fade: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(dot, {
              toValue: -6,
              duration: 200,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
              delay,
            }),
            Animated.timing(dot, {
              toValue: 0,
              duration: 200,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(fade, {
              toValue: 0.3,
              duration: 200,
              useNativeDriver: true,
              delay,
            }),
            Animated.timing(fade, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ])
        ])
      ).start()
    }

    createBounce(dot1, fadeDot1, 0)
    createBounce(dot2, fadeDot2, 100)
    createBounce(dot3, fadeDot3, 200)
  }

  useEffect(() => {
    let subscription: any
    let typingChannel: any
    let presenceChannel: any

    const fetchMessages = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (!profile) return
      setCurrentUserId(profile.id)

      const { data: recipientProfile } = await supabase
        .from('users')
        .select('push_token')
        .eq('id', recipient.id)
        .single()

      if (recipientProfile) {
        recipient.push_token = recipientProfile.push_token
      }
        
      const { data: convo } = await supabase
        .from('conversations')
        .select('participant1, participant2')
        .eq('id', conversationId)
        .single()

      if (!convo) return

      const isParticipant1 = convo.participant1 === profile.id
      console.log('🧠 You are participant', isParticipant1 ? '1' : '2')

      const field = isParticipant1 ? 'participant1_last_read_at' : 'participant2_last_read_at'
      const now = new Date().toISOString()
      console.log(`📬 Marking ${field} as read at`, now)

      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          [field]: now
        })
        .eq('id', conversationId)

      supabase.channel('messages-tab-counter').send({
        type: 'broadcast',
        event: 'refreshUnread',
        payload: { conversationId }
      })

      if (updateError) {
        console.error('❌ Failed to update read timestamp:', updateError.message)
      } else {
        console.log('✅ Read timestamp updated successfully.')
      }

      presenceChannel = supabase.channel(`presence:${conversationId}`, {
        config: {
          presence: {
            key: profile.id,
          },
        },
      })

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState()
          const otherUserOnline = Object.keys(state).includes(recipient.id)
          setRecipientOnline(otherUserOnline)
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            presenceChannel.track({})
          }
        })

      typingChannel = supabase.channel('typing-convo-broadcast')

      typingChannel
        .on('broadcast', { event: 'typing' }, (payload) => {
          const { senderId, conversationId: incomingId } = payload.payload
          if (senderId !== profile.id && incomingId === conversationId) {
            setIsRecipientTyping(true)
            startBounce()
            if (typingTimeout.current) clearTimeout(typingTimeout.current)
            typingTimeout.current = setTimeout(() => {
              setIsRecipientTyping(false)
            }, 2000)
          }
        })
        .subscribe()

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        
      if (!error && data) {
        setMessages(data)
      }

      subscription = supabase
        .channel('realtime:messages')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        }, (payload) => {
          const newMessage = payload.new
          if (newMessage.conversation_id === conversationId) {
            setMessages(prev => [...prev, newMessage])
            if (newMessage.sender_id !== currentUserId) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            }
          }
        })
        .subscribe()
    }

    fetchMessages()

    return () => {
      if (subscription) supabase.removeChannel(subscription)
      if (typingChannel) supabase.removeChannel(typingChannel)
      if (presenceChannel) supabase.removeChannel(presenceChannel)
      if (typingTimeout.current) clearTimeout(typingTimeout.current)
    }
  }, [conversationId])

  const sendTypingEvent = () => {
    supabase.channel('typing-convo-broadcast').send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        senderId: currentUserId,
        conversationId: conversationId,
      },
    })
  }

  useEffect(() => {
    if (showProfileSheet) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start()
    } else {
      fadeAnim.setValue(0)
    }
  }, [showProfileSheet])

  const modalOpacity = useRef(new Animated.Value(0)).current
  const modalTranslateY = useRef(new Animated.Value(100)).current

  const openProfileModal = () => {
    setShowProfileSheet(true)
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

  const closeProfileModal = () => {
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
    ]).start(() => {
      setShowProfileSheet(false)
    })
  }

  const sendMessage = async () => {
    if (!input.trim()) return

    const messageContent = input.trim()
    setInput('')
    setIsRecipientTyping(false)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (typingTimeout.current) clearTimeout(typingTimeout.current)

    dot1.stopAnimation()
    dot2.stopAnimation()
    dot3.stopAnimation()
    isBouncing.current = false

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: messageContent,
    })

    supabase.channel('realtime-messages-badge').send({
      type: 'broadcast',
      event: 'refreshUnread',
      payload: {},
    })

    if (error) return console.error('Failed to send message:', error.message)

    const { data: senderProfile } = await supabase
      .from('users')
      .select('name')
      .eq('id', currentUserId)
      .single()

    const senderName = senderProfile?.name || 'Someone'

    if (recipient.push_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipient.push_token,
          title: 'Rewsta - New Message',
          body: `from ${senderName}`,
          sound: 'default',
          priority: 'high',
        }),
      })
    }
  }

  const handleReportUser = async () => {
    closeProfileModal()

    const { error } = await supabase.from('reports').insert({
      reporter_id: currentUserId,
      reported_id: recipient.id,
      reason: 'Manual report from chat modal',
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.error('Failed to submit report:', error.message)
      alert('There was an error reporting this user.')
    } else {
      alert('User reported. Our team will review the report.')
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Modern Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={openProfileModal} style={styles.headerInfo} activeOpacity={0.8}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: recipient.avatar_url }} style={styles.avatar} />
            {recipientOnline && <View style={styles.onlineIndicator} />}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{recipient.name}</Text>
            <Text style={styles.lastSeen}>
              {recipientOnline
                ? 'Active now'
                : lastSeen
                ? `Seen ${formatDistanceToNowStrict(new Date(lastSeen), { addSuffix: true })}`
                : 'Seen 1 hour ago'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.moreButton}>
          <View style={styles.menuDots}>
            <View style={styles.menuDot} />
            <View style={styles.menuDot} />
            <View style={styles.menuDot} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Enhanced Profile Modal */}
      {showProfileSheet && (
        <Animated.View style={[styles.profileModalOverlay, { opacity: modalOpacity }]}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            onPress={closeProfileModal}
            activeOpacity={1}
          />
          <Animated.View style={[styles.profileModalSheet, { transform: [{ translateY: modalTranslateY }] }]}>
            <View style={styles.modalHandle} />
            
            <View style={styles.profileContent}>
              <View style={styles.modalAvatarContainer}>
                <Image source={{ uri: recipient.avatar_url }} style={styles.modalAvatar} />
                <View style={[styles.onlineIndicator, { backgroundColor: recipientOnline ? '#00ff88' : '#ff6b6b' }]} />
              </View>
              
              <Text style={styles.modalName}>{recipient.name}</Text>
              <Text style={styles.modalStatus}>
                {recipientOnline ? 'Active in this chat' : 'Currently offline'}
              </Text>

              <View style={styles.actionGrid}>
                <TouchableOpacity style={styles.primaryAction} onPress={() => {
                  console.log('Audio call')
                  closeProfileModal()
                }}>
                  <View style={styles.actionIcon}>
                    <Ionicons name="call" size={20} color="#fff" />
                  </View>
                  <Text style={styles.actionText}>Voice Call</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.primaryAction} onPress={() => {
                  console.log('Video call')
                  closeProfileModal()
                }}>
                  <View style={styles.actionIcon}>
                    <Ionicons name="videocam" size={20} color="#fff" />
                  </View>
                  <Text style={styles.actionText}>Video Call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dangerAction}
                  onPress={() => {
                    closeProfileModal()
                    setTimeout(() => setShowReportModal(true), 300)
                  }}
                >
                  <View style={styles.dangerIcon}>
                    <Ionicons name="flag" size={18} color="#ff6b6b" />
                  </View>
                  <Text style={styles.dangerText}>Report</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {/* Enhanced Report Modal */}
      {showReportModal && (
        <View style={styles.reportModalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            onPress={() => setShowReportModal(false)}
            activeOpacity={1}
          />
          <View style={styles.reportModal}>
            <View style={styles.reportHeader}>
              <View style={styles.reportIconContainer}>
                <Ionicons name="flag" size={24} color="#ff6b6b" />
              </View>
              <Text style={styles.reportTitle}>Report {recipient.name}</Text>
              <Text style={styles.reportSubtitle}>Help us keep the community safe</Text>
            </View>

            <View style={styles.reportContent}>
              <Text style={styles.sectionLabel}>Reason for reporting</Text>
              <View style={styles.reasonGrid}>
                {['Harassment', 'Inappropriate Content', 'Other'].map((type) => (
                  <TouchableOpacity 
                    key={type} 
                    onPress={() => setReportType(type)} 
                    style={[
                      styles.reasonOption,
                      reportType === type && styles.reasonOptionActive
                    ]}
                  >
                    <Text style={[
                      styles.reasonText,
                      reportType === type && styles.reasonTextActive
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Additional details (optional)</Text>
              <TextInput
                style={styles.reportInput}
                placeholder="Provide more context about the issue..."
                placeholderTextColor="#666"
                value={reportReason}
                onChangeText={setReportReason}
                textAlignVertical="top"
              />

              <TouchableOpacity 
                onPress={() => setAllowReview(!allowReview)} 
                style={styles.checkboxContainer}
              >
                <View style={[styles.checkbox, allowReview && styles.checkboxActive]}>
                  {allowReview && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={styles.checkboxLabel}>
                  Allow review of recent messages for investigation
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, !reportType && styles.submitButtonDisabled]}
                onPress={async () => {
                  if (!reportType) {
                    alert('Please select a reason for reporting.')
                    return
                  }

                  const { error } = await supabase.from('reports').insert({
                    reporter_id: currentUserId,
                    reported_id: recipient.id,
                    type: reportType,
                    reason: reportReason,
                    allow_review: allowReview
                  })

                  if (error) {
                    console.error('Report failed:', error.message)
                    alert('Failed to submit report. Please try again.')
                  } else {
                    alert('Report submitted successfully. Thank you for helping keep our community safe.')
                    setShowReportModal(false)
                    setReportReason('')
                    setReportType('')
                    setAllowReview(false)
                  }
                }}
              >
                <Text style={[styles.submitButtonText, !reportType && styles.submitButtonTextDisabled]}>
                  Submit Report
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setShowReportModal(false)} 
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageItem
            item={item}
            currentUserId={currentUserId}
            recipient={recipient}
            navigation={navigation}
            recipientOnline={recipientOnline}
          />
        )}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          requestAnimationFrame(() => {
            flatListRef.current?.scrollToEnd({ animated: false })
          })
        }}
        onLayout={() => {
          requestAnimationFrame(() => {
            flatListRef.current?.scrollToEnd({ animated: false })
          })
        }}
      />

      {/* Modern Typing Indicator */}
      {isRecipientTyping && (
        <View style={styles.typingContainer}>
          <Image source={{ uri: recipient.avatar_url }} style={styles.typingAvatar} />
          <View style={styles.typingBubble}>
            <View style={styles.typingDots}>
              <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot1 }], opacity: fadeDot1 }]} />
              <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot2 }], opacity: fadeDot2 }]} />
              <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot3 }], opacity: fadeDot3 }]} />
            </View>
          </View>
        </View>
      )}

      {/* Modern Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={styles.inputArea}>
          <TouchableOpacity style={styles.attachButton}>
            <Ionicons name="add" size={24} color="#8E8E93" />
          </TouchableOpacity>
          
          <View style={styles.inputContainer}>
            <TextInput
              value={input}
              onChangeText={(text) => {
                setInput(text)
                sendTypingEvent()
              }}
              placeholder="Send a message"
              placeholderTextColor="#8E8E93"
              style={styles.textInput}
              multiline
            />
          </View>

          <TouchableOpacity style={styles.voiceButton}>
            <Ionicons name="mic" size={20} color="#8E8E93" />
          </TouchableOpacity>

          {input.trim() ? (
            <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function MessageItem({ item, currentUserId, recipient, recipientOnline, navigation }: any) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(20)).current
  const [showTimestamp, setShowTimestamp] = useState(false)
  const [sharedPost, setSharedPost] = useState<any>(null)
  const [loadingPost, setLoadingPost] = useState(false)

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }),
    ]).start()
  }, [])

  // Load shared post data
  useEffect(() => {
    const loadSharedPost = async () => {
      if (!item.shared_post_id) return
      
      setLoadingPost(true)
      try {
        const { data, error } = await supabase
          .from('posts')
          .select(`
            id, content, image_url, created_at,
            users (name, username, avatar_url, verified)
          `)
          .eq('id', item.shared_post_id)
          .single()

        if (!error && data) {
          setSharedPost(data)
        }
      } catch (error) {
        console.error('Error loading shared post:', error)
      } finally {
        setLoadingPost(false)
      }
    }

    loadSharedPost()
  }, [item.shared_post_id])

  const isMine = item.sender_id === currentUserId

  const handlePostPress = () => {
    if (item.shared_post_id) {
      navigation.navigate('Comments', {
        postId: item.shared_post_id,
      })
    }
  }

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)

    let interval = Math.floor(seconds / 31536000)
    if (interval >= 1) return `${interval}y`

    interval = Math.floor(seconds / 2592000)
    if (interval >= 1) return `${interval}mo`

    interval = Math.floor(seconds / 86400)
    if (interval >= 1) return `${interval}d`

    interval = Math.floor(seconds / 3600)
    if (interval >= 1) return `${interval}h`

    interval = Math.floor(seconds / 60)
    if (interval >= 1) return `${interval}m`

    return 'now'
  }

  return (
    <Animated.View
      style={[
        styles.messageContainer,
        { 
          opacity: fadeAnim, 
          transform: [{ translateY: slideAnim }],
          alignItems: isMine ? 'flex-end' : 'flex-start'
        }
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => setShowTimestamp(!showTimestamp)}
        delayLongPress={250}
        style={styles.messageWrapper}
      >
        <View style={[styles.messageRow, { flexDirection: isMine ? 'row-reverse' : 'row' }]}>
          {!isMine && (
            <Image source={{ uri: recipient.avatar_url }} style={styles.messageAvatar} />
          )}
          
          <View style={[
            styles.messageBubble, 
            isMine ? styles.myMessage : styles.theirMessage,
            item.shared_post_id && styles.sharedMessageBubble
          ]}>
            {/* Regular message text */}
            {item.content && !item.content.includes('📎 Shared a post') && (
              <Text style={[styles.messageText, isMine ? styles.myMessageText : styles.theirMessageText]}>
                {item.content}
              </Text>
            )}

            {/* Shared post embed */}
            {item.shared_post_id && (
              <TouchableOpacity 
                onPress={handlePostPress} 
                style={styles.postEmbed} 
                activeOpacity={0.8}
              >
                {loadingPost ? (
                  <View style={styles.loadingPost}>
                    <View style={styles.loadingSkeleton} />
                    <View style={[styles.loadingSkeleton, { width: '80%', marginTop: 8 }]} />
                    <View style={[styles.loadingSkeleton, { width: '60%', marginTop: 4 }]} />
                  </View>
                ) : sharedPost ? (
                  <View style={styles.postContent}>
                    {/* Post header */}
                    <View style={styles.postHeader}>
                      <View style={styles.postAuthor}>
                        {sharedPost.users?.avatar_url ? (
                          <Image 
                            source={{ uri: sharedPost.users.avatar_url }} 
                            style={styles.postAuthorAvatar} 
                          />
                        ) : (
                          <View style={[styles.postAuthorAvatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarInitial}>
                              {sharedPost.users?.name?.charAt(0)?.toUpperCase() || '?'}
                            </Text>
                          </View>
                        )}
                        <View style={styles.postAuthorInfo}>
                          <View style={styles.authorNameRow}>
                            <Text style={styles.postAuthorName}>
                              {sharedPost.users?.name || 'Unknown'}
                            </Text>
                            {sharedPost.users?.verified && (
                              <Ionicons name="checkmark-circle" size={12} color="#0084ff" style={{ marginLeft: 4 }} />
                            )}
                          </View>
                          <Text style={styles.postTime}>
                            @{sharedPost.users?.username || 'unknown'} • {timeAgo(sharedPost.created_at)}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
                    </View>

                    {/* Post text content */}
                    <Text style={styles.postText} numberOfLines={4}>
                      {sharedPost.content}
                    </Text>

                    {/* Post image if exists */}
                    {sharedPost.image_url && (
                      <View style={styles.postImageContainer}>
                        <Image 
                          source={{ uri: sharedPost.image_url }} 
                          style={styles.postImage}
                          resizeMode="cover"
                        />
                      </View>
                    )}

                    {/* Share indicator */}
                    <View style={styles.shareIndicator}>
                      <Ionicons name="share-social-outline" size={14} color="#8E8E93" />
                      <Text style={styles.shareText}>Shared post</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.errorPost}>
                    <Ionicons name="alert-circle-outline" size={20} color="#FF6B6B" />
                    <Text style={styles.errorText}>Post no longer available</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Message timestamp */}
            <Text style={styles.messageTime}>
              {(() => {
                const created = new Date(item.created_at)
                if (isToday(created)) {
                  return format(created, 'HH:mm')
                } else if (isYesterday(created)) {
                  return 'Yesterday'
                } else if (differenceInCalendarDays(new Date(), created) <= 7) {
                  return format(created, 'EEEE')
                } else {
                  return format(created, 'dd/MM/yyyy')
                }
              })()}
            </Text>
            
            {isMine && (
              <View style={styles.readIndicator}>
                <Ionicons name="checkmark-done" size={12} color="#007AFF" />
              </View>
            )}
          </View>
        </View>

        {showTimestamp && (
          <Animated.View style={[
            styles.timestampContainer,
            { alignItems: isMine ? 'flex-end' : 'flex-start' }
          ]}>
            <Text style={styles.timestampText}>
              {format(new Date(item.created_at), 'MMM d, yyyy \'at\' HH:mm')}
            </Text>
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Modern Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  sharedPostBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sharedMessageBubble: {
    minWidth: 280,
    maxWidth: 320,
  },

  postEmbed: {
    backgroundColor: 'rgba(44, 44, 46, 0.8)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    marginTop: 4,
  },

  loadingPost: {
    padding: 12,
  },

  loadingSkeleton: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
  },

  postContent: {
    padding: 12,
  },

  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  postAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  postAuthorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },

  avatarPlaceholder: {
    backgroundColor: '#0084ff',
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarInitial: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },

  postAuthorInfo: {
    flex: 1,
  },

  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  postAuthorName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },

  postTime: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 1,
  },

  postText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },

  postImageContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },

  postImage: {
    width: '100%',
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  shareIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },

  shareText: {
    color: '#8E8E93',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },

  errorPost: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    justifyContent: 'center',
  },

  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    marginLeft: 6,
  },

  sharedPostContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  sharedPostText: {
    color: '#0A84FF',
    fontSize: 14,
    fontWeight: '500',
  },

  backButton: {
    marginRight: 8,
  },

  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#30D158',
    borderWidth: 2,
    borderColor: '#000',
  },

  userInfo: {
    flex: 1,
  },

  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },

  lastSeen: {
    color: '#8E8E93',
    fontSize: 12,
  },

  moreButton: {
    padding: 8,
  },

  menuDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  menuDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#8E8E93',
  },

  // Messages
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },

  messagesContent: {
    paddingVertical: 16,
  },

  messageContainer: {
    marginVertical: 2,
  },

  messageWrapper: {
    maxWidth: '80%',
  },

  messageRow: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },

  messageAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 2,
  },

  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    maxWidth: '100%',
  },

  myMessage: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },

  theirMessage: {
    backgroundColor: '#2C2C2E',
    borderBottomLeftRadius: 4,
  },

  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },

  myMessageText: {
    color: '#fff',
  },

  theirMessageText: {
    color: '#fff',
  },

  messageTime: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
    alignSelf: 'flex-end',
  },

  readIndicator: {
    marginTop: 2,
    alignSelf: 'flex-end',
  },

  timestampContainer: {
    marginTop: 4,
    paddingHorizontal: 8,
  },

  timestampText: {
    fontSize: 11,
    color: '#8E8E93',
  },

  // Typing Indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  typingAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },

  typingBubble: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  typingDot: {
    width: 4,
    height: 4,
    backgroundColor: '#8E8E93',
    borderRadius: 2,
    marginHorizontal: 1,
  },

  // Modern Input Area
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000',
    borderTopWidth: 0.5,
    borderTopColor: '#38383A',
  },

  attachButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },

  inputContainer: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    minHeight: 36,
    justifyContent: 'center',
  },

  textInput: {
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
    minHeight: 20,
  },

  voiceButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },

  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Enhanced Profile Modal (keeping existing styles)
  profileModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 100,
    justifyContent: 'flex-end',
  },

  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  profileModalSheet: {
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    backdropFilter: 'blur(30px)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },

  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },

  profileContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },

  modalAvatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },

  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },

  modalName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },

  modalStatus: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 32,
  },

  actionGrid: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },

  primaryAction: {
    flex: 1,
    backgroundColor: 'rgba(44, 44, 46, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },

  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },

  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  dangerAction: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.2)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    minWidth: 80,
  },

  dangerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 69, 58, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },

  dangerText: {
    color: '#FF453A',
    fontSize: 14,
    fontWeight: '600',
  },

  // Report Modal (keeping existing styles)
  reportModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
    paddingHorizontal: 20,
  },

  reportModal: {
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    backdropFilter: 'blur(30px)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
    maxWidth: 400,
  },

  reportHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },

  reportIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 69, 58, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  reportTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },

  reportSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },

  reportContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    marginTop: 16,
  },

  reasonGrid: {
    gap: 8,
  },

  reasonOption: {
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
  },

  reasonOptionActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    borderColor: 'rgba(0, 122, 255, 0.5)',
  },

  reasonText: {
    color: '#8E8E93',
    fontSize: 15,
    fontWeight: '500',
  },

  reasonTextActive: {
    color: '#fff',
  },

  reportInput: {
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  checkboxActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },

  checkboxLabel: {
    flex: 1,
    color: '#8E8E93',
    fontSize: 14,
    lineHeight: 20,
  },

  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },

  submitButtonDisabled: {
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
  },

  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  submitButtonTextDisabled: {
    color: '#8E8E93',
  },

  cancelButton: {
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
  },

  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 15,
  },
})