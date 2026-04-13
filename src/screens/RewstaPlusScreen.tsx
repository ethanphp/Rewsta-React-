import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { useNavigation } from '@react-navigation/native'
import { useRoute } from '@react-navigation/native'

export default function RewstaPlusScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const { reason } = route.params || {}

  let title = 'Unlock Rewsta Plus'
  let subtitle = "Rewsta was built to stay free where it matters. But some features are server-heavy, so Rewsta Plus helps keep it sustainable."

  if (reason === 'chat_limit') {
    title = "You've reached the conversation limit"
    subtitle = "You can chat with up to 3 people for free. For unlimited conversations, upgrade to Rewsta Plus."
  } else if (reason === 'profile_customization') {
    title = 'Make It Yours'
    subtitle = 'Add banners, pronouns, and links to personalize your profile with Rewsta Plus.'
  } else if (reason === 'follow_limit') {
    title = "You've reached the follow limit"
    subtitle = 'Free users can follow up to 25 people. Rewsta Plus lifts that cap completely.'
  } else if (reason === 'early_access') {
    title = 'Be First to Try New Things'
    subtitle = 'Get early access to experimental features with Rewsta Plus.'
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Modern Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rewsta Plus</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <Ionicons name="rocket" size={48} color="#ff9500" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {/* Features List */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>What you get with Plus:</Text>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="chatbubbles" size={20} color="#0084ff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Unlimited conversations</Text>
              <Text style={styles.featureDescription}>Chat with as many people as you want</Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="people" size={20} color="#0084ff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Unlimited following</Text>
              <Text style={styles.featureDescription}>Follow anyone without limits</Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="flash" size={20} color="#0084ff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Early feature access</Text>
              <Text style={styles.featureDescription}>Be the first to try new features</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="color-palette" size={20} color="#0084ff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Profile customization</Text>
              <Text style={styles.featureDescription}>Banners, themes, and more</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="star" size={20} color="#0084ff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Priority support</Text>
              <Text style={styles.featureDescription}>Get help faster when you need it</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="add-circle" size={20} color="#0084ff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Much more coming</Text>
              <Text style={styles.featureDescription}>New Plus features added regularly</Text>
            </View>
          </View>
        </View>

        {/* Mission Statement */}
        <View style={styles.missionSection}>
          <Text style={styles.missionText}>
            We'll never charge you to speak. Rewsta Plus just unlocks the features that cost the most to run and helps keep Rewsta sustainable for everyone.
          </Text>
        </View>

        {/* Pricing Card */}
        <View style={styles.pricingCard}>
          <View style={styles.pricingHeader}>
            <Text style={styles.pricingTitle}>Rewsta Plus</Text>
            <View style={styles.pricingBadge}>
              <Text style={styles.pricingBadgeText}>POPULAR</Text>
            </View>
          </View>
          <View style={styles.pricingDetails}>
            <Text style={styles.pricingPrice}>£2.99</Text>
            <Text style={styles.pricingPeriod}>per month</Text>
          </View>
          <Text style={styles.pricingDescription}>
            Cancel anytime. No hidden fees.
          </Text>
        </View>

        {/* CTA Buttons */}
        <TouchableOpacity 
          style={styles.ctaButton} 
          onPress={() => navigation.navigate('RewstaPlusUnlock')}
        >
          <Text style={styles.ctaText}>Subscribe to Rewsta Plus</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.secondaryText}>Maybe later</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By subscribing, you agree to our Terms of Service and Privacy Policy. 
            Subscription automatically renews unless cancelled.
          </Text>
        </View>
      </ScrollView>

      {/* Floating Price Button */}
      <View style={styles.floatingContainer}>
        <TouchableOpacity 
          style={styles.floatingButton} 
          onPress={() => navigation.navigate('RewstaPlusUnlock')}
        >
          <View style={styles.floatingContent}>
            <View style={styles.floatingLeft}>
              <Text style={styles.floatingPrice}>£2.99</Text>
              <Text style={styles.floatingPeriod}>per month</Text>
            </View>
            <View style={styles.floatingRight}>
              <Text style={styles.floatingCTA}>Subscribe</Text>
              <Ionicons name="arrow-forward" size={16} color="#ffffff" style={styles.floatingArrow} />
            </View>
          </View>
        </TouchableOpacity>
      </View>
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
  scroll: {
    paddingBottom: 120, // Extra space for floating button
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#ff9500',
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#8e8e93',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  featuresSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  featuresTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#000000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1c1c1e',
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
    justifyContent: 'center',
  },
  featureTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    color: '#8e8e93',
    fontSize: 14,
    lineHeight: 18,
  },
  missionSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  missionText: {
    color: '#8e8e93',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  pricingCard: {
    marginHorizontal: 20,
    marginBottom: 32,
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#333333',
  },
  pricingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pricingTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  pricingBadge: {
    backgroundColor: '#ff9500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pricingBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  pricingDetails: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  pricingPrice: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
  },
  pricingPeriod: {
    color: '#8e8e93',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
  pricingDescription: {
    color: '#8e8e93',
    fontSize: 14,
  },
  ctaButton: {
    backgroundColor: '#ff9500',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#ff9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 32,
  },
  secondaryText: {
    color: '#8e8e93',
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 20,
  },
  footerText: {
    color: '#636366',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  floatingContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    borderTopWidth: 0.5,
    borderTopColor: '#1c1c1e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 34, // Account for safe area
  },
  floatingButton: {
    backgroundColor: '#ff9500',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#ff9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  floatingLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  floatingPrice: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  floatingPeriod: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
    opacity: 0.9,
  },
  floatingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  floatingCTA: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  floatingArrow: {
    marginLeft: 6,
  },
})