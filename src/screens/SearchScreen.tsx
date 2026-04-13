import { useEffect, useState } from 'react'
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, Image, Platform, PermissionsAndroid } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Contacts from 'expo-contacts'
import { supabase } from '../lib/supabase'

interface User {
  id: string
  username: string
  name: string
  avatar_url: string
  verified: boolean
}

export default function SearchScreen({ navigation }: any) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([])
  const [contactUsers, setContactUsers] = useState<(User & { saved_as?: string })[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [currentUser, setCurrentUser] = useState<any>(null)

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('users')
      .select('id, name, avatar_url, verified')
      .eq('auth_user_id', user.id)
      .single()

    if (profile) {
      setCurrentUserId(profile.id)
      setCurrentUser(profile)
    }
  }

  type ContactMatch = { name: string; number: string }

  const getContactMatches = async (): Promise<ContactMatch[]> => {
    const { status } = await Contacts.requestPermissionsAsync()
    if (status !== 'granted') return []

    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] })

    const matches: ContactMatch[] = []
    for (const contact of data) {
      const cleaned = (contact.phoneNumbers || []).map((pn) =>
        pn.number?.replace(/\s+/g, '').replace(/[^0-9+]/g, '')
      )
      cleaned.forEach((num) => {
        if (num) matches.push({ name: contact.name, number: num })
      })
    }
    return matches
  }

  const loadContactUsers = async () => {
    const rawContacts = await getContactMatches()
    if (!rawContacts.length || !currentUserId) return

    const numberList = rawContacts.map(c => c.number)
    const phoneToName = Object.fromEntries(rawContacts.map(c => [c.number, c.name]))

    const { data, error } = await supabase.rpc('get_unfollowed_contacts', {
      current_user_id: currentUserId,
      contact_numbers: numberList,
    })

    if (error) {
      console.error('Error loading contact users:', error.message)
    } else if (data) {
      // Add `saved_as` field to each user
      const withSavedName = data.map((user: any) => {
        const savedName = phoneToName[user.phone_number] || null
        return { ...user, saved_as: savedName }
      })
      setContactUsers(withSavedName)
    }
  }

  const searchUsers = async (searchQuery: string) => {
    if (searchQuery.trim() === '') {
      setResults([])
      return
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, username, name, avatar_url, verified')
      .or(`username.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
      .neq('id', currentUserId)

    if (error) {
      console.log('Error searching users:', error.message)
    } else if (data) {
      setResults(data)
    }
  }

  const loadSuggestedUsers = async () => {
    const { data, error } = await supabase.rpc('get_suggested_users_with_mutuals', {
      current_user_id: currentUserId,
    })

    if (error) {
      console.log('Error loading suggested users:', error.message)
    } else if (data) {
      setSuggestedUsers(data)
    }
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
  }

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (!currentUserId) return
    loadSuggestedUsers()
    loadContactUsers()

    const channel = supabase.channel('search-screen-realtime')
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        if (query.trim() === '') {
          loadSuggestedUsers()
          loadContactUsers()
        } else {
          searchUsers(query)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, query])

  useEffect(() => {
    searchUsers(query)
  }, [query, currentUserId])

  const renderItem = ({ item }: { item: User & { saved_as?: string } }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => navigation.navigate('PublicProfile', { userId: item.id })}
    >
      <View style={styles.avatarContainer}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {item.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        {item.verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={12} color="#ffffff" />
          </View>
        )}
      </View>

      <View style={styles.userContent}>
        <View style={styles.userHeader}>
          <Text style={styles.nameText}>{item.name || 'Unknown'}</Text>
          {item.saved_as && (
            <View style={styles.contactBadge}>
              <Text style={styles.contactBadgeText}>Contact</Text>
            </View>
          )}
        </View>

        <Text style={styles.usernameText}>@{item.username}</Text>

        {(item as any).mutual_count > 0 && (
          <View style={styles.mutualRow}>
            <View style={styles.avatarStack}>
              {(item as any).mutuals?.slice(0, 2).map((m: any, index: number) => (
                <Image
                  key={index}
                  source={{ uri: m.avatar_url }}
                  style={[styles.mutualAvatar, { marginLeft: index === 0 ? 0 : -8 }]}
                />
              ))}
            </View>
            <Text style={styles.mutualText}>
              {(item as any).mutual_count} {(item as any).mutual_count === 1 ? 'mutual' : 'mutuals'}
            </Text>
          </View>
        )}

        {item.saved_as && (
          <Text style={styles.savedAsText}>
            Saved as: {item.saved_as}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )

  const mergedData = query.trim() === ''
    ? [
        ...contactUsers,
        ...suggestedUsers.filter(
          s => !contactUsers.some(c => c.id === s.id) // prevent duplicates
        ),
      ]
    : results

  // Modern Header Component
  const SearchHeader = () => (
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
      <Text style={styles.headerTitle}>Search</Text>
      <View style={{ width: 32 }} />
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <SearchHeader />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#636366" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#636366"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            autoComplete="off"
            keyboardAppearance="dark"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#636366" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={mergedData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          query.trim() === '' && mergedData.length > 0 ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Suggested for you</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={query.trim() !== '' ? "search-outline" : "people-outline"} 
              size={64} 
              color="#48484a" 
            />
            <Text style={styles.emptyTitle}>
              {query.trim() !== '' ? 'No users found' : 'No suggestions'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {query.trim() !== '' 
                ? 'Try searching for someone else' 
                : 'Connect with people to see suggestions here'
              }
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    color: '#8e8e93',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userItem: {
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
  userContent: {
    flex: 1,
    justifyContent: 'center',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  contactBadge: {
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0084ff',
  },
  contactBadgeText: {
    color: '#0084ff',
    fontSize: 12,
    fontWeight: '600',
  },
  usernameText: {
    color: '#8e8e93',
    fontSize: 15,
    fontWeight: '400',
    marginBottom: 4,
  },
  mutualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  avatarStack: {
    flexDirection: 'row',
    marginRight: 8,
  },
  mutualAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#1c1c1e',
  },
  mutualText: {
    color: '#8e8e93',
    fontSize: 13,
    fontWeight: '500',
  },
  savedAsText: {
    color: '#8e8e93',
    fontSize: 13,
    marginTop: 2,
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