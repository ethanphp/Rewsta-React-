import { useEffect, useState, useRef } from 'react'
import { Alert, View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native'
import { supabase } from '../lib/supabase'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import ImageViewing from 'react-native-image-viewing'
import SharePostModal from './SharePostModal'


interface Comment {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id?: string
  users?: {
    username: string
    name: string
    avatar_url: string
    verified: boolean
  }
  replies?: Comment[]
  like_count?: number
  is_liked?: boolean
}

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

export default function CommentsScreen({ route, navigation }: any) {
  const { postId } = route.params
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const flatListRef = useRef<FlatList>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [likedPosts, setLikedPosts] = useState<string[]>([])
  const [likeCounts, setLikeCounts] = useState<{ [postId: string]: number }>({})
  const [commentCounts, setCommentCounts] = useState<{ [postId: string]: number }>({})
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null)
  const [dislikedPosts, setDislikedPosts] = useState<string[]>([])
  const [dislikeCounts, setDislikeCounts] = useState<{ [postId: string]: number }>({})

  const loadPost = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        content,
        image_url,
        created_at,
        user_id,
        lifespan,
        users (
          username,
          name,
          avatar_url,
          verified
        )
      `)
      .eq('id', postId)
      .single()

    if (error) {
      console.log('Error loading post:', error.message)
    } else if (data) {
      setPost(data)
    }
  }

  const loadDislikes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userDislikes, error: userDislikesError } = await supabase
      .from('dislikes')
      .select('post_id')
      .eq('user_id', user.id)

    if (!userDislikesError) {
      setDislikedPosts(userDislikes.map(d => d.post_id))
    }

    const { data: allDislikes, error: allDislikesError } = await supabase
      .from('dislikes')
      .select('post_id')

    if (!allDislikesError) {
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

    // If liked, remove like
    if (likedPosts.includes(postId)) {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', postId)
    }

    if (isDisliked) {
      await supabase.from('dislikes').delete().eq('user_id', user.id).eq('post_id', postId)
    } else {
      await supabase.from('dislikes').insert({ user_id: user.id, post_id: postId })
    }

    loadDislikes()
    loadLikes()
  }


  const handleSharePost = (post: Post) => {
    setSelectedPostForShare(post)
    setShowShareModal(true)
  }

  const closeShareModal = () => {
    setShowShareModal(false)
    setSelectedPostForShare(null)
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

  const loadComments = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        user_id,
        parent_id,
        users (
          username,
          name,
          avatar_url,
          verified
        ),
        comment_likes (
          user_id
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      const commentMap = new Map<string, Comment>()
      const rootComments: Comment[] = []

      data.forEach(comment => {
        const isLiked = comment.comment_likes.some((like: any) => like.user_id === user.id)

        const commentWithReplies: Comment = {
          ...comment,
          replies: [],
          is_liked: isLiked,
          like_count: comment.comment_likes.length
        }

        commentMap.set(comment.id, commentWithReplies)
      })

      data.forEach(comment => {
        const commentObj = commentMap.get(comment.id)!
        if (comment.parent_id) {
          const parent = commentMap.get(comment.parent_id)
          if (parent) {
            parent.replies!.push(commentObj)
          }
        } else {
          rootComments.push(commentObj)
        }
      })

      setComments(rootComments)
    }
  }

  const handleCommentLike = async (commentId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const comment = comments.find(c => c.id === commentId)
    if (!comment) return

    if (comment.is_liked) {
      const { error } = await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', user.id)

      if (error) {
        console.log('Error unliking comment:', error.message)
      }
    } else {
      const { error } = await supabase
        .from('comment_likes')
        .insert([{ comment_id: commentId, user_id: user.id }])

      if (error) {
        console.log('Error liking comment:', error.message)
      }
    }

    loadComments()
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

  const addComment = async () => {
    if (!newComment.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('comments').insert([
      {
        post_id: postId,
        user_id: user.id,
        content: newComment,
        parent_id: replyingTo
      },
    ])

    if (error) {
      console.log('Error adding comment:', error.message)
    } else {
      setNewComment('')
      setReplyingTo(null)
      loadComments()
      Keyboard.dismiss()
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }

  const toggleCommentExpansion = (commentId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(commentId)) {
        newSet.delete(commentId)
      } else {
        newSet.add(commentId)
      }
      return newSet
    })
  }

  const handleReply = (commentId: string, username: string) => {
    setReplyingTo(commentId)
    setNewComment(`@${username} `)
  }

  const cancelReply = () => {
    setReplyingTo(null)
    setNewComment('')
  }

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)
    }

    fetchUser()
    loadPost()
    loadComments()
    loadLikes()
    loadCommentCounts()
    loadDislikes()

    const channel = supabase.channel('comments-screen-realtime')
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` }, () => {
        loadComments()
        loadCommentCounts()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => {
        loadLikes()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [postId])

  const handleDeletePost = () => {
    if (!post) return

    Alert.alert(
      'Delete Post',
      'Are you sure you want to permanently delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('posts')
              .delete()
              .eq('id', post.id)

            if (!error) {
              navigation.goBack()
            } else {
              console.error('Delete failed:', error.message)
            }
          },
        },
      ]
    )
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

  const renderComment = ({ item, depth = 0 }: { item: Comment; depth?: number }) => {
    const hasReplies = item.replies && item.replies.length > 0
    const isExpanded = expandedComments.has(item.id)
    const maxDepth = 3

    return (
      <View style={[styles.commentContainer, { marginLeft: depth * 16 }]}>
        <View style={styles.commentItem}>
          {/* Thread line for nested comments */}
          {depth > 0 && (
            <View style={[styles.threadLine, { left: -16 }]} />
          )}
          
          <View style={styles.commentHeader}>
            <TouchableOpacity 
              onPress={() => navigation.navigate('PublicProfile', { userId: item.user_id })}
              style={styles.avatarContainer}
            >
              {item.users?.avatar_url ? (
                <Image source={{ uri: item.users.avatar_url }} style={styles.commentAvatar} />
              ) : (
                <View style={[styles.commentAvatar, styles.avatarPlaceholder]}>
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
            </TouchableOpacity>
            
            <View style={styles.commentContent}>
              <View style={styles.commentMeta}>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('PublicProfile', { userId: item.user_id })}
                  style={styles.nameContainer}
                >
                  <Text style={styles.commentAuthor}>{item.users?.name || 'Unknown'}</Text>
                </TouchableOpacity>
                <Text style={styles.commentTime}>{timeAgo(item.created_at)}</Text>
                <TouchableOpacity style={styles.moreButton}>
                  <Ionicons name="ellipsis-horizontal" size={16} color="#8e8e93" />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.commentText}>{item.content}</Text>
              
              {/* Comment actions */}
              <View style={styles.commentActions}>
                <TouchableOpacity
                  style={styles.commentAction}
                  onPress={() => handleCommentLike(item.id)}
                >
                  <Ionicons 
                    name={item.is_liked ? "heart" : "heart-outline"} 
                    size={16} 
                    color={item.is_liked ? "#ff3b30" : "#8e8e93"}
                  />
                  <Text style={[styles.commentActionText, item.is_liked && styles.likedActionText]}>
                    {item.like_count || 0}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.commentAction}
                  onPress={() => handleReply(item.id, item.users?.username || item.users?.name || 'user')}
                >
                  <Ionicons name="return-up-back" size={16} color="#8e8e93" />
                  <Text style={styles.commentActionText}>Reply</Text>
                </TouchableOpacity>
                
                {hasReplies && (
                  <TouchableOpacity 
                    style={styles.commentAction}
                    onPress={() => toggleCommentExpansion(item.id)}
                  >
                    <Ionicons 
                      name={isExpanded ? "chevron-down" : "chevron-forward"} 
                      size={16} 
                      color="#8e8e93" 
                    />
                    <Text style={styles.commentActionText}>
                      {item.replies!.length} {item.replies!.length === 1 ? 'reply' : 'replies'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
        
        {/* Render replies */}
        {hasReplies && isExpanded && depth < maxDepth && (
          <View style={styles.repliesContainer}>
            {item.replies!.map((reply) => (
              <View key={reply.id}>
                {renderComment({ item: reply, depth: depth + 1 })}
              </View>
            ))}
          </View>
        )}
        
        {/* Show "View more replies" for deeply nested comments */}
        {hasReplies && isExpanded && depth >= maxDepth && (
          <TouchableOpacity style={styles.viewMoreReplies}>
            <Text style={styles.viewMoreText}>View {item.replies!.length} more replies</Text>
          </TouchableOpacity>
        )}

        {selectedPostForShare && (
          <SharePostModal
            visible={showShareModal}
            onClose={closeShareModal}
            post={selectedPostForShare}
          />
        )}
      </View>
    )
  }

  // Modern Header Component
  const CommentsHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#ffffff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Post</Text>
      {currentUserId === post?.user_id && (
        <TouchableOpacity onPress={handleDeletePost}>
          <Ionicons name="trash-outline" size={24} color="#ff3b30" />
        </TouchableOpacity>
      )}
      {currentUserId !== post?.user_id && <View style={{ width: 24 }} />}
    </View>
  )

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.container}>
          <CommentsHeader />
          
          <FlatList
            ref={flatListRef}
            ListHeaderComponent={
              post && (
                <>
                  {/* Main Post */}
                  <View style={styles.postCard}>
                    <View style={styles.postHeader}>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('PublicProfile', { userId: post.user_id })}
                        style={styles.avatarContainer}
                      >
                        {post.users?.avatar_url ? (
                          <Image source={{ uri: post.users.avatar_url }} style={styles.avatar} />
                        ) : (
                          <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarInitial}>
                              {post.users?.name?.charAt(0)?.toUpperCase() || '?'}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <View style={styles.postMeta}>
                        <TouchableOpacity
                          onPress={() => navigation.navigate('PublicProfile', { userId: post.user_id })}
                          style={styles.nameContainer}
                        >
                          <Text style={styles.name}>{post.users?.name || 'Unknown'}</Text>
                          {post.users?.verified && (
                            <Ionicons name="checkmark-circle" size={16} color="#0084ff" style={styles.postVerifiedBadge} />
                          )}
                        </TouchableOpacity>
                        <View style={styles.timeContainer}>
                          <Text style={styles.timestamp}>{timeAgo(post.created_at)}</Text>
                          {post.lifespan && (
                            <>
                              <Text style={styles.timeDot}>•</Text>
                              <Text style={styles.expiryText}>{getTimeRemaining(post.created_at, post.lifespan)}</Text>
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
                      <Text style={styles.postContent}>{post.content}</Text>
                      {post.image_url && (
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedImageUrl(post.image_url)
                            setImageModalVisible(true)
                          }}
                          style={styles.imageContainer}
                        >
                          <Image source={{ uri: post.image_url }} style={styles.postImage} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={styles.postActions}>
                      <TouchableOpacity style={styles.actionButton}>
                        <Ionicons name="chatbubble-outline" size={20} color="#8e8e93" />
                        <Text style={styles.actionText}>{commentCounts[post.id] || 0}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        onPress={() => handleLike(post.id)}
                        style={[styles.actionButton, likedPosts.includes(post.id) && styles.likedButton]}
                      >
                        <Ionicons 
                          name={likedPosts.includes(post.id) ? "heart" : "heart-outline"} 
                          size={20} 
                          color={likedPosts.includes(post.id) ? "#0084ff" : "#8e8e93"} 
                        />
                        <Text style={[styles.actionText, likedPosts.includes(post.id) && styles.likedText]}>
                          {likeCounts[post.id] || 0}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        onPress={() => handleDislike(post.id)}
                        style={[styles.actionButton, dislikedPosts.includes(post.id) && styles.dislikedButton]}
                      >
                        <Ionicons 
                          name={dislikedPosts.includes(post.id) ? "heart-dislike" : "heart-dislike-outline"} 
                          size={20} 
                          color={dislikedPosts.includes(post.id) ? "#ff3b30" : "#8e8e93"} 
                        />
                        <Text style={[styles.actionText, dislikedPosts.includes(post.id) && styles.dislikedText]}>
                          {dislikeCounts[post.id] || 0}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.actionButton} onPress={() => handleSharePost(post)}>
                        <Ionicons name="paper-plane-outline" size={20} color="#8e8e93" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {/* Comments header */}
                  <View style={styles.commentsHeader}>
                    <Text style={styles.commentsTitle}>
                      {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
                    </Text>
                  </View>
                </>
              )
            }
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderComment({ item })}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-outline" size={64} color="#48484a" />
                <Text style={styles.emptyTitle}>No comments yet</Text>
                <Text style={styles.emptySubtitle}>Be the first to share your thoughts!</Text>
              </View>
            }
          />

          <ImageViewing
            images={[{ uri: selectedImageUrl ?? '' }]}
            imageIndex={0}
            visible={imageModalVisible}
            onRequestClose={() => setImageModalVisible(false)}
            presentationStyle="overFullScreen"
            animationType="fade"
            backgroundColor="rgba(0,0,0,0.95)"
            swipeToCloseEnabled={true}
          />
          
          {/* Reply indicator */}
          {replyingTo && (
            <View style={styles.replyIndicator}>
              <Text style={styles.replyText}>Replying to comment</Text>
              <TouchableOpacity onPress={cancelReply}>
                <Text style={styles.cancelReply}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.input}
              placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
              placeholderTextColor="#636366"
              value={newComment}
              onChangeText={setNewComment}
              onSubmitEditing={addComment}
              multiline
            />
            <TouchableOpacity 
              style={[styles.button, !newComment.trim() && styles.buttonDisabled]} 
              onPress={addComment}
              disabled={!newComment.trim()}
            >
              <Text style={[styles.buttonText, !newComment.trim() && styles.buttonTextDisabled]}>
                {replyingTo ? 'Reply' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
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
  dislikedButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  dislikedText: {
    color: '#ff3b30',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  listContainer: {
    paddingBottom: 120,
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
    position: 'relative',
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
  postVerifiedBadge: {
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
  commentsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1c1c1e',
    backgroundColor: '#000000',
  },
  commentsTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  commentContainer: {
    marginBottom: 0,
  },
  commentItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1c1c1e',
    position: 'relative',
  },
  threadLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#333333',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1c1c1e',
    marginRight: 12,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0084ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  commentContent: {
    flex: 1,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAuthor: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  commentTime: {
    color: '#8e8e93',
    fontSize: 12,
    marginRight: 8,
  },
  commentText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 12,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    paddingVertical: 4,
  },
  commentActionText: {
    color: '#8e8e93',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  likedActionText: {
    color: '#ff3b30',
  },
  repliesContainer: {
    marginTop: 0,
  },
  viewMoreReplies: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  viewMoreText: {
    color: '#0084ff',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#8e8e93',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#636366',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  replyIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1c1c1e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 0.5,
    borderColor: '#333333',
  },
  replyText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelReply: {
    color: '#ff3b30',
    fontSize: 14,
    fontWeight: '500',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
    borderTopWidth: 0.5,
    borderColor: '#1c1c1e',
    paddingBottom: 34, // Account for safe area
  },
  input: {
    flex: 1,
    maxHeight: 120,
    color: '#ffffff',
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    fontSize: 15,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  button: {
    backgroundColor: '#0084ff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  buttonDisabled: {
    backgroundColor: '#333333',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  buttonTextDisabled: {
    color: '#8e8e93',
  },
})