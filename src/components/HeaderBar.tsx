import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Ionicons } from '@expo/vector-icons'

export default function HeaderBar({ navigation }: any) {
    const [avatarUrl, setAvatarUrl] = useState('')
    const [currentUserId, setCurrentUserId] = useState('')


    const loadProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        setCurrentUserId(user.id)
    
        const { data, error } = await supabase
          .from('users')
          .select('avatar_url')
          .eq('id', user.id) // ✅ CORRECT → use auth_user_id
          .single()
    
        if (error) {
          console.log('Error loading profile:', error.message)
        } else if (data) {
          setAvatarUrl(data.avatar_url)
        }
      }

    useEffect(() => {
        loadProfile()
    }, [])

  return (
    <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { userId: currentUserId })}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>?</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/logo.jpeg')} style={styles.logoImage} />
          <Text style={styles.headerTitle}>Rewsta</Text>
        </View>
        <View style={{ width: 24 }} />
    </View>
  )
}

const styles = StyleSheet.create({
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
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    color: '#389beb',
    fontSize: 24,
    marginLeft: 16,
  },
})
