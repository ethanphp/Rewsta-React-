import { useEffect, useRef, useState, useMemo } from 'react'
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity, Dimensions, SafeAreaView, RefreshControl, Platform } from 'react-native'
import { supabase } from '../lib/supabase'
import { Modalize } from 'react-native-modalize'
import { BadgeCheck, ThumbsUp, MessageCircle, ThumbsDown, Share2, EyeOff, Heart, Rocket } from 'lucide-react-native'
import { Ionicons } from '@expo/vector-icons'
import { Portal } from '@gorhom/portal'

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

export default function OldProfileScreen({ route, navigation }: any) {
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

     {/*} await supabase.from('notifications').insert([
        {
          user_id: userId,
          type: 'follow_request',
          related_user_id: currentUserId,
          message: null,
          read: false,
        },
      ])*/}
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
        <Heart size={14} color="#ef4444" fill="#111111" />
        <Text style={styles.replyLikeCount}>{item.like_count}</Text>
      </View>
    </View>
  </TouchableOpacity>
)

  useEffect(() => {
    loadProfile()
    loadPosts()
    loadFollowData()
    loadLikes()
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
            <Text style={styles.name}>{item.users?.name || 'Unknown'}</Text>
            {item.users?.verified && (
              <BadgeCheck size={18} color="#389BEB" style={styles.verifiedBadge} />
            )}
          </TouchableOpacity>
          <View style={styles.timeContainer}>
            <Text style={styles.timestamp}>{timeAgo(item.created_at)}</Text>
            {item.lifespan && (
              <>
                <Text style={styles.timeDot}>•</Text>
                <Text style={styles.expiryText}>{getTimeRemaining(item.created_at, item.lifespan)}</Text>
                <View style={styles.ghostBadge}>
                  <Text style={styles.ghostBadgeText}>GHOST POST</Text>
                </View>
              </>
            )}
          </View>
        </View>
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
        <TouchableOpacity 
          onPress={() => navigation.navigate('Comments', { postId: item.id })}
          style={styles.actionButton}
        >
          <MessageCircle size={20} color="#64748b" />
          <Text style={styles.actionText}>{commentCounts[item.id] || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => handleLike(item.id)}
          style={[styles.actionButton, likedPosts.includes(item.id) && styles.likedButton]}
        >
          <ThumbsUp 
            size={20} 
            color={likedPosts.includes(item.id) ? "#6366f1" : "#64748b"} 
            fill={likedPosts.includes(item.id) ? "#6366f1" : "transparent"}
          />
          <Text style={[styles.actionText, likedPosts.includes(item.id) && styles.likedText]}>
            {likeCounts[item.id] || 0}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <ThumbsDown size={20} color="#64748b" />
          <Text style={styles.actionText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Share2 size={20} color="#64748b" />
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderHeader = () => (
    <>
      {profile?.banner_url ? (
        <Image source={{ uri: profile.banner_url, cache: 'force-cache' }} style={styles.banner} />
      ) : (
        <View style={[styles.banner, { backgroundColor: '#1f1f1f' }]} />
      )}
      <View style={styles.avatarWrapper}>
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
      </View>
      <View style={styles.profileInfo}>
        <View style={styles.nameRow}>
          <View>
            <View style={styles.nameContainer}>
              <Text style={styles.name}>{profile?.name || 'Unknown'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {profile?.verified && (
                  <TouchableOpacity onPress={openVerifiedModal}>
                    <BadgeCheck size={18} color="#389BEB" style={styles.verifiedBadge} />
                  </TouchableOpacity>
                )}
                {profile?.plus_member && (
                  <TouchableOpacity onPress={openPlusModal}>
                    <Rocket size={18} color="#d46239" style={{ marginLeft: 4 }} />
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
                  ? 'Unfollow'
                  : hasRequested
                  ? 'Pending'
                  : profile?.private
                  ? 'Request'
                  : 'Follow'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.followButton}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Text style={styles.followButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>
        {profile?.suspended ? (
            <TouchableOpacity
              style={styles.triggerWarningWrapper}
              onPress={() => setShowBio(!showBio)}
            >
              {!showBio ? (
                <View style={styles.triggerWarningContent}>
                  <EyeOff size={20} color="#64748b" />
                  <Text style={styles.triggerLabel}>Sensitive content</Text>
                  <Text style={styles.triggerSubtext}>This user is suspended. Their bio may contain sensitive or inappropriate content.</Text>
                  <Text style={styles.triggerReveal}>Tap to reveal</Text>
                </View>
              ) : (
                <Text style={styles.bio}>{profile?.bio || 'No bio yet'}</Text>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={styles.bio}>{profile?.bio || 'No bio yet'}</Text>
          )}
        <View style={styles.statsRow}>
          {currentUserId !== userId && mutualCount > 0 && (
            <TouchableOpacity onPress={() => mutualsModalRef.current?.open()}>
              <Text style={styles.statsText}>{mutualCount} Mutual{mutualCount > 1 ? 's' : ''}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => followersModalRef.current?.open()}>
            <Text style={styles.statsText}>{followers.length} Follower{followers.length > 1 ? 's' : ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => followingModalRef.current?.open()}>
            <Text style={styles.statsText}>{following.length} Following</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.joinedText}>Joined {JoinedDate}</Text>
      </View>
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
        setTimeout(onPress, 300) // wait for modal to close before navigating
      }}
    >
      {user.avatar_url ? (
        <Image source={{ uri: user.avatar_url }} style={styles.modalAvatar} />
      ) : (
        <View style={[styles.modalAvatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>{user.name?.charAt(0)?.toUpperCase() || '?'}</Text>
        </View>
      )}
      <View>
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
        modalStyle={{ backgroundColor: '#000' }}
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
          <Text style={styles.modalDescription}>This account’s followers list is hidden due to privacy settings.</Text>
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
          <Text style={styles.modalDescription}>This account’s following list is hidden due to privacy settings.</Text>
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
        <Text style={styles.modalTitle}>Mutuals</Text>
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
            <BadgeCheck size={49} color="#389beb" style={styles.badgeImage} />
          </View>

          <Text style={styles.modalTitle}>You're viewing a verified profile</Text>

          <Text style={styles.modalDescription}>
            This badge confirms the account is an authentic profile of public interest, such as a notable figure,
            creator, or brand.
          </Text>

          <TouchableOpacity
            style={styles.policyButton}
            onPress={() => Linking.openURL('https://rewsta.com/verification')}
          >
            <Text style={styles.policyText}>View verification criteria →</Text>
          </TouchableOpacity>
        </View>
      </Modalize>
    </Portal>
  )

  const renderPlusModal = () => (
    <Portal>
  <Modalize ref={plusModalRef} adjustToContentHeight handleStyle={{ backgroundColor: '#444' }} modalStyle={{ backgroundColor: '#111' }}>
    <View style={styles.modalContent}>
      <View style={styles.badgeContainer}>
            <Rocket size={49} color="#d46239" style={styles.badgeImage} />
      </View>
      <Text style={styles.modalTitle}>Rewsta Plus</Text>
      <Text style={styles.modalDescription}>
        Rewsta Plus unlocks features that cost the most to run: unlimited DMs, unlimited following, and some extras. Rewsta Plus helps us to keep Rewsta's mission alive.
      </Text>
      <View style={{ backgroundColor: '#222', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <Text style={{ color: '#fff', fontSize: 16 }}>♾️ Unlimited conversations</Text>
        <Text style={{ color: '#fff', fontSize: 16 }}>♾️ Unlimited Following</Text>
        <Text style={{ color: '#fff', fontSize: 16 }}>♾️ More coming soon</Text>
        <Text style={{ color: '#fff', fontSize: 16 }}>⚡ Early access to new features</Text>
        <Text style={{ color: '#fff', fontSize: 16 }}>📣 Vote on future ideas</Text>
      </View>
      <TouchableOpacity
        onPress={() => {
          plusModalRef.current?.close()
          // Navigate to your Plus subscribe page here
          navigation.navigate('RewstaPlus')
        }}
        style={{
          backgroundColor: '#d46239',
          padding: 12,
          borderRadius: 8,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Subscribe to Rewsta Plus</Text>
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
        handleStyle={{ backgroundColor: '#444' }}
        modalStyle={{ backgroundColor: '#111' }}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>You're out of follows</Text>
          <Text style={styles.modalDescription}>
            Rewsta is built to be intentional. To keep it meaningful, free users can follow up to 25 people.
          </Text>
          <Text style={[styles.modalDescription, { marginTop: -12 }]}>
            Upgrade to Rewsta Plus to unlock unlimited following.
          </Text>

          <TouchableOpacity
            onPress={() => {
              outOfFollowsModalRef.current?.close()
              navigation.navigate('RewstaPlus', { reason: 'follow_limit' })
            }}
            style={{
              backgroundColor: '#d46239',
              padding: 12,
              borderRadius: 8,
              alignItems: 'center',
              marginTop: 20,
            }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
              Upgrade to Rewsta Plus
            </Text>
          </TouchableOpacity>
        </View>
      </Modalize>
    </Portal>
  )



  const postsToShow =
    activeTab === 'Posts' ? posts :
    activeTab === 'Replies' ? replies :
    []

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#f8fafc" />
        </TouchableOpacity>
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/logo.jpeg')} style={styles.logoImage} />
          <Text style={styles.headerTitle}>@{profile?.username || 'user'}</Text>
        </View>
        {currentUserId === userId ? (
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={24} color="#f8fafc" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
    </View>
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
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#6366f1"
                colors={['#6366f1']}
              />
            }
            ListEmptyComponent={
            profile?.suspended ? (
              <View style={styles.suspendedWrapper}>
                <Text style={styles.suspendedTitle}>This user has been suspended</Text>
                <Text style={styles.suspendedText}>
                  The profile you're trying to view has been restricted for violating our community guidelines.
                </Text>
              </View>
            ) : profile?.private && !isFollowing && currentUserId !== userId ? (
              <View style={styles.privateWrapper}>
                <View style={styles.privateIconContainer}>
                  <Ionicons name="lock-closed" size={32} color="#6366f1" />
                </View>
                <Text style={styles.privateTitle}>This account is private</Text>
                <Text style={styles.privateText}>
                  Request to follow @{profile?.username} to connect and see their posts.
                </Text>
                <TouchableOpacity style={styles.privateFollowButton} onPress={handleFollow}>
                  <Text style={styles.privateFollowButtonText}>
                    {hasRequested ? 'Request Sent' : 'Send Follow Request'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.emptyText}>
                No {activeTab.toLowerCase()} yet.
              </Text>
            )
          }
          />
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
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1f1f1f',
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '600',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // or use margin if gap not supported
  },
  logoImage: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  banner: {
    width: '100%',
    height: Dimensions.get('window').width * 0.5,
    backgroundColor: '#1f1f1f',
  },
  avatarWrapper: {
    marginTop: -40,
    paddingHorizontal: 16,
  },

  privateWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 40,
  },
  privateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  privateTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  privateText: {
    color: '#94a3b8',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  privateFollowButton: {
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  privateFollowButtonText: {
    color: 'black',
    fontSize: 16,
    fontWeight: '600',
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#0f0f0f',
    backgroundColor: '#1f1f1f',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1f1f1f',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6366f1',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  profileAvatarInitial: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '600',
  },
  profileInfo: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },

  suspendedWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  suspendedTitle: {
    color: '#f87171',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  suspendedText: {
    color: '#f8fafc',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },

  triggerWarningWrapper: {
    backgroundColor: '#0f0f0f',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    borderStyle: 'dashed',
    marginBottom: 10,
  },

  triggerWarningContent: {
    alignItems: 'center',
  },

  triggerLabel: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },

  triggerSubtext: {
    color: '#475569',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },

  triggerReveal: {
    color: '#389BEB',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '600',
  },

  name: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '600',
  },
  username: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '500',
  },
  verifiedBadge: {
    marginLeft: 6,
  },
  followButton: {
    backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 12,
  },
  followButtonText: {
    color: 'black',
    fontSize: 14,
    fontWeight: '600',
  },
  bio: {
    color: '#f8fafc',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statsText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 16,
  },
  joinedText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
    marginHorizontal: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTabItem: {
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
  },
  tabText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#f8fafc',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  postCard: {
    backgroundColor: '#111111',
    marginVertical: 6,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 12,
  },
  postMeta: {
    flex: 1,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  timeDot: {
    color: '#64748b',
    fontSize: 14,
    marginHorizontal: 6,
  },
  expiryText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
  },
  ghostBadge: {
    backgroundColor: '#1f1f1f',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  ghostBadgeText: {
    color: '#6366f1',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  replyCard: {
  backgroundColor: '#111111',
  borderRadius: 16,
  padding: 16,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: '#1f1f1f',
},

replyText: {
  color: '#f8fafc',
  fontSize: 15,
  lineHeight: 22,
  marginBottom: 10,
  fontWeight: '500',
},

postPreview: {
  color: '#94a3b8',
  fontSize: 14,
  lineHeight: 20,
  marginBottom: 10,
  fontStyle: 'italic',
},

replyMeta: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

replyTime: {
  color: '#64748b',
  fontSize: 13,
  fontWeight: '500',
},

replyLikeContainer: {
  flexDirection: 'row',
  alignItems: 'center',
},

replyLikeCount: {
  color: '#ef4444',
  fontSize: 13,
  fontWeight: '600',
  marginLeft: 4,
},

  contentContainer: {
    marginBottom: 16,
  },
  postContent: {
    color: '#f8fafc',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  imageContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: 240,
    backgroundColor: '#1f1f1f',
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
    backgroundColor: '#1a1a1a',
    minWidth: 60,
    justifyContent: 'center',
  },
  likedButton: {
    backgroundColor: '#1e1b4b',
  },
  actionText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  likedText: {
    color: '#6366f1',
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    fontWeight: '500',
  },
  modal: {
    backgroundColor: '#0f0f0f',
  },
  modalContent: {
    padding: 16,
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  modalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#1f1f1f',
  },
  modalName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  modalUsername: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  modalDescription: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  modalHandle: {
    backgroundColor: '#334155',
    width: 45,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginVertical: 8,
  },

  badgeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },

  badgeImage: {
    width: 72,
    height: 72,
    resizeMode: 'contain',
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
    color: '#fff',
  },

  modalDescription: {
    fontSize: 15,
    color: '#ccc',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },

  policyButton: {
    alignSelf: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#333',
  },

  policyText: {
    color: '#389beb',
    fontWeight: '500',
    fontSize: 14,
  },
})