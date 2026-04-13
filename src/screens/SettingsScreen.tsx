import React, { useState, useEffect } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView,
  Switch,
  Image,
  Alert
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { Linking } from 'react-native'
import Constants from 'expo-constants'

export default function SettingsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(true)
  const [privateAccount, setPrivateAccount] = useState(false)
  const [readReceipts, setReadReceipts] = useState(true)
  const [versionTapCount, setVersionTapCount] = useState(0)
  const [showDevTools, setShowDevTools] = useState(false)
  const [showPostViews, setShowPostViews] = useState(true)
  const [isPlusUser, setIsPlusUser] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('users')
        .select('private, show_post_views, plus_member')
        .eq('id', user.id)
        .single()

      if (!error && data) {
        setPrivateAccount(data.private)
        setShowPostViews(data.show_post_views)
        setIsPlusUser(data.plus_member)
      }
    }

    fetchSettings()
  }, [])

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut()
            navigation.reset({
              index: 0,
              routes: [{ name: 'Auth' }],
            })
          },
        },
      ]
    )
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your posts, followers, and data will be permanently deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'Type "DELETE" to confirm account deletion.',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Proceed',
                  style: 'destructive',
                  onPress: () => {
                    console.log('Account deletion requested')
                  },
                },
              ]
            )
          },
        },
      ]
    )
  }

  const SettingsSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )

  const SettingsItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    showArrow = true,
    rightComponent,
    isDestructive = false
  }: {
    icon: string
    title: string
    subtitle?: string
    onPress?: () => void
    showArrow?: boolean
    rightComponent?: React.ReactNode
    isDestructive?: boolean
  }) => (
    <TouchableOpacity 
      style={styles.settingsItem} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingsItemLeft}>
        <View style={[styles.iconContainer, isDestructive && styles.destructiveIconContainer]}>
          <Ionicons 
            name={icon as any} 
            size={20} 
            color={isDestructive ? "#ff3b30" : "#0084ff"} 
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.itemTitle, isDestructive && styles.destructiveText]}>{title}</Text>
          {subtitle && <Text style={styles.itemSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.settingsItemRight}>
        {rightComponent}
        {showArrow && onPress && (
          <Ionicons name="chevron-forward" size={16} color="#8e8e93" />
        )}
      </View>
    </TouchableOpacity>
  )

  const ToggleItem = ({ 
    icon, 
    title, 
    subtitle, 
    value, 
    onValueChange 
  }: {
    icon: string
    title: string
    subtitle?: string
    value: boolean
    onValueChange: (value: boolean) => void
  }) => (
    <SettingsItem
      icon={icon}
      title={title}
      subtitle={subtitle}
      showArrow={false}
      rightComponent={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#1c1c1e', true: '#0084ff' }}
          thumbColor={value ? '#ffffff' : '#8e8e93'}
          ios_backgroundColor="#1c1c1e"
        />
      }
    />
  )

  // Modern Header Component
  const SettingsHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#ffffff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Settings</Text>
      <View style={{ width: 24 }} />
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <SettingsHeader />

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <SettingsSection title="Account">
          <SettingsItem
            icon={isPlusUser ? "rocket" : "star-outline"}
            title={isPlusUser ? 'Rewsta Plus Member' : 'Get Rewsta Plus'}
            subtitle={
              isPlusUser
                ? 'Thank you for supporting Rewsta!'
                : 'Unlock unlimited chats and premium features'
            }
            onPress={() => {
              if (!isPlusUser) {
                navigation.navigate('RewstaPlus')
              }
            }}
            showArrow={!isPlusUser}
          />

          <SettingsItem
            icon="person-outline"
            title="Edit Profile"
            subtitle="Update your profile information"
            onPress={() => navigation.navigate('EditProfile')}
          />

          <SettingsItem
            icon="mail-outline"
            title="Email & Phone"
            subtitle="Manage your contact information"
            onPress={() => console.log('Email & Phone')}
          />

          <SettingsItem
            icon="notifications-outline"
            title="Notifications"
            subtitle="Customize what notifications you receive"
            onPress={() => console.log('Notification Settings')}
          />
        </SettingsSection>

        <SettingsSection title="Privacy">
          <ToggleItem
            icon="lock-closed-outline"
            title="Private Account"
            subtitle="Only approved followers can see your posts"
            value={privateAccount}
            onValueChange={async (value) => {
              setPrivateAccount(value)
              const { data: { user } } = await supabase.auth.getUser()
              if (!user) return

              const { error } = await supabase
                .from('users')
                .update({ private: value })
                .eq('id', user.id)

              if (error) {
                Alert.alert('Error', 'Failed to update privacy setting.')
                setPrivateAccount(!value)
              }
            }}
          />

          <ToggleItem
            icon="eye-outline"
            title="Allow View Receipts"
            subtitle="Let followers see when you've viewed posts"
            value={showPostViews}
            onValueChange={async (value) => {
              setShowPostViews(value)
              const { data: { user } } = await supabase.auth.getUser()
              if (!user) return

              const { error } = await supabase
                .from('users')
                .update({ show_post_views: value })
                .eq('id', user.id)

              if (error) {
                Alert.alert('Error', 'Failed to update view tracking setting.')
                setShowPostViews(!value)
              }
            }}
          />
        </SettingsSection>

        <SettingsSection title="About">
          <SettingsItem
            icon="information-circle-outline"
            title="App Version"
            subtitle={Constants.manifest?.version || 'v1.0.0'}
            showArrow={false}
            onPress={() => {
              setVersionTapCount((prev) => {
                const newCount = prev + 1
                if (newCount >= 5) {
                  setShowDevTools(true)
                  Alert.alert('Developer Mode Enabled')
                  return 0
                }
                return newCount
              })
            }}
          />

          <SettingsItem
            icon="document-text-outline"
            title="Legal"
            subtitle="Terms of Service & Privacy Policy"
            onPress={() => Linking.openURL('https://rewsta.io/legal')}
          />

          <SettingsItem
            icon="help-circle-outline"
            title="Help Center"
            subtitle="Get help and support"
            onPress={() => Linking.openURL('https://help.rewsta.io')}
          />
        </SettingsSection>

        {showDevTools && (
          <SettingsSection title="Developer">
            <SettingsItem
              icon="code-outline"
              title="Environment"
              subtitle={__DEV__ ? 'Development' : 'Production'}
              showArrow={false}
            />

            <SettingsItem
              icon="server-outline"
              title="Database"
              subtitle={supabase ? 'Connected' : 'Not Connected'}
              showArrow={false}
            />

            <SettingsItem
              icon="person-circle-outline"
              title="User Info"
              subtitle="Tap to view user details"
              onPress={async () => {
                const { data: { session } } = await supabase.auth.getSession()
                if (session?.user) {
                  Alert.alert('User Info', `ID: ${session.user.id}\nEmail: ${session.user.email}\nPlus: ${isPlusUser}`)
                } else {
                  Alert.alert('No active session')
                }
              }}
            />
          </SettingsSection>
        )}

        <SettingsSection title="Account Actions">
          <SettingsItem
            icon="log-out-outline"
            title="Sign Out"
            subtitle="Sign out of your account"
            onPress={handleLogout}
            showArrow={false}
            isDestructive={true}
          />
        </SettingsSection>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Rewsta v{Constants.manifest?.version || '1.0.0'}</Text>
          <Text style={styles.footerText}>Made with ❤️ for better conversations</Text>
        </View>
      </ScrollView>
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
  scrollContainer: {
    flex: 1,
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    color: '#8e8e93',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 16,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#000000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1c1c1e',
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  destructiveIconContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  textContainer: {
    flex: 1,
  },
  itemTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  destructiveText: {
    color: '#ff3b30',
  },
  itemSubtitle: {
    color: '#8e8e93',
    fontSize: 14,
    marginTop: 2,
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  footerText: {
    color: '#636366',
    fontSize: 13,
    marginVertical: 2,
    textAlign: 'center',
  },
})