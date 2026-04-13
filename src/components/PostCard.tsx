import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { ThumbsUp, MessageCircle, ThumbsDown, Share2 } from 'lucide-react-native'

export default function PostCard({
  post,
  onPressProfile,
  onLikePress,
  liked,
  likeCount,
  timeAgo
}: any) {
  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <TouchableOpacity onPress={onPressProfile} style={styles.avatarWrapper}>
          {post.users?.avatar_url ? (
            <Image source={{ uri: post.users.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]} />
          )}
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{post.users?.name || 'Unknown'}</Text>
            <Text style={styles.handle}>@{post.users?.username || 'unknown'}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.timestamp}>{timeAgo(post.created_at)}</Text>
          </View>

          <Text style={styles.postContent}>{post.content}</Text>

          {post.image_url ? (
            <Image source={{ uri: post.image_url }} style={styles.postImage} />
          ) : null}

          <View style={styles.postActions}>
            <TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MessageCircle size={18} color="#aaa" />
                <Text style={[styles.actionIcon, { marginLeft: 4 }]}>0</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={onLikePress}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ThumbsUp size={18} color={liked ? '#389beb' : '#aaa'} />
                <Text style={[styles.actionIcon, { marginLeft: 4 }]}>{likeCount || 0}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ThumbsDown size={18} color="#aaa" />
                <Text style={[styles.actionIcon, { marginLeft: 4 }]}>0</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Share2 size={18} color="#aaa" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  postCard: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  avatarWrapper: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    backgroundColor: '#1a1a1a',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  handle: {
    color: '#aaa',
    fontSize: 15,
    marginLeft: 6,
  },
  dot: {
    color: '#aaa',
    fontSize: 15,
    marginHorizontal: 6,
  },
  timestamp: {
    color: '#aaa',
    fontSize: 15,
  },
  postContent: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    lineHeight: 22,
    marginTop: 6,
    marginBottom: 6,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingRight: 16,
    paddingLeft: 0,
  },
  actionIcon: {
    color: '#aaa',
    fontSize: 16,
  },
})
