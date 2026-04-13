import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Menu, Provider } from 'react-native-paper'
import { Ionicons } from '@expo/vector-icons'

export default function PostHeaderBar({ navigation, postUserId, onDelete }: any) {
  const [menuVisible, setMenuVisible] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)
    }
    getUser()
  }, [])

  const isOwner = currentUserId === postUserId

  return (
    <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/logo.jpeg')} style={styles.logoImage} />
          <Text style={styles.headerTitle}>Rewsta</Text>
        </View>
        {isOwner ? (
          <TouchableOpacity onPress={onDelete}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} /> // filler to keep alignment
        )}
    </View>
  )
}


{/*

<Provider>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.title}>Post</Text>

        {isOwner ? (
          <TouchableOpacity onPress={onDelete}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} /> // filler to keep alignment
        )}
      </View>
    </Provider>

*/}
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
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
})
