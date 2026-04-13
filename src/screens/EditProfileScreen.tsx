import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, Dimensions, ScrollView,
  KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { Ionicons } from '@expo/vector-icons'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function EditProfileScreen({ navigation }: any) {
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('users')
      .select('username, name, bio, avatar_url, banner_url')
      .eq('auth_user_id', user.id)
      .single()

    if (error) {
      console.log('Error loading profile:', error.message)
    } else if (data) {
      setUsername(data.username || '')
      setName(data.name || '')
      setBio(data.bio || '')
      setAvatarUrl(data.avatar_url || '')
      setBannerUrl(data.banner_url || '')
    }
  }

  const saveProfile = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('users')
      .update({
        username,
        name,
        bio,
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
      })
      .eq('auth_user_id', user.id)

    setLoading(false)
    
    if (error) {
      Alert.alert('Error saving profile', error.message)
    } else {
      Alert.alert('Profile saved!')
      navigation.goBack()
    }
  }

  const uploadImage = async (uri: string, path: string, bucket: string) => {
    const fileExt = uri.split('.').pop()
    const fileName = `${path}.${fileExt}`
    const fileBuffer = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    const fileBytes = Uint8Array.from(atob(fileBuffer), c => c.charCodeAt(0))

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileBytes, {
        upsert: true,
        contentType: 'image/jpeg',
      })

    if (uploadError) throw new Error(uploadError.message)

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName)
    return data.publicUrl
  }

  const pickAndUpload = async (type: 'avatar' | 'banner') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    })

    if (result.canceled || !result.assets?.length) return
    const uri = result.assets[0].uri
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const rawUrl = await uploadImage(uri, `${user.id}/${type}`, type === 'avatar' ? 'avatars' : 'banner')
      const bustedUrl = `${rawUrl}?t=${Date.now()}`
      type === 'avatar' ? setAvatarUrl(bustedUrl) : setBannerUrl(bustedUrl)
    } catch (err: any) {
      Alert.alert('Upload error', err.message)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  // Modern Header Component
  const EditProfileHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#ffffff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Edit Profile</Text>
      <TouchableOpacity onPress={saveProfile} disabled={loading}>
        <Text style={[styles.saveButton, loading && styles.saveButtonDisabled]}>
          {loading ? 'Saving...' : 'Save'}
        </Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <EditProfileHeader />
      
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Banner Section */}
          <View style={styles.bannerSection}>
            <TouchableOpacity onPress={() => pickAndUpload('banner')} style={styles.bannerContainer}>
              {bannerUrl ? (
                <Image source={{ uri: bannerUrl }} style={styles.banner} />
              ) : (
                <View style={styles.bannerPlaceholder}>
                  <Ionicons name="image-outline" size={32} color="#8e8e93" />
                  <Text style={styles.bannerPlaceholderText}>Add cover photo</Text>
                </View>
              )}
              <View style={styles.bannerEditOverlay}>
                <Ionicons name="camera" size={16} color="#ffffff" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={() => pickAndUpload('avatar')} style={styles.avatarContainer}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={32} color="#ffffff" />
                </View>
              )}
              <View style={styles.avatarEditOverlay}>
                <Ionicons name="camera" size={12} color="#ffffff" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Username</Text>
              <View style={styles.usernameInputContainer}>
                <Text style={styles.atSymbol}>@</Text>
                <TextInput
                  style={styles.usernameInput}
                  placeholder="username"
                  placeholderTextColor="#636366"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Display Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Your display name"
                placeholderTextColor="#636366"
                value={name}
                onChangeText={setName}
                maxLength={50}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Bio</Text>
              <TextInput
                style={[styles.textInput, styles.bioInput]}
                placeholder="Tell us about yourself..."
                placeholderTextColor="#636366"
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                maxLength={160}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{bio.length}/160</Text>
            </View>

            {/* Photo Guidelines */}
            <View style={styles.guidelinesContainer}>
              <Text style={styles.guidelinesTitle}>Photo Guidelines</Text>
              <Text style={styles.guidelinesText}>
                • Use clear, appropriate photos for your profile and cover
              </Text>
              <Text style={styles.guidelinesText}>
                • Avoid copyrighted material or offensive content
              </Text>
              <Text style={styles.guidelinesText}>
                • Photos should represent you authentically
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  saveButton: {
    color: '#0084ff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    color: '#636366',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  bannerSection: {
    marginBottom: 20,
  },
  bannerContainer: {
    position: 'relative',
    height: 120,
    backgroundColor: '#1c1c1e',
  },
  banner: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1c1c1e',
  },
  bannerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
  },
  bannerPlaceholderText: {
    color: '#8e8e93',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  bannerEditOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: -40,
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#000000',
    backgroundColor: '#1c1c1e',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0084ff',
  },
  avatarEditOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#0084ff',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  formSection: {
    paddingHorizontal: 16,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  usernameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  atSymbol: {
    color: '#8e8e93',
    fontSize: 16,
    paddingLeft: 16,
    paddingRight: 4,
  },
  usernameInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    paddingVertical: 14,
    paddingRight: 16,
  },
  textInput: {
    backgroundColor: '#1c1c1e',
    color: '#ffffff',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  charCount: {
    color: '#8e8e93',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
  },
  guidelinesContainer: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  guidelinesTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  guidelinesText: {
    color: '#8e8e93',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
})