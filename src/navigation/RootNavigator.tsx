import { createNativeStackNavigator } from '@react-navigation/native-stack'
import MainTabNav from './MainTabNav'
import PublicProfileScreen from '../screens/PublicProfileScreen'
import EditProfileScreen from '../screens/EditProfileScreen'
import SettingsScreen from '../screens/SettingsScreen'
import RewstaPlusScreen from '../screens/RewstaPlusScreen'
import RewstaPlusUnlockScreen from '../screens/RewstaPlusUnlockScreen'
import CommentsScreen from '../screens/CommentsScreen'

const RootStack = createNativeStackNavigator()

export default function RootNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabNav} />
      <RootStack.Screen name="PublicProfile" component={PublicProfileScreen} />
      <RootStack.Screen name="EditProfile" component={EditProfileScreen} />
      <RootStack.Screen name="Settings" component={SettingsScreen} />
      <RootStack.Screen name="Comments" component={CommentsScreen} />
      <RootStack.Screen name="RewstaPlus" component={RewstaPlusScreen} />
      <RootStack.Screen name="RewstaPlusUnlock" component={RewstaPlusUnlockScreen} />
    </RootStack.Navigator>
  )
}
