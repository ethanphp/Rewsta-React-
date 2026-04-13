import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'


export default function RewstaPlusUnlockScreen() {
  const navigation = useNavigation()
  const [mode, setMode] = useState<'code' | 'subscribe'>('code')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const handleRedeem = async () => {
  if (!code.trim()) {
    setError('Enter a valid code')
    return
  }

  setError('')
  const { error } = await supabase.rpc('redeem_rewsta_code', { input_code: code })

  if (error) {
    console.error(error)
    setError(error.message.includes('Invalid') ? 'Invalid or used code' : 'Something went wrong')
    return
  }

  // success
  navigation.navigate('RewstaPlusSuccess') // or show a toast/modal
}


  const handleSubscribe = () => {
    // 🔒 Trigger Stripe or in-app purchase flow
    console.log('Subscribe tapped')
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.inner}>
          {/* Logo Container */}
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Image
                source={require('../../assets/logo.jpeg')}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
          </View>

          <Text style={styles.title}>Unlock Rewsta Plus</Text>

          {/* Toggle */}
          <View style={styles.toggleContainer}>
            <View style={styles.toggle}>
              <TouchableOpacity
                style={[styles.toggleButton, mode === 'code' && styles.toggleActive]}
                onPress={() => setMode('code')}
              >
                <Text style={[styles.toggleText, mode === 'code' && styles.toggleTextActive]}>
                  Redeem Code
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, mode === 'subscribe' && styles.toggleActive]}
                onPress={() => setMode('subscribe')}
              >
                <Text style={[styles.toggleText, mode === 'subscribe' && styles.toggleTextActive]}>
                  Subscribe
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Form Area */}
          <View style={styles.formContainer}>
            {mode === 'code' ? (
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Promo Code</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your code"
                    placeholderTextColor="#666"
                    value={code}
                    onChangeText={(text) => setCode(text.toUpperCase())}
                    autoCapitalize="characters"
                    returnKeyType="done"
                    onSubmitEditing={handleRedeem}
                  />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                </View>
                <TouchableOpacity style={styles.primaryButton} onPress={handleRedeem}>
                  <Text style={styles.primaryText}>Redeem Code</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.form}>
                <Text style={styles.note}>
                  Subscriptions help keep Rewsta ad-free and sustainable. Unlock unlimited conversations and premium features.
                </Text>
                <TouchableOpacity style={styles.primaryButton} onPress={handleSubscribe}>
                  <Text style={styles.primaryText}>Subscribe – £2.99/month</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  inner: {
    padding: 24,
    flex: 1,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logoImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: -0.5,
  },
  toggleContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#222',
  },
  toggleButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: {
    color: '#888',
    fontWeight: '600',
    fontSize: 14,
  },
  toggleTextActive: {
    color: '#fff',
  },
  formContainer: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#222',
  },
  form: {
    alignItems: 'center',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    fontWeight: '400',
    width: '100%',
  },
  error: {
    color: '#FF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  note: {
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
})