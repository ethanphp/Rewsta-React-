import { useEffect, useState, useRef } from 'react'
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, RefreshControl, Platform } from 'react-native'
import { supabase } from '../lib/supabase'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { ThumbsUp, MessageCircle, ThumbsDown, Share2, BadgeCheck, MoreHorizontal, Eye, EyeOff } from 'lucide-react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useCallback } from 'react'
import { Linking } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Portal } from '@gorhom/portal'
import { Modalize } from 'react-native-modalize'
import SharePostModal from './SharePostModal'

interface Post {
  id: string
  content: string
  image_url: string
  created_at: string
  user_id: string
  lifespan: string
  users?: {
    username: string
    name: string
    avatar_url: string
    verified: boolean
  }
}

function renderContentWithMentions(
  text: string,
  users: { username: string; name: string; id: string }[],
  navigation: any
) {
  const parts = text.split(/(\s+)/).map((part, index) => {
    // Detect @mentions
    if (part.startsWith('@')) {
      const username = part.slice(1)
      const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase())
      if (user) {
        return (
          <Text
            key={`mention-${index}`}
            style={{ color: '#0084ff', fontWeight: '600' }}
            onPress={() => navigation.navigate('PublicProfile', { userId: user.id })}
          >
            {user.name}
          </Text>
        )
      }
    }

    // Detect URLs
    const urlRegex = /^(https?:\/\/[^\s]+|www\.[^\s]+|\b[^\s]+\.(com|net|org|io|uk|gov|co|dev)\b)/i
    if (urlRegex.test(part)) {
      const fullUrl = part.startsWith('http') ? part : `https://${part}`
      return (
        <Text
          key={`link-${index}`}
          style={{ color: '#0084ff', textDecorationLine: 'underline' }}
          onPress={() => Linking.openURL(fullUrl)}
        >
          {part}
        </Text>
      )
    }

    // Normal text
    return (
      <Text key={`text-${index}`} style={{ color: '#ffffff' }}>
        {part}
      </Text>
    )
  })

  return <Text style={styles.postContent}>{parts}</Text>
}

export default function FeedScreen({ navigation }: any) {
  const [likedPosts, setLikedPosts] = useState<string[]>([])
  const [likeCounts, setLikeCounts] = useState<{ [postId: string]: number }>({})
  const [dislikedPosts, setdislikedPosts] = useState<string[]>([])
  const [dislikeCounts, setdisLikeCounts] = useState<{ [postId: string]: number }>({})
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [revealedPosts, setRevealedPosts] = useState<string[]>([])
  const [commentCounts, setCommentCounts] = useState<{ [postId: string]: number }>({})
  const [followingIds, setFollowingIds] = useState<string[]>([])
  const [readyForRealtime, setReadyForRealtime] = useState(false)
  const [mentionableUsers, setMentionableUsers] = useState<{ username: string, name: string, id: string }[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [cachedPreview, setCachedPreview] = useState<Post[] | null>(null)
  const ghostModalRef = useRef<Modalize>(null)
  const [selectedGhostPost, setSelectedGhostPost] = useState<Post | null>(null)
  const [postViews, setPostViews] = useState<{ [postId: string]: { name: string, avatar_url: string | null }[] }>({})
  const [highlightedComments, setHighlightedComments] = useState<{ [postId: string]: any }>({})
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null)

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('users')
      .select('id, name, avatar_url, verified')
      .eq('auth_user_id', user.id)
      .single()

    if (profile) {
      setCurrentUser(profile)
    }
  }

  const handleSharePost = (post: Post) => {
    setSelectedPostForShare(post)
    setShowShareModal(true)
  }

  // Add this function to close the share modal
  const closeShareModal = () => {
    setShowShareModal(false)
    setSelectedPostForShare(null)
  }

  const loadPostViews = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: mutuals, error: mutualsError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    if (mutualsError) {
      console.error('Error fetching mutuals:', mutualsError.message)
      return
    }

    const mutualIds = mutuals.map((f) => f.following_id)

    const { data: views, error: viewsError } = await supabase
      .from('post_views')
      .select('post_id, users(name, avatar_url)')
      .in('viewer_id', mutualIds)

    if (viewsError) {
      console.error('Error loading views:', viewsError.message)
      return
    }

    const viewsByPost: { [postId: string]: { name: string }[] } = {}
    views.forEach(view => {
      if (!viewsByPost[view.post_id]) viewsByPost[view.post_id] = []
      viewsByPost[view.post_id].push(view.users)
    })

    setPostViews(viewsByPost)
  }

  const hasTriggerWarning = (text: string) => {
    const triggers = ["triggerwarning", "suicide", "abuse", "selfharm"]
    const lower = text.toLowerCase()
    return triggers.some((trigger) => lower.includes(trigger))
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    const freshPosts = await fetchFreshPosts()
    setPosts(freshPosts)
    await AsyncStorage.setItem('cached_posts', JSON.stringify(freshPosts))
    await Promise.all([loadLikes(), loaddisLikes(), loadCommentCounts()])
    setRefreshing(false)
  }

  const loadCommentCounts = async () => {
    const { data, error } = await supabase
      .from('comments')
      .select('post_id')

    if (error) {
      console.log('Error loading comment counts:', error.message)
      return
    }

    const counts: { [postId: string]: number } = {}
    data.forEach((comment) => {
      counts[comment.post_id] = (counts[comment.post_id] || 0) + 1
    })

    setCommentCounts(counts)
  }

  const loadMentionableUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, name')

    if (!error && data) {
      setMentionableUsers(data)
      console.log('Mentionable users:', data)
    }
  }

  const fetchFreshPosts = async (): Promise<Post[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (profileError || !profile) {
        console.error('❌ Error loading profile:', profileError?.message)
        return []
      }

      const { data: follows, error: followsError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', profile.id)

      if (followsError) {
        console.error('❌ Error loading follows:', followsError.message)
        return []
      }

      const followingIds = follows.map(f => f.following_id)
      followingIds.push(profile.id)
      setFollowingIds(followingIds)
      setReadyForRealtime(true)

      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select(`
          id, content, image_url, created_at, user_id, lifespan,
          users (username, name, avatar_url, verified)
        `)
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })

      if (postsError) {
        console.error('❌ Error loading posts:', postsError.message)
        return []
      }

      return posts || []
    } catch (err) {
      console.error('❌ Unexpected error in fetchFreshPosts:', err)
      return []
    }
  }

  const loadLikes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userLikes, error: userLikesError } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', user.id)

    if (userLikesError) {
      console.log('Error loading user likes:', userLikesError.message)
    } else {
      setLikedPosts(userLikes.map((like) => like.post_id))
    }

    const { data: allLikes, error: allLikesError } = await supabase
      .from('likes')
      .select('post_id')

    if (allLikesError) {
      console.log('Error loading like counts:', allLikesError.message)
    } else {
      const counts: { [postId: string]: number } = {}
      allLikes.forEach((like) => {
        counts[like.post_id] = (counts[like.post_id] || 0) + 1
      })
      setLikeCounts(counts)
    }
  }

  const loaddisLikes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userdisLikes, error: userdisLikesError } = await supabase
      .from('dislikes')
      .select('post_id')
      .eq('user_id', user.id)

    if (userdisLikesError) {
      console.log('Error loading user dislikes:', userdisLikesError.message)
    } else {
      setdislikedPosts(userdisLikes.map((like) => like.post_id))
    }

    const { data: alldisLikes, error: alldisLikesError } = await supabase
      .from('dislikes')
      .select('post_id')

    if (alldisLikesError) {
      console.log('Error loading dislike counts:', alldisLikesError.message)
    } else {
      const counts: { [postId: string]: number } = {}
      alldisLikes.forEach((like) => {
        counts[like.post_id] = (counts[like.post_id] || 0) + 1
      })
      setdisLikeCounts(counts)
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

  const getTimeRemaining = (createdAt: string, lifespan: string | null) => {
    if (!lifespan) return null

    const created = new Date(createdAt)
    const parts = lifespan.split(":").map(part => parseInt(part, 10))

    if (parts.length !== 3 || parts.some(isNaN)) {
      return "invalid lifespan"
    }

    const [hours, minutes, seconds] = parts
    const totalMs = ((hours * 60 * 60) + (minutes * 60) + seconds) * 1000
    const expires = new Date(created.getTime() + totalMs)
    const diff = expires.getTime() - Date.now()

    if (diff <= 0) return "expired"

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hoursLeft = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) return `${days}d ${hoursLeft}h`
    if (hoursLeft > 0) return `${hoursLeft}h ${minutesLeft}m`
    return `${minutesLeft}m`
  }

  useEffect(() => {
    const initFeed = async () => {
      try {
        // Load current user first
        await loadCurrentUser()

        // 1. Load preview while waiting for real posts
        const cached = await AsyncStorage.getItem('cached_posts')
        if (cached) {
          const cachedData = JSON.parse(cached)
          if (Array.isArray(cachedData)) {
            setCachedPreview(cachedData)
          }
        }

        // 2. Get fresh posts and set as real state
        const fresh = await fetchFreshPosts()
        setPosts(fresh)
        await AsyncStorage.setItem('cached_posts', JSON.stringify(fresh))

        const showHighlightChance = 0.3
        const postsToShow = fresh.filter(() => Math.random() < showHighlightChance)
        const highlighted: { [postId: string]: any } = {}

        await Promise.all(
          postsToShow.map(async (post) => {
            const { data, error } = await supabase
              .from('comments')
              .select(`
                id, content, created_at, user_id,
                users (username, name, avatar_url, verified),
                comment_likes (user_id)
              `)
              .eq('post_id', post.id)

            if (!error && data?.length > 0) {
              const sorted = data.sort((a, b) => b.comment_likes.length - a.comment_likes.length)
              highlighted[post.id] = {
                ...sorted[0],
                like_count: sorted[0].comment_likes.length,
                users: sorted[0].users,
              }
            } else {
              highlighted[post.id] = null
            }
          })
        )

        setHighlightedComments(highlighted)
      } catch (err) {
        console.error('Feed error:', err)
      } finally {
        setLoading(false)
      }

      loadLikes()
      loaddisLikes()
      loadCommentCounts()
      loadMentionableUsers()
      loadPostViews()
    }

    initFeed()
  }, [])

  useFocusEffect(
    useCallback(() => {
      let channel: any

      const subscribeToRealtime = () => {
        if (followingIds.length === 0) return

        channel = supabase.channel('realtime-feed')

        channel
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
            const newPost = payload.new
            if (!followingIds.includes(newPost.user_id)) return

            const { data: userDetails, error } = await supabase
              .from('users')
              .select('username, name, avatar_url, verified')
              .eq('id', newPost.user_id)
              .single()

            if (error || !userDetails) return

            const enrichedPost = {
              ...newPost,
              users: userDetails,
            }

            setPosts((prev) => {
              if (prev.some(p => p.id === enrichedPost.id)) return prev
              return [enrichedPost, ...prev]
            })
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, loadLikes)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, loadCommentCounts)
          .subscribe()

        console.log('🌀 Realtime subscribed')
      }

      subscribeToRealtime()

      return () => {
        if (channel) {
          supabase.removeChannel(channel)
          console.log('🛑 Realtime unsubscribed')
        }
      }
    }, [followingIds])
  )

  const renderGhostModal = () => {
    const remaining = selectedGhostPost
      ? getTimeRemaining(selectedGhostPost.created_at, selectedGhostPost.lifespan)
      : null
    const [countdown, setCountdown] = useState<string | null>(null)

    useEffect(() => {
      if (!selectedGhostPost) return

      const updateCountdown = () => {
        const time = getTimeRemaining(
          selectedGhostPost.created_at,
          selectedGhostPost.lifespan
        )
        setCountdown(time)
      }

      updateCountdown() // initial
      const interval = setInterval(updateCountdown, 1000) // update every second

      return () => clearInterval(interval)
    }, [selectedGhostPost])

    return (
      <Portal>
        <Modalize
          ref={ghostModalRef}
          adjustToContentHeight
          modalStyle={styles.modal}
          withHandle
          handleStyle={styles.modalHandle}
          keyboardAvoidingOffset={Platform.OS === 'ios' ? 80 : 100}
        >
          <View style={styles.modalContent}>
            <View style={styles.badgeContainer}>
              <View style={styles.ghostBadge}>
                <Text style={styles.ghostBadgeText}>GHOST POST</Text>
              </View>
            </View>

            <Text style={styles.modalTitle}>This is a GhostPost</Text>

            {countdown && (
              <Text style={{ color: '#0084ff', fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 10 }}>
                Post disappears in {countdown}
              </Text>
            )}

            <Text style={styles.modalDescription}>
              GhostPosts are temporary posts that vanish after a set amount of time.
              They're designed for the moment: no history, no pressure. Once time runs out,
              they're gone for good.
            </Text>

            <TouchableOpacity
              style={styles.policyButton}
              onPress={() => Linking.openURL('https://rewsta.io/ghostposts')}
            >
              <Text style={styles.policyText}>Read more about GhostPosts →</Text>
            </TouchableOpacity>
          </View>
        </Modalize>
      </Portal>
    )
  }

  const openGhostModal = (post: Post) => {
    setSelectedGhostPost(post)
    ghostModalRef.current?.open()
  }

  const handleLike = async (postId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const isLiked = likedPosts.includes(postId)

    if (isLiked) {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', postId)

      if (error) {
        console.log('Error unliking:', error.message)
      }
    } else {
      // If disliked, remove the dislike first
      if (dislikedPosts.includes(postId)) {
        await supabase
          .from('dislikes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', postId)
      }

      const { error } = await supabase.from('likes').insert([
        {
          user_id: user.id,
          post_id: postId,
        },
      ])

      if (error) {
        console.log('Error liking:', error.message)
      }
    }

    loadLikes()
    loaddisLikes()
  }

  const handleDislike = async (postId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const isDisliked = dislikedPosts.includes(postId)

    // If liked, remove the like first
    if (likedPosts.includes(postId)) {
      await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', postId)
    }

    if (isDisliked) {
      const { error } = await supabase
        .from('dislikes')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', postId)

      if (error) {
        console.log('Error removing dislike:', error.message)
      }
    } else {
      const { error } = await supabase.from('dislikes').insert([
        {
          user_id: user.id,
          post_id: postId,
        },
      ])

      if (error) {
        console.log('Error disliking:', error.message)
      }
    }

    loaddisLikes()
    loadLikes()
  }

  const SkeletonPost = () => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={[styles.avatar, styles.skeleton]} />
        <View style={styles.postMeta}>
          <View style={[styles.skeleton, styles.skeletonName]} />
          <View style={[styles.skeleton, styles.skeletonTime]} />
        </View>
        <View style={styles.spacer} />
      </View>
      <View style={[styles.skeleton, styles.skeletonContent]} />
    </View>
  )

  const renderItem = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('PublicProfile', { userId: item.user_id })} 
          style={styles.avatarContainer}
        >
          {item.users?.avatar_url ? (
            <Image source={{ uri: item.users.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {item.users?.name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.postMeta}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('PublicProfile', { userId: item.user_id })}
            style={styles.nameContainer}
          >
            <Text style={styles.name}>{item.users?.name || 'Unknown'}</Text>
            {item.users?.verified && (
              <Ionicons name="checkmark-circle" size={16} color="#0084ff" style={styles.verifiedBadge} />
            )}
          </TouchableOpacity>
          
          <View style={styles.timeContainer}>
            <Text style={styles.timestamp}>{timeAgo(item.created_at)}</Text>
            {item.lifespan && (
              <>
                <Text style={styles.timeDot}>•</Text>
                <Text style={styles.expiryText}>{getTimeRemaining(item.created_at, item.lifespan)}</Text>
                <TouchableOpacity onPress={() => openGhostModal(item)}>
                  <View style={styles.ghostBadgeSmall}>
                    <Text style={styles.ghostBadgeText}>GHOST</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#8e8e93" />
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {hasTriggerWarning(item.content) && !revealedPosts.includes(item.id) ? (
          <TouchableOpacity
            onPress={() => setRevealedPosts((prev) => [...prev, item.id])}
            style={styles.triggerOverlay}
          >
            <View style={styles.triggerContent}>
              <Ionicons name="eye-off" size={20} color="#8e8e93" />
              <Text style={styles.triggerText}>Sensitive content</Text>
              <Text style={styles.triggerSubtext}>Tap to reveal</Text>
            </View>
          </TouchableOpacity>
        ) : (
          renderContentWithMentions(item.content, mentionableUsers, navigation)
        )}

        {item.image_url && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: item.image_url }} style={styles.postImage} />
          </View>
        )}
      </View>

      <View style={styles.postActions}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Comments', { postId: item.id })}
          style={styles.actionButton}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#8e8e93" />
          <Text style={styles.actionText}>{commentCounts[item.id] || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => handleLike(item.id)}
          style={[styles.actionButton, likedPosts.includes(item.id) && styles.likedButton]}
        >
          <Ionicons 
            name={likedPosts.includes(item.id) ? "heart" : "heart-outline"} 
            size={20} 
            color={likedPosts.includes(item.id) ? "#0084ff" : "#8e8e93"} 
          />
          <Text style={[styles.actionText, likedPosts.includes(item.id) && styles.likedText]}>
            {likeCounts[item.id] || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => handleDislike(item.id)}
          style={[styles.actionButton, dislikedPosts.includes(item.id) && styles.dislikedButton]}
        >
          <Ionicons 
            name={dislikedPosts.includes(item.id) ? "heart-dislike" : "heart-dislike-outline"} 
            size={20} 
            color={dislikedPosts.includes(item.id) ? "#ff3b30" : "#8e8e93"} 
          />
          <Text style={[styles.actionText, dislikedPosts.includes(item.id) && styles.dislikedText]}>
            {dislikeCounts[item.id] || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleSharePost(item)}
        >
          <Ionicons name="paper-plane-outline" size={20} color="#8e8e93" />
        </TouchableOpacity>
      </View>

      {postViews[item.id]?.length > 0 && (
        <View style={styles.viewsContainer}>
          <View style={styles.viewsAvatars}>
            {postViews[item.id].slice(0, 3).map((v, i) => (
              <Image
                key={i}
                source={{ uri: v.avatar_url || 'https://via.placeholder.com/32' }}
                style={[styles.viewAvatar, { marginLeft: i === 0 ? 0 : -8 }]}
              />
            ))}
          </View>
          <Text style={styles.viewsText}>
            Seen by {postViews[item.id].slice(0, 2).map(v => v.name).join(', ')}
            {postViews[item.id].length > 2 && ` + ${postViews[item.id].length - 2} more`}
          </Text>
        </View>
      )}

      {highlightedComments[item.id] && (
        <View style={styles.highlightedComment}>
          <View style={styles.commentHeader}>
            <Image
              source={{ uri: highlightedComments[item.id].users?.avatar_url }}
              style={styles.commentAvatar}
            />
            <Text style={styles.commentAuthor}>{highlightedComments[item.id].users?.name}</Text>
          </View>
          <Text style={styles.commentContent}>
            {highlightedComments[item.id].content}
          </Text>
        </View>
      )}

    </View>
  )

  const PostItem = ({ item, navigation }: { item: Post, navigation: any }) => {
    useEffect(() => {
      const logPostView = async (postId: string) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Check if the user allows views to be shown
        const { data, error } = await supabase
          .from('users')
          .select('show_post_views')
          .eq('id', user.id)
          .single()

        if (error || !data?.show_post_views) return // don't log the view

        // Check if already viewed
        const { data: existing } = await supabase
          .from('post_views')
          .select('id')
          .eq('user_id', user.id)
          .eq('post_id', postId)
          .maybeSingle()

        if (!existing) {
          await supabase.from('post_views').insert({
            post_id: postId,
            user_id: user.id,
          })
        }
      }

      logPostView(item.id)
    }, [item.id])

    return renderItem({ item })
  }

  // Modern Header Component
  const FeedHeader = () => (
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
      <Text style={styles.headerTitle}>Home</Text>
      <View style={{ width: 32 }} />
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <FeedHeader />
      
      <FlatList
        data={loading && cachedPreview ? cachedPreview : posts}
        keyExtractor={(item, index) => loading ? index.toString() : item.id}
        renderItem={({ item }) => loading ? <SkeletonPost /> : <PostItem item={item} navigation={navigation} />}
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

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreatePost')}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>

      {renderGhostModal()}
      {selectedPostForShare && (
        <SharePostModal
          visible={showShareModal}
          onClose={closeShareModal}
          post={selectedPostForShare}
        />
      )}
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
  newPostButton: {
    padding: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 95,
    right: 15,
    backgroundColor: '#0084ff',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 100,
  },
  listContainer: {
    paddingBottom: 100,
  },
  postCard: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1c1c1e',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  postMeta: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  verifiedBadge: {
    marginLeft: 4,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    color: '#8e8e93',
    fontSize: 14,
    fontWeight: '400',
  },
  timeDot: {
    color: '#8e8e93',
    fontSize: 14,
    marginHorizontal: 4,
  },
  expiryText: {
    color: '#0084ff',
    fontSize: 13,
    fontWeight: '500',
  },
  ghostBadgeSmall: {
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#0084ff',
  },
  ghostBadge: {
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0084ff',
  },
  ghostBadgeText: {
    color: '#0084ff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  moreButton: {
    padding: 4,
    borderRadius: 8,
  },
  spacer: {
    flex: 1,
  },
  contentContainer: {
    marginBottom: 12,
  },
  postContent: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  imageContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#1c1c1e',
  },
  triggerOverlay: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333333',
    borderStyle: 'dashed',
  },
  triggerContent: {
    alignItems: 'center',
  },
  triggerText: {
    color: '#8e8e93',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  triggerSubtext: {
    color: '#636366',
    fontSize: 14,
    marginTop: 4,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'transparent',
    minWidth: 60,
    justifyContent: 'center',
  },
  likedButton: {
    backgroundColor: 'rgba(0, 132, 255, 0.1)',
  },
  dislikedButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  actionText: {
    color: '#8e8e93',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  likedText: {
    color: '#0084ff',
  },
  dislikedText: {
    color: '#ff3b30',
  },
  viewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  viewsAvatars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  viewAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#1c1c1e',
  },
  viewsText: {
    color: '#8e8e93',
    fontSize: 13,
    flex: 1,
  },
  highlightedComment: {
    marginTop: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderColor: '#333333',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  commentAuthor: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  commentContent: {
    color: '#8e8e93',
    fontSize: 14,
    lineHeight: 18,
  },
  skeleton: {
    backgroundColor: '#1c1c1e',
    borderRadius: 8,
  },
  skeletonName: {
    height: 16,
    width: 120,
    marginBottom: 6,
  },
  skeletonTime: {
    height: 14,
    width: 80,
  },
  skeletonContent: {
    height: 60,
    width: '100%',
    marginTop: 8,
  },
  modal: {
    backgroundColor: '#000000',
  },
  modalContent: {
    padding: 20,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalDescription: {
    color: '#8e8e93',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalHandle: {
    backgroundColor: '#333333',
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 8,
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  policyButton: {
    alignSelf: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  policyText: {
    color: '#0084ff',
    fontWeight: '600',
    fontSize: 15,
  },
})