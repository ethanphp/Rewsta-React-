// components/PostActions.tsx
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export default function PostActions({
  postId,
  likedPosts,
  dislikedPosts,
  likeCounts,
  dislikeCounts,
  commentCount,
  onLike,
  onDislike,
  onCommentPress,
  onSharePress,
}) {
  const isLiked = likedPosts.includes(postId)
  const isDisliked = dislikedPosts.includes(postId)

  return (
    <View style={styles.postActions}>
      <TouchableOpacity onPress={onCommentPress} style={styles.actionButton}>
        <Ionicons name="chatbubble-outline" size={20} color="#8e8e93" />
        <Text style={styles.actionText}>{commentCount || 0}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onLike(postId)}
        style={[styles.actionButton, isLiked && styles.likedButton]}
      >
        <Ionicons
          name={isLiked ? 'heart' : 'heart-outline'}
          size={20}
          color={isLiked ? '#0084ff' : '#8e8e93'}
        />
        <Text style={[styles.actionText, isLiked && styles.likedText]}>
          {likeCounts[postId] || 0}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onDislike(postId)}
        style={[styles.actionButton, isDisliked && styles.dislikedButton]}
      >
        <Ionicons
          name={isDisliked ? 'heart-dislike' : 'heart-dislike-outline'}
          size={20}
          color={isDisliked ? '#ff3b30' : '#8e8e93'}
        />
        <Text style={[styles.actionText, isDisliked && styles.dislikedText]}>
          {dislikeCounts[postId] || 0}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionButton} onPress={onSharePress}>
        <Ionicons name="paper-plane-outline" size={20} color="#8e8e93" />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 8,
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
})
