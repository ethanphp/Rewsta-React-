import { useEffect, useRef, useState, useMemo } from 'react'
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity, Dimensions, SafeAreaView, RefreshControl, Platform } from 'react-native'
import { supabase } from '../lib/supabase'
import { Modalize } from 'react-native-modalize'
import { Ionicons } from '@expo/vector-icons'
import { Portal } from '@gorhom/portal'
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

interface User {
  id: string
  username: string
  name: string
  bio: string
  avatar_url: string
  banner_url: string
  created_at: string
  auth_user_id: string
  verified: boolean
  suspended: boolean
  private: boolean
  plus_member: boolean
}

interface CommentWithPost {
  id: string
  content: string
  created_at: string
  post: {
    id: string
    content: string
  }
  comment_likes: { user_id: string }[]
}

export default function PublicProfileScreen({ route, navigation }: any) {
  const { userId } = route.params
  const [profile, setProfile] = useState<User | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [followers, setFollowers] = useState<any[]>([])
  const [following, setFollowing] = useState<any[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [activeTab, setActiveTab] = useState<'Posts' | 'Replies' | 'Releases'>('Posts')
  const [refreshing, setRefreshing] = useState(false)
  const [likedPosts, setLikedPosts] = useState<string[]>([])
  const [likeCounts, setLikeCounts] = useState<{ [postId: string]: number }>({})
  const [commentCounts, setCommentCounts] = useState<{ [postId: string]: number }>({})
  const [mutualCount, setMutualCount] = useState(0)
  const [mutuals, setMutuals] = useState<any[]>([])
  const followersModalRef = useRef<Modalize>(null)
  const followingModalRef = useRef<Modalize>(null)
  const outOfFollowsModalRef = useRef<Modalize>(null)
  const mutualsModalRef = useRef<Modalize>(null)
  const verifiedModalRef = useRef<Modalize>(null)
  const plusModalRef = useRef<Modalize>(null)
  const [showBio, setShowBio] = useState(false)
  const [followDataLoaded, setFollowDataLoaded] = useState(false)
  const [hasRequested, setHasRequested] = useState(false)
  const isPrivateBlocked = () =>
    profile?.private && currentUserId !== userId && !isFollowing
  const [replies, setReplies] = useState<CommentWithPost[]>([])
  const [dislikedPosts, setDislikedPosts] = useState<string[]>([])
  const [dislikeCounts, setDislikeCounts] = useState<{ [postId: string]: number }>({})
  const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)

  const avatarPreviewRef = useRef<Modalize>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  const openAvatarPreview = (url: string) => {
    setPreviewImageUrl(url)
    avatarPreviewRef.current?.open()
  }

  const loadReplies = async () => {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        post:post_id (
          id,
          content
        ),
        comment_likes (
          user_id
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setReplies(data.map(c => ({
        ...c,
        like_count: c.comment_likes.length
      })))
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadProfile(), loadPosts(), loadFollowData(), loadLikes(), loadCommentCounts()])
    setRefreshing(false)
  }

  const openVerifiedModal = () => {
    verifiedModalRef.current?.open()
  }
  const openPlusModal = () => {
    plusModalRef.current?.open()
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
    const [hoursStr, minutesStr, secondsStr] = lifespan.split(":")
    const totalMs = (parseInt(hoursStr) * 60 * 60 + parseInt(minutesStr) * 60 + parseInt(secondsStr)) * 1000
    const expires = new Date(created.getTime() + totalMs)
    const diff = expires.getTime() - Date.now()
    
    if (diff <= 0) return "expired"

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const loadProfile = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, name, bio, avatar_url, banner_url, created_at, auth_user_id, verified, suspended, private, plus_member')
      .eq('auth_user_id', userId)
      .single()

    if (error) {
      console.log('Error loading profile:', error.message)
    } else if (data) {
      setProfile(data)
    }
  }

  const loadPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        content,
        image_url,
        created_at,
        user_id,
        lifespan,
        users(username, name, avatar_url, verified)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.log('Error loading posts:', error.message)
    } else if (data) {
      setPosts(data)
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

  const loadDislikes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userDislikes } = await supabase
      .from('dislikes')
      .select('post_id')
      .eq('user_id', user.id)

    if (userDislikes) {
      setDislikedPosts(userDislikes.map((d) => d.post_id))
    }

    const { data: allDislikes } = await supabase.from('dislikes').select('post_id')

    if (allDislikes) {
      const counts: { [postId: string]: number } = {}
      allDislikes.forEach((d) => {
        counts[d.post_id] = (counts[d.post_id] || 0) + 1
      })
      setDislikeCounts(counts)
    }
  }

  const handleDislike = async (postId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const isDisliked = dislikedPosts.includes(postId)

    // Remove like if it exists
    if (likedPosts.includes(postId)) {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', postId)
    }

    if (isDisliked) {
      await supabase.from('dislikes').delete().eq('user_id', user.id).eq('post_id', postId)
    } else {
      await supabase.from('dislikes').insert({ user_id: user.id, post_id: postId })
    }

    loadLikes()
    loadDislikes()
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

  const loadFollowData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    const { data: myFollowingData, error: myFollowingError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    if (myFollowingError) {
      console.log('Error loading my following:', myFollowingError.message)
    }

    const { data: followRequestData } = await supabase
    .from('follow_requests')
    .select('id')
    .eq('sender_id', user.id)
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .maybeSingle()

    setHasRequested(!!followRequestData)

    const { data: theirFollowingData, error: theirFollowingError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)

    if (theirFollowingError) {
      console.log('Error loading their following:', theirFollowingError.message)
    }

    const myFollowingSet = new Set(myFollowingData?.map(f => f.following_id) || [])
    const theirFollowingSet = new Set(theirFollowingData?.map(f => f.following_id) || [])

    let mutualCount = 0
    const mutualIds: string[] = []
    for (let id of myFollowingSet) {
      if (theirFollowingSet.has(id)) {
        mutualCount++
        mutualIds.push(id)
      }
    }
    setMutualCount(mutualIds.length)

    if (mutualIds.length > 0) {
      const { data: mutualsData, error: mutualsError } = await supabase
        .from('users')
        .select('id, username, name, avatar_url')
        .in('id', mutualIds)

      if (mutualsError) {
        console.log('Error loading mutuals:', mutualsError.message)
      } else {
        setMutuals(mutualsData || [])
      }
    } else {
      setMutuals([])
    }

    const { data: followersData, count: followersCount, error: followersError } = await supabase
      .from('follows')
      .select('*, follower: follower_id ( id, username, name, avatar_url )', { count: 'exact' })
      .eq('following_id', userId)

    if (followersError) {
      console.log('Error loading followers:', followersError.message)
    } else {
      setFollowers(followersData || [])
    }

    const { data: followingData, count: followingCount, error: followingError } = await supabase
      .from('follows')
      .select('*, following: following_id ( id, username, name, avatar_url )', { count: 'exact' })
      .eq('follower_id', userId)

    if (followingError) {
      console.log('Error loading following:', followingError.message)
    } else {
      setFollowing(followingData || [])
    }

    const { data: isFollowingData } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', userId)
      .maybeSingle()

    setIsFollowing(!!isFollowingData)
    setFollowDataLoaded(true)
  }

  const handleFollow = async () => {
    if (currentUserId === userId) return

    if (isFollowing) {
      // Unfollow
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', userId)
    } else if (hasRequested) {
      // Already requested – maybe later allow cancel
      return
    } else if (profile?.private) {
      // Private account → insert follow request
      await supabase.from('follow_requests').insert([
        {
          sender_id: currentUserId,
          receiver_id: userId,
        },
      ])
    } else {
        // Public → follow instantly (but check if they're allowed)
        const { data: currentUserProfile, error: currentUserError } = await supabase
          .from('users')
          .select('plus_member')
          .eq('id', currentUserId)
          .single()

        if (currentUserError || !currentUserProfile) return

        const { data: currentFollowing, error: followingError } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', currentUserId)

        if (followingError) return

        if (!currentUserProfile.plus_member && currentFollowing.length >= 25) {
          outOfFollowsModalRef.current?.open()
          return
        }

        await supabase.from('follows').insert([
          {
            follower_id: currentUserId,
            following_id: userId,
          },
        ])

        await supabase.from('notifications').insert([
          {
            user_id: userId,
            type: 'new_follower',
            related_user_id: currentUserId,
            message: null,
            read: false,
          },
        ])
      }

    loadFollowData()
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
  }

  useEffect(() => {
    if (activeTab === 'Replies') {
      loadReplies()
    }
  }, [activeTab])

  const renderReply = ({ item }: { item: CommentWithPost }) => (
    <TouchableOpacity
      style={styles.replyCard}
      onPress={() => navigation.navigate('Comments', { postId: item.post.id })}
      activeOpacity={0.9}
    >
      <Text style={styles.replyText}>{item.post.content}</Text>
      <Text style={styles.postPreview} numberOfLines={2}>
        {currentUserId === userId ? 'You' : `@${profile?.username || 'user'}`} replied: {item.content}
      </Text>
      <View style={styles.replyMeta}>
        <Text style={styles.replyTime}>{timeAgo(item.created_at)}</Text>
        <View style={styles.replyLikeContainer}>
          <Ionicons name="heart" size={14} color="#ff3b30" />
          <Text style={styles.replyLikeCount}>{item.like_count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )

  const handleSharePost = (post: Post) => {
    setSelectedPostForShare(post)
    setShowShareModal(true)
  }

  const closeShareModal = () => {
    setSelectedPostForShare(null)
    setShowShareModal(false)
  }

  useEffect(() => {
    loadProfile()
    loadPosts()
    loadFollowData()
    loadLikes()
    loadDislikes()
    loadCommentCounts()

    const channel = supabase.channel('profile-screen-realtime')
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `user_id=eq.${userId}` }, () => {
        loadPosts()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => {
        loadLikes()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
        loadCommentCounts()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const JoinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : ''

  const renderPost = ({ item }: { item: Post }) => (
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
            <Text style={styles.postName}>{item.users?.name || 'Unknown'}</Text>
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
                <View style={styles.ghostBadge}>
                  <Text style={styles.ghostBadgeText}>GHOST</Text>
                </View>
              </>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#8e8e93" />
        </TouchableOpacity>
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.postContent}>{item.content}</Text>
        {item.image_url && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: item.image_url }} style={styles.postImage} />
          </View>
        )}
      </View>
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Comments', { postId: item.id })}>
          <Ionicons name="chatbubble-outline" size={20} color="#8e8e93" />
          <Text style={styles.actionText}>{commentCounts[item.id] || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleLike(item.id)} style={[styles.actionButton, likedPosts.includes(item.id) && styles.likedButton]}>
          <Ionicons name={likedPosts.includes(item.id) ? "heart" : "heart-outline"} size={20} color={likedPosts.includes(item.id) ? "#0084ff" : "#8e8e93"} />
          <Text style={[styles.actionText, likedPosts.includes(item.id) && styles.likedText]}>{likeCounts[item.id] || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleDislike(item.id)} style={[styles.actionButton, dislikedPosts.includes(item.id) && styles.dislikedButton]}>
          <Ionicons name={dislikedPosts.includes(item.id) ? "heart-dislike" : "heart-dislike-outline"} size={20} color={dislikedPosts.includes(item.id) ? "#ff3b30" : "#8e8e93"} />
          <Text style={[styles.actionText, dislikedPosts.includes(item.id) && styles.dislikedText]}>{dislikeCounts[item.id] || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => handleSharePost(item)}>
          <Ionicons name="paper-plane-outline" size={20} color="#8e8e93" />
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderHeader = () => (
    <>
      {/* Banner */}
      {profile?.banner_url ? (
        <Image source={{ uri: profile.banner_url, cache: 'force-cache' }} style={styles.banner} />
      ) : (
        <View style={[styles.banner, { backgroundColor: '#1c1c1e' }]} />
      )}
      
      {/* Profile Info */}
      <View style={styles.profileSection}>
        <View style={styles.avatarWrapper}>
            <View style={styles.avatarWithBadge}>
              {profile?.avatar_url ? (
                <TouchableOpacity onPress={() => openAvatarPreview(profile.avatar_url)}>
                  <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatar} />
                </TouchableOpacity>
              ) : (
                <View style={[styles.profileAvatar, styles.avatarPlaceholder]}>
                  <Text style={styles.profileAvatarInitial}>
                    {profile?.name?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}

              {profile?.verified && (
                <View style={styles.avatarBadge}>
                  <TouchableOpacity onPress={openVerifiedModal}>
                  <Ionicons name="checkmark-circle" size={20} color="#0084ff" />
                </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <View style={styles.nameSection}>
              <View style={styles.nameContainer}>
                <Text style={styles.name}>{profile?.name || 'Unknown'}</Text>
                <View style={styles.badgeContainer}>
                  {/*{profile?.verified && (
                    <TouchableOpacity onPress={openVerifiedModal}>
                      <Ionicons name="checkmark-circle" size={20} color="#0084ff" />
                    </TouchableOpacity>
                  )}*/}
                  {profile?.plus_member && (
                    <TouchableOpacity onPress={openPlusModal}>
                      <Ionicons name="rocket" size={18} color="#ff9500" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Text style={styles.username}>@{profile?.username || 'user'}</Text>
            </View>
            
            {currentUserId !== userId ? (
              <TouchableOpacity style={styles.followButton} onPress={handleFollow}>
                <Text style={styles.followButtonText}>
                  {isFollowing
                    ? 'Following'
                    : hasRequested
                    ? 'Pending'
                    : profile?.private
                    ? 'Request'
                    : 'Follow'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigation.navigate('EditProfile')}
              >
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Bio */}
          {profile?.suspended ? (
            <TouchableOpacity
              style={styles.triggerWarningWrapper}
              onPress={() => setShowBio(!showBio)}
            >
              {!showBio ? (
                <View style={styles.triggerWarningContent}>
                  <Ionicons name="eye-off" size={20} color="#8e8e93" />
                  <Text style={styles.triggerLabel}>Sensitive content</Text>
                  <Text style={styles.triggerSubtext}>This user is suspended. Their bio may contain sensitive content.</Text>
                  <Text style={styles.triggerReveal}>Tap to reveal</Text>
                </View>
              ) : (
                <Text style={styles.bio}>{profile?.bio || 'No bio yet'}</Text>
              )}
            </TouchableOpacity>
          ) : (
            profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            {currentUserId !== userId && mutualCount > 0 && (
              <TouchableOpacity onPress={() => mutualsModalRef.current?.open()}>
                <Text style={styles.statsText}>
                  <Text style={styles.statsNumber}>{mutualCount}</Text> mutual{mutualCount > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => followersModalRef.current?.open()}>
              <Text style={styles.statsText}>
                <Text style={styles.statsNumber}>{followers.length}</Text> follower{followers.length !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => followingModalRef.current?.open()}>
              <Text style={styles.statsText}>
                <Text style={styles.statsNumber}>{following.length}</Text> following
              </Text>
            </TouchableOpacity>
          </View>

          {/* Joined Date */}
          <Text style={styles.joinedText}>Joined {JoinedDate}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {['Posts', 'Replies', 'Releases'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, activeTab === tab && styles.activeTabItem]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  )

  const memoizedHeader = useMemo(() => renderHeader(), [profile, currentUserId, isFollowing, hasRequested, followers, following, mutualCount, activeTab])

  const renderModalItem = (
    user: any,
    index: number,
    onPress: () => void,
    closeRef?: React.RefObject<Modalize>
  ) => (
    <TouchableOpacity
      key={index}
      style={styles.modalItem}
      onPress={() => {
        if (closeRef?.current) closeRef.current.close()
        setTimeout(onPress, 300)
      }}
    >
      {user.avatar_url ? (
        <Image source={{ uri: user.avatar_url }} style={styles.modalAvatar} />
      ) : (
        <View style={[styles.modalAvatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>{user.name?.charAt(0)?.toUpperCase() || '?'}</Text>
        </View>
      )}
      <View style={styles.modalUserInfo}>
        <Text style={styles.modalName}>{user.name || 'Unknown'}</Text>
        <Text style={styles.modalUsername}>@{user.username}</Text>
      </View>
    </TouchableOpacity>
  )

  const renderAvatarPreviewModal = () => (
    <Portal>
      <Modalize
        ref={avatarPreviewRef}
        adjustToContentHeight={false}
        modalStyle={{ backgroundColor: '#000000' }}
        withHandle={false}
        scrollViewProps={{ contentContainerStyle: { alignItems: 'center', justifyContent: 'center', flex: 1 } }}
      >
        {previewImageUrl && (
          <Image
            source={{ uri: previewImageUrl }}
            style={{
              width: Dimensions.get('window').width,
              height: Dimensions.get('window').width,
              resizeMode: 'contain',
            }}
          />
        )}
      </Modalize>
    </Portal>
  )

  const renderFollowersModal = () => (
    <Portal>
      <Modalize
        ref={followersModalRef}
        adjustToContentHeight
        modalStyle={styles.modal}
        withHandle
        handleStyle={styles.modalHandle}
        keyboardAvoidingOffset={Platform.OS === 'ios' ? 80 : 100}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Followers</Text>
          {isPrivateBlocked() ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="lock-closed" size={48} color="#48484a" />
              <Text style={styles.emptyTitle}>Private Account</Text>
              <Text style={styles.emptySubtitle}>This account's followers list is hidden due to privacy settings.</Text>
            </View>
          ) : (
            followers.map((followerRow, index) =>
              renderModalItem(
                followerRow.follower,
                index,
                () => navigation.navigate('PublicProfile', { userId: followerRow.follower.id }),
                followersModalRef
              )
            )
          )}
        </View>
      </Modalize>
    </Portal>
  )

  const renderFollowingModal = () => (
    <Portal>
      <Modalize
        ref={followingModalRef}
        adjustToContentHeight
        modalStyle={styles.modal}
        withHandle
        handleStyle={styles.modalHandle}
        keyboardAvoidingOffset={Platform.OS === 'ios' ? 80 : 100}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Following</Text>
          {isPrivateBlocked() ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="lock-closed" size={48} color="#48484a" />
              <Text style={styles.emptyTitle}>Private Account</Text>
              <Text style={styles.emptySubtitle}>This account's following list is hidden due to privacy settings.</Text>
            </View>
          ) : (
            following.map((followingRow, index) =>
              renderModalItem(
                followingRow.following,
                index,
                () => navigation.navigate('PublicProfile', { userId: followingRow.following.id }),
                followingModalRef
              )
            )
          )}
        </View>
      </Modalize>
    </Portal>
  )

  const renderMutualsModal = () => (
    <Portal>
      <Modalize
        ref={mutualsModalRef}
        adjustToContentHeight
        modalStyle={styles.modal}
        withHandle
        handleStyle={styles.modalHandle}
        keyboardAvoidingOffset={Platform.OS === 'ios' ? 80 : 100}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Mutual Connections</Text>
          {mutuals.map((user, index) =>
            renderModalItem(
              user,
              index,
              () => navigation.navigate('PublicProfile', { userId: user.id }),
              mutualsModalRef
            )
          )}
        </View>
      </Modalize>
    </Portal>
  )

  const renderVerificationModal = () => (
    <Portal>
      <Modalize
        ref={verifiedModalRef}
        adjustToContentHeight
        modalStyle={styles.modal}
        withHandle
        handleStyle={styles.modalHandle}
        keyboardAvoidingOffset={Platform.OS === 'ios' ? 80 : 100}
      >
        <View style={styles.modalContent}>
          <View style={styles.badgeContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#0084ff" />
          </View>
          <Text style={styles.modalTitle}>Verified Account</Text>
          <Text style={styles.modalDescription}>
            This badge confirms the account is an authentic profile of public interest, such as a notable figure,
            creator, or brand.
          </Text>
          <TouchableOpacity
            style={styles.policyButton}
            onPress={() => {
              verifiedModalRef.current?.close()
              // Add your verification policy URL here
            }}
          >
            <Text style={styles.policyText}>Learn more about verification →</Text>
          </TouchableOpacity>
        </View>
      </Modalize>
    </Portal>
  )

  const renderPlusModal = () => (
    <Portal>
      <Modalize 
        ref={plusModalRef} 
        adjustToContentHeight 
        modalStyle={styles.modal}
        withHandle
        handleStyle={styles.modalHandle}
      >
        <View style={styles.modalContent}>
          <View style={styles.badgeContainer}>
            <Ionicons name="rocket" size={64} color="#ff9500" />
          </View>
          <Text style={styles.modalTitle}>Rewsta Plus</Text>
          <Text style={styles.modalDescription}>
            Rewsta Plus unlocks premium features that cost the most to run: unlimited DMs, unlimited following, and exclusive extras.
          </Text>
          <View style={styles.featuresList}>
            <Text style={styles.featureItem}>♾️ Unlimited conversations</Text>
            <Text style={styles.featureItem}>♾️ Unlimited following</Text>
            <Text style={styles.featureItem}>⚡ Early access to new features</Text>
            <Text style={styles.featureItem}>📣 Vote on future ideas</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              plusModalRef.current?.close()
              navigation.navigate('RewstaPlus')
            }}
            style={styles.subscribeButton}
          >
            <Text style={styles.subscribeButtonText}>Subscribe to Rewsta Plus</Text>
          </TouchableOpacity>
        </View>
      </Modalize>
    </Portal>
  )

  const renderOutOfFollowsModal = () => (
    <Portal>
      <Modalize
        ref={outOfFollowsModalRef}
        adjustToContentHeight
        modalStyle={styles.modal}
        withHandle
        handleStyle={styles.modalHandle}
      >
        <View style={styles.modalContent}>
          <View style={styles.badgeContainer}>
            <Ionicons name="people" size={64} color="#ff9500" />
          </View>
          <Text style={styles.modalTitle}>Follow Limit Reached</Text>
          <Text style={styles.modalDescription}>
            To keep connections meaningful, free users can follow up to 25 people.
          </Text>
          <Text style={styles.modalDescription}>
            Upgrade to Rewsta Plus to unlock unlimited following.
          </Text>
          <TouchableOpacity
            onPress={() => {
              outOfFollowsModalRef.current?.close()
              navigation.navigate('RewstaPlus', { reason: 'follow_limit' })
            }}
            style={styles.subscribeButton}
          >
            <Text style={styles.subscribeButtonText}>Upgrade to Rewsta Plus</Text>
          </TouchableOpacity>
        </View>
      </Modalize>
    </Portal>
  )

  const postsToShow =
    activeTab === 'Posts' ? posts :
    activeTab === 'Replies' ? replies :
    []

  // Modern Header Component
  const ProfileHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#ffffff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>@{profile?.username || 'user'}</Text>
      {currentUserId === userId ? (
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 24 }} />
      )}
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <ProfileHeader />
      
      {profile && (
        <>
          <FlatList
            data={
              profile?.suspended
                ? []
                : profile?.private && !isFollowing && currentUserId !== userId
                ? []
                : postsToShow
            }
            keyExtractor={(item) => item.id}
            renderItem={activeTab === 'Replies' ? renderReply : renderPost}
            ListHeaderComponent={memoizedHeader}
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
            ListEmptyComponent={
              profile?.suspended ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="warning" size={64} color="#ff3b30" />
                  <Text style={styles.emptyTitle}>Account Suspended</Text>
                  <Text style={styles.emptySubtitle}>
                    This profile has been restricted for violating community guidelines.
                  </Text>
                </View>
              ) : profile?.private && !isFollowing && currentUserId !== userId ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="lock-closed" size={64} color="#0084ff" />
                  <Text style={styles.emptyTitle}>This account is private</Text>
                  <Text style={styles.emptySubtitle}>
                    Follow @{profile?.username} to see their posts and activity.
                  </Text>
                  <TouchableOpacity style={styles.followFromEmptyButton} onPress={handleFollow}>
                    <Text style={styles.followFromEmptyText}>
                      {hasRequested ? 'Request Sent' : 'Send Follow Request'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-outline" size={64} color="#48484a" />
                  <Text style={styles.emptyTitle}>No {activeTab.toLowerCase()} yet</Text>
                  <Text style={styles.emptySubtitle}>
                    {currentUserId === userId 
                      ? `When you ${activeTab === 'Posts' ? 'post' : 'reply'}, it will appear here.`
                      : `When they ${activeTab === 'Posts' ? 'post' : 'reply'}, it will appear here.`
                    }
                  </Text>
                </View>
              )
            }
          />
          {selectedPostForShare && (
            <SharePostModal
              visible={showShareModal}
              onClose={closeShareModal}
              post={selectedPostForShare}
            />
          )}
          {renderFollowersModal()}
          {renderFollowingModal()}
          {renderMutualsModal()}
          {renderVerificationModal()}
          {renderPlusModal()}
          {renderOutOfFollowsModal()}
          {renderAvatarPreviewModal()}
        </>
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
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  banner: {
    width: '100%',
    height: 120,
    backgroundColor: '#1c1c1e',
  },
  profileSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  dislikedButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  dislikedText: {
    color: '#ff3b30',
  },
  avatarWrapper: {
    marginTop: -40,
    marginBottom: 12,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#000000',
    backgroundColor: '#1c1c1e',
  },
  profileAvatarInitial: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '600',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  nameSection: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  username: {
    color: '#8e8e93',
    fontSize: 16,
    fontWeight: '400',
  },
  followButton: {
    backgroundColor: '#0084ff',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#1c1c1e',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  bio: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statsText: {
    color: '#8e8e93',
    fontSize: 15,
    fontWeight: '400',
    marginRight: 20,
  },
  statsNumber: {
    color: '#ffffff',
    fontWeight: '600',
  },
  joinedText: {
    color: '#8e8e93',
    fontSize: 15,
    fontWeight: '400',
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1c1c1e',
    backgroundColor: '#000000',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  activeTabItem: {
    borderBottomWidth: 2,
    borderBottomColor: '#0084ff',
  },
  tabText: {
    color: '#8e8e93',
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '600',
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
  avatarWithBadge: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#000', // optional: for contrast
    borderRadius: 10,
  },

  avatarInitial: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  postMeta: {
    flex: 1,
  },
  postName: {
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
    marginTop: 2,
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
  ghostBadge: {
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
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
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
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
  actionText: {
    color: '#8e8e93',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  likedText: {
    color: '#0084ff',
  },
  replyCard: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1c1c1e',
  },
  replyText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 8,
    fontWeight: '500',
  },
  postPreview: {
    color: '#8e8e93',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  replyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  replyTime: {
    color: '#8e8e93',
    fontSize: 13,
    fontWeight: '400',
  },
  replyLikeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyLikeCount: {
    color: '#ff3b30',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  triggerWarningWrapper: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  triggerWarningContent: {
    alignItems: 'center',
  },
  triggerLabel: {
    color: '#8e8e93',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  triggerSubtext: {
    color: '#636366',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 18,
  },
  triggerReveal: {
    color: '#0084ff',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8e8e93',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  followFromEmptyButton: {
    backgroundColor: '#0084ff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followFromEmptyText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1c1c1e',
  },
  modalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#1c1c1e',
  },
  modalUserInfo: {
    flex: 1,
  },
  modalName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalUsername: {
    color: '#8e8e93',
    fontSize: 14,
    fontWeight: '400',
  },
  modalDescription: {
    color: '#8e8e93',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
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
  featuresList: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  featureItem: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 8,
  },
  subscribeButton: {
    backgroundColor: '#ff9500',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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