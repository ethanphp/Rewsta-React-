import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'

export function useIncomingCallListener(myUserId: string) {
  const navigation = useNavigation()

  useEffect(() => {
    const channel = supabase
      .channel(`call-listener-${myUserId}`)
      .on('broadcast', { event: 'incoming-call' }, ({ payload }) => {
        if (payload.from === myUserId) return

        Alert.alert(
          '📞 Incoming Call',
          `Call from ${payload.name || 'Unknown'}`,
          [
            {
              text: 'Decline',
              style: 'cancel',
            },
            {
              text: 'Accept',
              onPress: () => {
                navigation.navigate('CallScreen', {
                  isCaller: false,
                  conversationId: payload.conversationId,
                  callee: {
                    id: payload.from,
                    name: payload.name,
                    avatar_url: payload.avatar_url || '',
                  },
                })
              },
            },
          ],
          { cancelable: false }
        )
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [myUserId])
}
