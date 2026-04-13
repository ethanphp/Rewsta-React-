import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Image,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

export default function SignupScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [isLoading, setIsLoading] = useState(false);

  const emailInputRef = useRef<TextInput>(null);
  const usernameInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  // Animations
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Pulse animation for loading
  useEffect(() => {
    if (usernameStatus === 'checking') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [usernameStatus]);

  // Username availability checker with debounce
  useEffect(() => {
    const checkUsername = async () => {
      if (username.length < 3) {
        setUsernameStatus('idle');
        return;
      }

      setUsernameStatus('checking');

      try {
        const { data, error } = await supabase
          .from('users')
          .select('username')
          .eq('username', username.toLowerCase())
          .single();

        if (error && error.code === 'PGRST116') {
          setUsernameStatus('available');
        } else if (data) {
          setUsernameStatus('taken');
        }
      } catch (err) {
        console.error('Error checking username:', err);
        setUsernameStatus('idle');
      }
    };

    const timeoutId = setTimeout(checkUsername, 500);
    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleSignup = async () => {
    if (!email || !password || !username) {
      Alert.alert('Missing fields', 'Please fill in all fields');
      return;
    }

    if (usernameStatus !== 'available') {
      Alert.alert('Username unavailable', 'Please choose a different username');
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      Alert.alert('Signup error', error.message);
      setIsLoading(false);
      return;
    }

    const user = data.user;
    if (user) {
      const { error: insertError } = await supabase.from('users').insert([
        {
          id: user.id,
          username: username.toLowerCase(),
          name: '',
          bio: '',
          avatar_url: '',
          auth_user_id: user.id,
        },
      ]);
      if (insertError) {
        console.log('Error creating user profile:', insertError.message);
      }
    }

    setIsLoading(false);
    Alert.alert('Welcome to Rewsta!', 'Check your email to confirm your account.');
    navigation.navigate('Login');
  };

  const getUsernameIcon = () => {
    switch (usernameStatus) {
      case 'checking':
        return (
          <Animated.View style={[styles.statusIcon, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.loadingDot} />
          </Animated.View>
        );
      case 'available':
        return (
          <Animated.View style={[styles.statusIcon, styles.successIcon]}>
            <Text style={styles.checkmark}>✓</Text>
          </Animated.View>
        );
      case 'taken':
        return (
          <Animated.View style={[styles.statusIcon, styles.errorIcon]}>
            <Text style={styles.cross}>✕</Text>
          </Animated.View>
        );
      default:
        return null;
    }
  };

  // Add handler to safely focus the password input
  const focusPasswordInput = () => {
    if (passwordInputRef.current) {
      passwordInputRef.current.focus();
    } else {
      console.warn('Password input ref is not available');
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20} // Adjust offset for Android
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" // Ensure taps outside inputs work
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Logo Area */}
            <View style={styles.logoContainer}>
              <View style={styles.logo}>
                <Image
                  source={require('../../assets/logo.jpeg')}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.brandName}>Rewsta</Text>
              <Text style={styles.tagline}>Join the community</Text>
            </View>

            {/* Form Container */}
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  ref={emailInputRef}
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#666"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => usernameInputRef.current?.focus()}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Username</Text>
                <View style={styles.usernameContainer}>
                  <TextInput
                    ref={usernameInputRef}
                    style={[styles.input, styles.usernameInput]}
                    placeholder="Choose a unique username"
                    placeholderTextColor="#666"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    returnKeyType="next"
                    onSubmitEditing={focusPasswordInput} // Use safe handler
                  />
                  {getUsernameIcon()}
                </View>
                {usernameStatus === 'taken' && (
                  <Text style={styles.errorText}>Username is already taken</Text>
                )}
                {usernameStatus === 'available' && (
                  <Text style={styles.successText}>Username is available!</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  ref={passwordInputRef}
                  style={styles.input}
                  placeholder="Create a secure password"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleSignup}
                  blurOnSubmit={true}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.signupButton,
                  (isLoading || usernameStatus === 'checking') && styles.disabledButton,
                ]}
                onPress={handleSignup}
                disabled={isLoading || usernameStatus === 'checking'}
              >
                <Text style={styles.signupButtonText}>
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.loginLinkText}>
                  Already have an account? <Text style={styles.loginLinkAccent}>Sign in</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    minHeight: height, // Ensure content fills the screen
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    color: '#888',
    fontWeight: '400',
  },
  formContainer: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: '#222',
  },
  inputGroup: {
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
  },
  usernameContainer: {
    position: 'relative',
  },
  usernameInput: {
    paddingRight: 50,
  },
  statusIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    backgroundColor: '#00C851',
  },
  errorIcon: {
    backgroundColor: '#FF4444',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cross: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  successText: {
    color: '#00C851',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  signupButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#333',
    shadowOpacity: 0,
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loginLink: {
    marginTop: 32,
    alignItems: 'center',
  },
  loginLinkText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  loginLinkAccent: {
    color: '#007AFF',
    fontWeight: '600',
  },
});