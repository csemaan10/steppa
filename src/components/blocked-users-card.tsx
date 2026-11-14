import { Alert, View } from 'react-native';
import { Card, List, useTheme } from 'react-native-paper';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { UserAvatar } from '@/components/user-avatar';
import { useLoader } from '@/hooks/use-loader';
import { getBlockedUsers, unblockUser, type BlockedUser } from '@/lib/api';
import { glassCard } from '@/theme';
import { layoutMove, leave } from '@/theme/motion';

/**
 * People you've blocked from chat, with unblock. Hidden when the list is empty. Someone unblocked
 * fades out of the list as the rest slide up, and the card fades away with the last of them. No
 * entrance of its own: the screen it sits on brings its blocks in.
 */
export function BlockedUsersCard({ userId }: { userId: string }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { data, reload } = useLoader(() => getBlockedUsers(userId), `blocked:${userId}`);

  if (!data?.length) return null;

  function unblock(user: BlockedUser) {
    unblockUser(userId, user.id)
      .then(reload)
      .catch((e) => Alert.alert('Error', e instanceof Error ? e.message : String(e)));
  }

  return (
    // No layout transition on the card itself: it sits below Settings' folding cards, which move it
    // every frame as they open, and a transition restarting each frame would trail behind them.
    <Animated.View exiting={leave(reduceMotion)}>
      <Card mode="contained" style={glassCard(theme)}>
        <List.Accordion
          title={`Blocked users · ${data.length}`}
          description="Their chat messages are hidden from you"
          left={(props) => <List.Icon {...props} icon="account-cancel-outline" />}
          style={{ backgroundColor: 'transparent' }}>
          {data.map((user) => (
            <Animated.View key={user.id} exiting={leave(reduceMotion)} layout={layoutMove}>
              <List.Item
                title={user.display_name}
                left={() => (
                  <View style={{ justifyContent: 'center', marginLeft: 16 }}>
                    <UserAvatar name={user.display_name} color={user.avatar_color} icon={user.avatar_icon} size={32} />
                  </View>
                )}
                right={() => (
                  <Button compact onPress={() => unblock(user)}>
                    Unblock
                  </Button>
                )}
              />
            </Animated.View>
          ))}
        </List.Accordion>
      </Card>
    </Animated.View>
  );
}
