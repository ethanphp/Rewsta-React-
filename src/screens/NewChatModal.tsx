import { useEffect, useState, useRef } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet, SafeAreaView, Animated, TextInput
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'

export default function NewChatModal() {
  console.log('Rendering NewChatModal') // Debug log
  const [mutuals, setMutuals] = useState<any[]>([])
  const [allMutuals, setAllMutuals] = useState<any[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const navigation = useNavigation()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        console.error('Auth error:', authError?.message)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      if (profileError || !profile) {
        console.error('Profile error:', profileError?.message)
        return
      }

      setCurrentUserId(profile.id)

      const { data, error } = await supabase.rpc('get_mutual_follows', {
        user_id: profile.id
      })

      if (error) {
        console.error('Error fetching mutuals:', error.message)
        } else {
        setAllMutuals(data || [])
        setMutuals(data || [])
        }
    }

    fetchData()

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start()
  }, [])

  const handleSelect = async (user: any) => {
    if (!currentUserId) return

    const { data, error } = await supabase
      .from('conversations')
      .select('id, participant1, participant2')
      .or(`participant1.eq.${currentUserId},participant2.eq.${currentUserId}`)

    if (error) {
      console.error('Conversation check failed:', error.message)
      return
    }

    const existing = data.find((conv: any) =>
      (conv.participant1 === currentUserId && conv.participant2 === user.id) ||
      (conv.participant2 === currentUserId && conv.participant1 === user.id)
    )

    if (existing) {
      navigation.navigate('Chat', {
        conversationId: existing.id,
        recipient: user
      })
    } else {
      const { data: newConv, error: createErr } = await supabase
        .from('conversations')
        .insert([{ participant1: currentUserId, participant2: user.id }])
        .select()
        .single()

      if (createErr) {
        console.error('Failed to create convo:', createErr.message)
        return
      }

      navigation.navigate('Chat', {
        conversationId: newConv.id,
        recipient: user
      })
    }
  }

  const handleSearch = (text: string) => {
    setSearchQuery(text)
    const filtered = text
      ? allMutuals.filter((m) =>
          (m.name + m.username).toLowerCase().includes(text.toLowerCase())
        )
      : allMutuals
    setMutuals(filtered)
  }

  const clearSearch = () => {
    setSearchQuery('')
    setMutuals(allMutuals)
  }

  const MutualItem = ({ item, onSelect }: { item: any, onSelect: (user: any) => void }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current

    const handlePressIn = () => {
        Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
        }).start()
    }

    const handlePressOut = () => {
        Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
        }).start()
    }

    return (
        <Animated.View style={[styles.itemContainer, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
            style={styles.item}
            onPress={() => onSelect(item)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
        >
            <View style={styles.avatarContainer}>
            {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, styles.placeholder]}>
                <Text style={styles.initial}>{item.name?.charAt(0)?.toUpperCase() || '?'}</Text>
                </View>
            )}
            {item.verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={12} color="#ffffff" />
              </View>
            )}
            </View>
            <View style={styles.textContainer}>
            <Text style={styles.name}>{item.name}</Text>
            {item.username && (
                <Text style={styles.username}>@{item.username}</Text>
            )}
            </View>
        </TouchableOpacity>
        </Animated.View>
    )
    }

  const renderItem = ({ item }: { item: any }) => (
    <MutualItem item={item} onSelect={handleSelect} />
    )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0084ff" />
        </TouchableOpacity>
        <Text style={styles.title}>New Chat</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#636366" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search mutuals..."
            placeholderTextColor="#636366"
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#636366" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            You can only message people you follow and who follow you back.
          </Text>
        </View>

        <FlatList
            data={mutuals}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={64} color="#48484a" />
                <Text style={styles.emptyTitle}>
                  {searchQuery ? 'No results found' : 'No mutual follows yet'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery 
                    ? 'Try searching for someone else' 
                    : 'Follow people and get them to follow you back to start chatting'
                  }
                </Text>
              </View>
            }
        />
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
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
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
  content: {
    flex: 1,
  },
  infoBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    },
    infoText: {
    color: '#8e8e93',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  itemContainer: {
    marginVertical: 0,
  },
  item: {
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
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0084ff',
  },
  initial: {
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
  textContainer: {
    flex: 1,
  },
  name: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  username: {
    color: '#8e8e93',
    fontSize: 15,
    fontWeight: '400',
    marginTop: 2,
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
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 22,
  },
})