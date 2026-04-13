import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase'
import 'react-native-get-random-values'
import { v4 as uuidv4 } from 'uuid'
import { Ionicons } from '@expo/vector-icons'
import * as FileSystem from 'expo-file-system'
import * as Haptics from 'expo-haptics'
import { Dimensions } from 'react-native'
import { ScrollView } from 'react-native'


export default function CreatePostScreen({ navigation }: any) {
  const [content, setContent] = useState('')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [lifespan, setLifespan] = useState('never') // 'never', '2 hours', '24 hours', '3 days'
  const [showGhostDropdown, setShowGhostDropdown] = useState(false)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })


  useEffect(() => {
    if (imageUri) {
      Image.getSize(imageUri, (width, height) => {
        const screenWidth = Dimensions.get('window').width - 32
        const scaleFactor = width / screenWidth
        const imageHeight = height / scaleFactor
        setImageDimensions({ width: screenWidth, height: imageHeight })
      })
    }
  }, [imageUri])
  useEffect(() => {
    const loadAvatar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', user.id)
        .single()

      if (!error && data?.avatar_url) {
        setAvatarUrl(data.avatar_url)
      }
    }

    loadAvatar()
  }, [])

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri)
    }
  }

  const handlePost = async () => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      Alert.alert('Error', 'User not logged in.')
      return
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .single()

    let image_url = ''

    if (imageUri) {
      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `${uuidv4()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, {
          uri: imageUri,
          name: fileName,
          type: `image/${fileExt}`,
        })

      if (uploadError) {
        Alert.alert('Upload error', uploadError.message)
        return
      }

      const { data: urlData } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath)

      image_url = urlData.publicUrl
    }

    const username = userProfile?.username || 'unknown'

    const { error } = await supabase.from('posts').insert([
      {
        user_id: user.id,
        content,
        image_url,
        username,
        lifespan: lifespan === 'never' ? null :
  lifespan === '2 hours' ? '2:00:00' :
  lifespan === '24 hours' ? '24:00:00' :
  lifespan === '3 days' ? '72:00:00' :
  null,

      },
    ])

    if (error) {
      Alert.alert('Post error', error.message)
    } else {
      setContent('')
      setImageUri(null)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      navigation.goBack()
    }
  }

  return (
    <KeyboardAvoidingView
  style={styles.container}
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
>
  <ScrollView
    contentContainerStyle={styles.scrollContent}
    keyboardShouldPersistTaps="handled"
  >
    {/* Top Bar */}
    <View style={styles.topBar}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={28} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.topBarTitle}>New Post</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <TouchableOpacity onPress={handlePost}>
          <Text style={styles.postButton}>Post</Text>
        </TouchableOpacity>
      </View>
    </View>

    {/* Input */}
    <View style={styles.inputRow}>
      <Image
        source={avatarUrl ? { uri: avatarUrl } : require('../../assets/icon.png')}
        style={styles.avatar}
      />
      <TextInput
        style={styles.input}
        placeholder="What's going down?"
        placeholderTextColor="#888"
        value={content}
        onChangeText={setContent}
        multiline
        autoFocus
      />
    </View>

    {/* Image Preview */}
    {imageUri && (
      <View style={styles.imagePreviewWrapper}>
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.imagePreview,
            {
              width: imageDimensions.width || 200,
              height: imageDimensions.height || 200,
            },
          ]}
        />
        <TouchableOpacity
          style={styles.removeImageButton}
          onPress={() => setImageUri(null)}
        >
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    )}

    {/* Ghost badge */}
    {lifespan !== 'never' && (
      <View style={{ marginLeft: 16, marginTop: 10 }}>
        <Text style={styles.ghostBadge}>GhostPost Active</Text>
      </View>
    )}
  </ScrollView>

  {/* Bottom Bar */}
  <View style={styles.bottomBar}>
    <TouchableOpacity onPress={pickImage}>
      <Ionicons name="image-outline" size={28} color="#389beb" />
    </TouchableOpacity>

    <View style={{ marginLeft: 16 }}>
      <TouchableOpacity onPress={() => setShowGhostDropdown(!showGhostDropdown)}>
        <Ionicons name="timer-outline" size={26} color="#389beb" />
      </TouchableOpacity>

      {showGhostDropdown && (
        <View style={styles.dropdown}>
          <View style={{ marginBottom: 12 }}>
            <Text style={{
              color: '#fff',
              fontSize: 17,
              fontWeight: '600',
              marginBottom: 4
            }}>
              Make this a GhostPost?
            </Text>
            <Text style={{
              color: '#aaa',
              fontSize: 14,
              lineHeight: 18,
            }}>
              GhostPosts automatically disappear after a set time.
              By default, your post stays up permanently.
            </Text>
          </View>

          <View style={{ height: 1, backgroundColor: '#222', marginVertical: 8 }} />

          {['never', '2 hours', '24 hours', '3 days'].map(option => (
            <TouchableOpacity
              key={option}
              onPress={() => {
                setLifespan(option)
                setShowGhostDropdown(false)
              }}
              style={[
                styles.dropdownItem,
                lifespan === option && { backgroundColor: '#389beb' },
              ]}
            >
              <Text
                style={{
                  color: lifespan === option ? '#fff' : '#ccc',
                  fontSize: 15,
                  fontWeight: lifespan === option ? '600' : '400',
                }}
              >
                {option === 'never' ? 'No Expiry' : option}
              </Text>
              {lifespan === option && (
                <Ionicons name="checkmark" size={16} color="#fff" style={{ marginLeft: 'auto' }} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  </View>
</KeyboardAvoidingView>

  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 50,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  imagePreviewWrapper: {
    position: 'relative',
    marginTop: 16,
    marginHorizontal: 16,
    alignItems: 'center',
  },
  imagePreview: {
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  scrollContent: {
  paddingBottom: 32,
},
  topBarTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  postButton: {
    color: '#389beb',
    fontSize: 16,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingTop: 10,
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
  },
  dropdown: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    width: 250,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 10,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 6,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    alignItems: 'center',
  },
  ghostBadge: {
    marginTop: 4,
    fontSize: 11,
    color: '#389beb',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
})
