import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, SafeAreaView } from 'react-native'
import { supabase } from '../lib/supabase'
import * as ImagePicker from 'expo-image-picker'
import HeaderBar from '../components/HeaderBar'

export default function ProfileScreen({ navigation }: any) {
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('users')
      .select('username, name, bio, avatar_url')
      .eq('auth_user_id', user.id) // ✅ CORRECT → use auth_user_id
      .single()

    if (error) {
      console.log('Error loading profile:', error.message)
    } else if (data) {
      setUsername(data.username)
      setName(data.name)
      setBio(data.bio)
      setAvatarUrl(data.avatar_url)
    }
  }

  const saveProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('users')
      .update({
        username,
        name,
        bio,
        avatar_url: avatarUrl,
      })
      .eq('auth_user_id', user.id) // ✅ CORRECT → use auth_user_id

    if (error) {
      Alert.alert('Error saving profile', error.message)
    } else {
      Alert.alert('Profile saved!')
    }
  }

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // ✅ correct for your version
      allowsEditing: true,
      quality: 0.8,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const imageUri = result.assets[0].uri
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const response = await fetch(imageUri)
      const blob = await response.blob()

      const fileExt = imageUri.split('.').pop()
      const fileName = `${user.id}/avatar.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          upsert: true,
          contentType: blob.type,
        })

      if (uploadError) {
        Alert.alert('Upload error', uploadError.message)
        return
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      setAvatarUrl(urlData.publicUrl)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <HeaderBar navigation={navigation} />
      <TouchableOpacity onPress={pickAvatar}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarPlaceholderText}>+</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.username}>@{username || 'unknown'}</Text>

      <TextInput
        style={styles.input}
        placeholder="Name"
        placeholderTextColor="#999"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Bio"
        placeholderTextColor="#999"
        value={bio}
        onChangeText={setBio}
        multiline
      />

      <TouchableOpacity style={styles.button} onPress={saveProfile}>
        <Text style={styles.buttonText}>Save Profile</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    color: '#389beb',
    fontSize: 36,
  },
  username: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    width: '100%',
  },
  button: {
    backgroundColor: '#389beb',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
})
